"""
Tracked LLM call wrapper — every LLM call in the application MUST pass
through tracked_complete(), never a bare provider client call.

This guarantees exactly one llm_usage_logs row per call, success or
failure, with no exceptions. A generator that calls a provider client
directly, bypassing this wrapper, breaks cost tracking silently.

Usage:
    response = await tracked_complete(
        db=db,
        project_id=project_id,
        config=resolved_config,      # from resolve_llm_config()
        task_id=task_id,             # optional — links usage to task
        messages=[{"role": "user", "content": "..."}],
        model="gpt-4o",
        temperature=0.7,
        max_tokens=4096,
    )
"""

import os
import time
import logging
import asyncio
from typing import Optional
from sqlalchemy.orm import Session

from app.core.pricing import estimate_cost_usd
from app.models import LLMUsageLog, LLMProvider
from app.schemas_extended import LLMResponse
from app.services.generation.resolver import ResolvedLLMConfig
from app.services.llm.provider_factory import ProviderFactory

logger = logging.getLogger(__name__)

DEFAULT_CALL_TIMEOUT = float(os.getenv("LLM_CALL_TIMEOUT", "120"))


async def tracked_complete(
    db: Session,
    project_id: str,
    config: ResolvedLLMConfig,
    messages: list[dict],
    model: str,
    *,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    task_id: Optional[str] = None,
    usage_sink: Optional[list] = None,
    timeout: Optional[float] = None,
) -> LLMResponse:
    """Make an LLM call with full tracking: latency, tokens, cost, logging.

    Guarantees exactly one LLMUsageLog row per call regardless of outcome.
    On failure, logs the error and re-raises the original exception.

    Args:
        db: Active database session.
        project_id: Project scope for the usage log.
        config: Resolved LLM config (from resolve_llm_config()).
        messages: Chat messages in OpenAI format.
        model: Model name string (e.g. "gpt-4o", "claude-3-opus").
        temperature: Sampling temperature.
        max_tokens: Maximum tokens to generate.
        task_id: Optional task id to link usage to a background task.
        usage_sink: Optional list. When given, the usage-log row is appended
            to it (as kwargs for ``_write_usage_log``) instead of being
            written immediately. Concurrent generators use this so that
            only ONE coroutine ever touches the SQLAlchemy Session; they
            call :func:`flush_usage_logs` from that single place. Exactly
            one row per call is still guaranteed once flushed.
        timeout: Hard wall-clock timeout in seconds (default
            ``LLM_CALL_TIMEOUT`` env, 120s).

    Returns:
        LLMResponse with generated content and token counts.

    Raises:
        Original exception from the provider client. The usage log is
        written before re-raising so even failed calls are recorded.
    """
    start_time = time.time()
    provider_name = config.provider
    llm_key_id = config.llm_key_id
    input_tokens = 0
    output_tokens = 0
    error_message: Optional[str] = None
    status = "success"
    effective_timeout = float(timeout or DEFAULT_CALL_TIMEOUT)
    write_log = (lambda **kw: usage_sink.append(kw)) if usage_sink is not None else (lambda **kw: _write_usage_log(db=db, **kw))

    try:
        # Create provider client
        provider = ProviderFactory.create(provider_name, config.api_key)

        # Make the actual LLM call with a hard wall-clock timeout
        response = await asyncio.wait_for(
            provider.complete(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            ),
            timeout=effective_timeout,
        )

        latency_ms = int((time.time() - start_time) * 1000)
        input_tokens = response.prompt_tokens
        output_tokens = response.completion_tokens

        # Compute estimated cost
        estimated_cost = estimate_cost_usd(
            provider=provider_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        # Write success usage log
        write_log(
            project_id=project_id,
            user_llm_key_id=llm_key_id,
            task_id=task_id,
            provider=provider_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost,
            latency_ms=latency_ms,
            status="success",
            error_message=None,
        )

        logger.info(
            "LLM call OK | provider=%s model=%s tokens_in=%d tokens_out=%d cost=%.6f latency=%dms",
            provider_name, model, input_tokens, output_tokens, estimated_cost or 0, latency_ms,
        )

        return response

    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        
        if isinstance(e, asyncio.TimeoutError) or isinstance(e, TimeoutError):
            error_message = f"LLM request exceeded {int(effective_timeout)} seconds timeout."
        else:
            error_message = str(e) or e.__class__.__name__
            
        status = "error"

        # Write failure usage log (input_tokens may be partial or 0)
        write_log(
            project_id=project_id,
            user_llm_key_id=llm_key_id,
            task_id=task_id,
            provider=provider_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=0,
            estimated_cost_usd=0.0,
            latency_ms=latency_ms,
            status="error",
            error_message=error_message,
        )

        logger.error(
            "LLM call FAILED | provider=%s model=%s latency=%dms error=%s",
            provider_name, model, latency_ms, error_message,
        )

        if isinstance(e, asyncio.TimeoutError) or isinstance(e, TimeoutError):
            raise TimeoutError(error_message) from e
            
        raise


def _write_usage_log(
    db: Session,
    project_id: str,
    user_llm_key_id: str,
    task_id: Optional[str],
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    estimated_cost_usd: Optional[float],
    latency_ms: int,
    status: str,
    error_message: Optional[str],
) -> None:
    """Write a single LLMUsageLog row. This is extracted so success and
    failure paths share the exact same write logic with no drift."""
    log_entry = LLMUsageLog(
        project_id=project_id,
        user_llm_key_id=user_llm_key_id,
        task_id=task_id,
        provider=provider,  # stored as string, validated upstream
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimated_cost_usd,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
    )
    db.add(log_entry)
    db.commit()


def flush_usage_logs(db: Session, entries: list) -> int:
    """Write deferred usage-log rows (see ``usage_sink``) in one commit.

    Clears ``entries`` in place and returns the number written. Must be
    called from the single coroutine that owns the Session.
    """
    if not entries:
        return 0
    batch = list(entries)
    entries.clear()
    for kw in batch:
        db.add(LLMUsageLog(**kw))
    db.commit()
    return len(batch)
