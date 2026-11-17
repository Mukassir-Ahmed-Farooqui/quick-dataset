"""
Concurrent LLM execution for generators.

Generators used to await every LLM call one after another inside nested
loops. :class:`LLMRunner` runs them concurrently while keeping the
SQLAlchemy Session safe:

- LLM calls run in worker coroutines limited by an ``asyncio.Semaphore``
  (``GENERATION_CONCURRENCY``, default 8).
- Workers never touch the Session. Usage-log rows are deferred into a
  list (``tracked_complete(usage_sink=...)``) and every DB write —
  usage logs, progress, results — happens in the single coroutine that
  consumes results in :meth:`LLMRunner.run_all`.
- Retries use exponential backoff with jitter. HTTP 429 honours the
  ``Retry-After`` header and pauses *all* workers on that runner, so a
  rate-limited provider isn't hammered by the other in-flight calls.
  Client errors (400/401/403/404/422) are not retried.
"""

from __future__ import annotations

import asyncio
import email.utils
import logging
import os
import random
import re
import time
from typing import Any, Awaitable, Callable, Iterable, Optional, Sequence, TypeVar

import httpx
from sqlalchemy.orm import Session

from app.services.generation.resolver import ResolvedLLMConfig
from app.services.llm import tracked_call

logger = logging.getLogger(__name__)

T = TypeVar("T")
R = TypeVar("R")

DEFAULT_CONCURRENCY = int(os.getenv("GENERATION_CONCURRENCY", "8"))
DEFAULT_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "4"))
# Rate limits clear on their own; give them a longer runway than other errors.
DEFAULT_MAX_RATE_LIMIT_RETRIES = int(os.getenv("LLM_MAX_RATE_LIMIT_RETRIES", "10"))
DEFAULT_BASE_DELAY = float(os.getenv("LLM_RETRY_BASE_DELAY", "1.0"))
DEFAULT_MAX_DELAY = float(os.getenv("LLM_RETRY_MAX_DELAY", "60"))
MAX_CONCURRENCY = 64

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524, 529}


def _status_of(exc: BaseException) -> Optional[int]:
    if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
        return exc.response.status_code
    return getattr(exc, "status_code", None)


def is_retryable(exc: BaseException) -> bool:
    status = _status_of(exc)
    if status is not None:
        return status in RETRYABLE_STATUS
    if isinstance(exc, ValueError) and "Unsupported provider" in str(exc):
        return False
    return True  # timeouts, transport errors, malformed provider bodies


_DURATION_RE = re.compile(r"(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$")


def _parse_duration(value: str) -> Optional[float]:
    """Parse '12', '12.5s', '577ms', '1m2.5s' or '1h9m7.2s' into seconds."""
    value = value.strip()
    try:
        return max(0.0, float(value))
    except ValueError:
        pass
    m = _DURATION_RE.match(value)
    if not m or not any(m.groups()):
        return None
    h, mi, sec, ms = (float(g) if g else 0.0 for g in m.groups())
    return max(0.0, h * 3600 + mi * 60 + sec + ms / 1000)


def retry_after_seconds(exc: BaseException) -> Optional[float]:
    """How long a 429 asks us to wait.

    Order: ``Retry-After`` (seconds or HTTP-date), then the per-minute token
    window (``x-ratelimit-reset-tokens``). ``x-ratelimit-reset-requests`` is
    deliberately ignored: on Groq it is the *daily* request window, so honouring
    it would stall a run for an hour on a token-per-minute 429.
    """
    resp = getattr(exc, "response", None)
    headers = getattr(resp, "headers", None)
    if not headers:
        return None
    for name in ("retry-after", "x-ratelimit-reset-tokens"):
        value = headers.get(name)
        if not value:
            continue
        secs = _parse_duration(str(value))
        if secs is not None:
            return secs
        try:
            dt = email.utils.parsedate_to_datetime(str(value).strip())
            return max(0.0, dt.timestamp() - time.time())
        except (TypeError, ValueError):
            continue
    return None


def backoff_delay(attempt: int, base: float, cap: float, rng: random.Random) -> float:
    return min(cap, base * (2 ** attempt)) * (0.5 + rng.random())


class LLMRunner:
    """Bounded-concurrency, retrying wrapper around ``tracked_complete``."""

    def __init__(
        self,
        db: Session,
        project_id: str,
        config: ResolvedLLMConfig,
        model: str,
        *,
        task_id: Optional[str] = None,
        concurrency: Optional[int] = None,
        max_retries: Optional[int] = None,
        base_delay: Optional[float] = None,
        max_delay: Optional[float] = None,
        seed: Optional[int] = None,
    ):
        self.db = db
        self.project_id = project_id
        self.config = config
        self.model = model
        self.task_id = task_id
        self.concurrency = max(1, min(MAX_CONCURRENCY, int(concurrency or DEFAULT_CONCURRENCY)))
        self.max_retries = DEFAULT_MAX_RETRIES if max_retries is None else max(0, int(max_retries))
        self.base_delay = DEFAULT_BASE_DELAY if base_delay is None else base_delay
        self.max_delay = DEFAULT_MAX_DELAY if max_delay is None else max_delay
        self.usage_logs: list[dict] = []
        self._sem = asyncio.Semaphore(self.concurrency)
        self._pause_until = 0.0
        self._rng = random.Random(seed)
        self.calls = 0
        self.in_flight = 0
        self.peak_in_flight = 0

    # ── single call ──────────────────────────────────────────────────

    async def complete(
        self,
        prompt: str | list[dict],
        *,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """One LLM call with semaphore + retries. Returns the raw text.

        Raises the last exception once retries are exhausted.
        """
        messages = [{"role": "user", "content": prompt}] if isinstance(prompt, str) else prompt
        last_exc: Optional[BaseException] = None
        for attempt in range(max(self.max_retries, DEFAULT_MAX_RATE_LIMIT_RETRIES) + 1):
            wait = self._pause_until - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            async with self._sem:
                self.in_flight += 1
                self.peak_in_flight = max(self.peak_in_flight, self.in_flight)
                self.calls += 1
                try:
                    response = await tracked_call.tracked_complete(
                        db=self.db,
                        project_id=self.project_id,
                        config=self.config,
                        messages=messages,
                        model=self.model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        task_id=self.task_id,
                        usage_sink=self.usage_logs,
                    )
                    return response.content or ""
                except Exception as exc:  # noqa: BLE001 — classified below
                    last_exc = exc
                finally:
                    self.in_flight -= 1

            limit = self.max_retries
            if _status_of(last_exc) == 429:
                limit = max(self.max_retries, DEFAULT_MAX_RATE_LIMIT_RETRIES)
            if attempt >= limit or not is_retryable(last_exc):
                break
            delay = backoff_delay(attempt, self.base_delay, self.max_delay, self._rng)
            if _status_of(last_exc) == 429:
                ra = retry_after_seconds(last_exc)
                if ra is not None:
                    delay = max(delay, min(ra, self.max_delay))
                # Pause every worker on this runner, not just this one.
                self._pause_until = max(self._pause_until, time.monotonic() + delay)
            logger.warning(
                "LLM call failed (attempt %d/%d), retrying in %.1fs: %s",
                attempt + 1, limit + 1, delay, last_exc,
            )
            await asyncio.sleep(delay)
        assert last_exc is not None
        raise last_exc

    # ── batch ────────────────────────────────────────────────────────

    def flush_usage(self) -> int:
        """Write deferred usage logs. Call only from the consuming coroutine."""
        try:
            return tracked_call.flush_usage_logs(self.db, self.usage_logs)
        except Exception as exc:  # never let accounting kill a run
            logger.error("Failed to flush %d usage logs: %s", len(self.usage_logs), exc)
            try:
                self.db.rollback()
            except Exception:
                pass
            self.usage_logs.clear()
            return 0

    async def run_all(
        self,
        jobs: Sequence[T],
        worker: Callable[[T], Awaitable[R]],
        on_result: Callable[[T, Optional[R], Optional[BaseException]], None],
        *,
        on_flush: Optional[Callable[[int], bool]] = None,
        flush_every: int = 10,
        flush_interval: float = 1.0,
    ) -> int:
        """Run ``worker(job)`` for every job concurrently.

        ``on_result(job, result, error)`` is invoked from THIS coroutine
        for each finished job (safe for DB work). ``on_flush(n_done)`` is
        called every ``flush_every`` results / ``flush_interval`` seconds
        and at the end, right after usage logs are flushed; it may return
        ``True`` to cancel the remaining jobs (e.g. task cancelled).

        Returns the number of jobs that finished (success or error).
        """
        if not jobs:
            return 0

        async def _wrapped(idx: int):
            job = jobs[idx]
            try:
                return idx, await worker(job), None
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                return idx, None, exc

        tasks = [asyncio.create_task(_wrapped(i)) for i in range(len(jobs))]
        done = 0
        since_flush = 0
        last_flush = time.monotonic()
        cancelled = False
        try:
            for fut in asyncio.as_completed(tasks):
                idx, result, error = await fut
                done += 1
                since_flush += 1
                try:
                    on_result(jobs[idx], result, error)
                except Exception as exc:  # a bad row must not stop the batch
                    logger.error("on_result failed for job %s: %s", idx, exc)
                    try:
                        self.db.rollback()
                    except Exception:
                        pass
                now = time.monotonic()
                if since_flush >= flush_every or now - last_flush >= flush_interval:
                    self.flush_usage()
                    if on_flush and on_flush(since_flush):
                        cancelled = True
                        break
                    since_flush = 0
                    last_flush = now
        finally:
            pending = [t for t in tasks if not t.done()]
            for t in pending:
                t.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            self.flush_usage()
            if on_flush and since_flush and not cancelled:
                on_flush(since_flush)
        return done
