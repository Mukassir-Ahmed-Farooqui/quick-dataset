"""
GA Pair Generator — Genre/Audience pairs per document.

Pipeline (Easy Dataset's MGA approach, see lib/llm/prompts/ga-generation.js):
    resolve_llm_config() -> document digest -> LLMRunner (concurrent
    tracked_complete) -> shared JSON parser -> validate -> dedupe -> GAPair rows

- The prompt gets a representative *digest* of each document (outline +
  evenly spaced excerpts, see ``context.build_document_digest``) instead of
  only the first 8000 characters, so pairs fit the whole document.
- Documents run concurrently through :class:`LLMRunner`; worker coroutines
  never touch the Session — every DB write happens in the consuming
  coroutine (``on_result`` / ``on_flush``).
- Each pair must have genre AND audience, each with a title and a
  description; near-identical pairs are dropped (within a response and
  against pairs the document already has).
- Malformed output is re-asked once per document, then the document is
  recorded as an error.
- Every LLM call goes through tracked_complete() — never a bare provider call.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Iterable, Optional

from sqlalchemy.orm import Session

from app.models import Chunk, GAPair, PromptType
from app.repositories.document_repository import DocumentRepository
from app.repositories.task_repository import TaskRepository
from app.services.generation.context import build_document_digest, render_prompt
from app.services.generation.generation_run_service import GenerationRunService
from app.services.generation.json_utils import extract_json
from app.services.generation.llm_runner import LLMRunner
from app.services.generation.question_postprocess import is_near_duplicate, normalize_question
from app.services.generation.resolver import resolve_llm_config_with_model
from app.services.prompts.prompt_service import PromptService

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_PAIRS_PER_DOC = 3
MAX_RETRIES = 1            # re-ask once when a response yields no valid pair
DIGEST_MAX_CHARS = 12000   # document digest budget sent to the LLM
TITLE_MAX = 128            # GAPair.genre_title / audience_title column size
MAX_ERROR_LOG = 50

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage")


# ── Parsing / validation ─────────────────────────────────────────────

def _text(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _side(item: dict, key: str) -> tuple[str, str]:
    """(title, description) for 'genre' / 'audience', tolerating a few shapes."""
    v = item.get(key)
    if v is None:
        v = item.get(key.capitalize())
    if isinstance(v, dict):
        return _text(v.get("title") or v.get("name")), _text(v.get("description") or v.get("desc"))
    # Flat shape: {"genre_title": ..., "genre_description": ...}
    return _text(item.get(f"{key}_title")), _text(item.get(f"{key}_description"))


def validate_ga_pair(item: Any) -> Optional[dict]:
    """Return a normalized pair dict, or ``None`` when the item is invalid.

    Genre and audience each need a non-empty title and description.
    """
    if not isinstance(item, dict):
        return None
    gt, gd = _side(item, "genre")
    at, ad = _side(item, "audience")
    if not (gt and gd and at and ad):
        return None
    return {
        "genre_title": gt[:TITLE_MAX],
        "genre_description": gd,
        "audience_title": at[:TITLE_MAX],
        "audience_description": ad,
    }


def _is_dup_pair(a: dict, b: dict) -> bool:
    ga, gb = normalize_question(a["genre_title"]), normalize_question(b["genre_title"])
    aa, ab = normalize_question(a["audience_title"]), normalize_question(b["audience_title"])
    if not (ga and gb and aa and ab):
        return False
    return is_near_duplicate(ga, gb) and is_near_duplicate(aa, ab)


def dedupe_ga_pairs(pairs: Iterable[dict], existing: Iterable[dict] = ()) -> list[dict]:
    """Drop pairs whose genre AND audience titles are near-identical to an
    earlier pair (or one in ``existing``). Order is preserved."""
    seen: list[dict] = [e for e in existing if e]
    kept: list[dict] = []
    for p in pairs:
        if any(_is_dup_pair(p, s) for s in seen):
            continue
        kept.append(p)
        seen.append(p)
    return kept


def _parse_ga_output(raw_output: Optional[str]) -> Optional[list[dict]]:
    """Parse LLM output into validated, de-duplicated pair dicts.

    Returns ``None`` when nothing parseable was found, ``[]`` when JSON
    parsed but no element was a valid pair.
    """
    data = extract_json(raw_output, expect=list)
    if data is None:
        # A single pair object instead of an array
        obj = extract_json(raw_output, expect=dict)
        if isinstance(obj, dict) and ("genre" in obj or "genre_title" in obj):
            data = [obj]
    if not isinstance(data, list):
        return None
    valid = [v for v in (validate_ga_pair(d) for d in data) if v]
    return dedupe_ga_pairs(valid)


# ── Prompt / content ─────────────────────────────────────────────────

def build_ga_prompt(template: str, content: str, pairs_per_document: int,
                    max_chars: int = DIGEST_MAX_CHARS) -> str:
    digest = build_document_digest(content, max_chars=max_chars)
    return render_prompt(template, {
        "content": digest,
        "text": digest,
        "pairs_per_document": pairs_per_document,
        "number": pairs_per_document,
    })


def _load_document_content(project_id: str, filename: str) -> Optional[str]:
    """Load document text from storage: parsed markdown first, then raw."""
    md_path = os.path.join(STORAGE_DIR, project_id, filename + ".md")
    text_path = os.path.join(STORAGE_DIR, project_id, filename)
    path = md_path if os.path.exists(md_path) else text_path
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


def _load_content_from_chunks(db: Session, project_id: str, document_id: str) -> Optional[str]:
    """Fallback when the storage file is missing: re-join the document's chunks."""
    try:
        rows = (
            db.query(Chunk.content)
            .filter(
                Chunk.project_id == project_id,
                Chunk.document_id == document_id,
                Chunk.deleted_at.is_(None),
            )
            .order_by(Chunk.chunk_index)
            .all()
        )
    except Exception as exc:
        logger.warning("Could not load chunks for document %s: %s", document_id, exc)
        return None
    text = "\n\n".join(r[0] for r in rows if r and r[0])
    return text or None


def _existing_pairs(db: Session, project_id: str, document_ids: list[str]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {d: [] for d in document_ids}
    try:
        rows = (
            db.query(GAPair)
            .filter(GAPair.project_id == project_id, GAPair.document_id.in_(document_ids))
            .all()
        )
    except Exception as exc:
        logger.warning("Could not load existing GA pairs: %s", exc)
        return out
    for p in rows:
        out.setdefault(str(p.document_id), []).append({
            "genre_title": p.genre_title or "",
            "genre_description": p.genre_description or "",
            "audience_title": p.audience_title or "",
            "audience_description": p.audience_description or "",
        })
    return out


# ── Entry point ──────────────────────────────────────────────────────

async def generate_ga_pairs(
    db: Session,
    project_id: str,
    user_id: str,
    document_ids: list[str],
    task_id: str,
    generation_run_id: str,
    *,
    pairs_per_document: int = DEFAULT_PAIRS_PER_DOC,
    llm_key_id: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    concurrency: Optional[int] = None,
    dedupe_against_existing: bool = True,
    seed: Optional[int] = None,
) -> None:
    """Generate GA pairs for the specified documents (background task entry point)."""
    doc_repo = DocumentRepository(db)
    task_repo = TaskRepository(db)
    run_svc = GenerationRunService(db)
    prompt_svc = PromptService(db)
    pairs_per_document = max(1, int(pairs_per_document))

    # 1. Prompt + LLM config
    prompt_template = prompt_svc.get_active_prompt(project_id, PromptType.ga).content
    config = resolve_llm_config_with_model(
        db, project_id, user_id,
        model=model, llm_key_id=llm_key_id,
        temperature=temperature, max_tokens=max_tokens,
    )

    # 2. Start task + run
    task_repo.start_task(task_id)
    run_svc.start_run(generation_run_id)

    errors: list[dict] = []
    pending: list[GAPair] = []
    created = 0
    processed_docs = 0

    try:
        # 3. Snapshot document content (main coroutine only — workers never touch the DB)
        contents: dict[str, str] = {}
        for doc_id in document_ids:
            doc = doc_repo.get_document(project_id, doc_id)
            if not doc:
                errors.append({"item_id": doc_id, "message": "Document not found"})
                continue
            content = _load_document_content(project_id, doc.filename)
            if not content or not content.strip():
                content = _load_content_from_chunks(db, project_id, doc_id)
            if not content or not content.strip():
                errors.append({"item_id": doc_id, "message": f"No content available for {doc.filename}"})
                continue
            contents[str(doc_id)] = content

        existing = _existing_pairs(db, project_id, list(contents)) if (dedupe_against_existing and contents) else {}
        skipped = len(document_ids) - len(contents)
        if skipped:
            task_repo.update_progress(task_id, completed_increment=skipped)

        runner = LLMRunner(db, project_id, config, config.model or model, task_id=task_id, concurrency=concurrency, seed=seed)

        async def worker(doc_id: str) -> list[dict]:
            prompt = build_ga_prompt(prompt_template, contents[doc_id], pairs_per_document)
            pairs: list[dict] = []
            for _ in range(MAX_RETRIES + 1):
                raw = await runner.complete(prompt, temperature=temperature, max_tokens=max_tokens)
                pairs = _parse_ga_output(raw) or []
                if pairs:
                    break
            return pairs

        def on_result(doc_id: str, pairs: Optional[list[dict]], error: Optional[BaseException]) -> None:
            nonlocal processed_docs
            if error is not None:
                errors.append({"item_id": doc_id, "message": f"LLM call failed: {error}"})
                return
            if not pairs:
                errors.append({"item_id": doc_id, "message": "Malformed LLM output — no valid genre/audience pairs"})
                return
            prior = existing.setdefault(doc_id, [])
            fresh = dedupe_ga_pairs(pairs, existing=prior)[:pairs_per_document]
            prior.extend(fresh)
            processed_docs += 1
            for p in fresh:
                pending.append(GAPair(project_id=project_id, document_id=doc_id, **p))

        def on_flush(n_done: int) -> bool:
            nonlocal created
            if pending:
                db.add_all(pending)
                created += len(pending)
                pending.clear()
            db.commit()
            if n_done:
                task_repo.update_progress(task_id, completed_increment=n_done)
            t = task_repo.get_task(task_id)
            return bool(t is not None and getattr(t, "cancel_requested", False) is True)

        await runner.run_all(list(contents), worker, on_result, on_flush=on_flush)
        if pending:
            on_flush(0)

        run_svc.complete_run(generation_run_id, processed_items=created, total_items=created)
        task_repo.complete_task(
            task_id,
            completed_count=processed_docs,
            error_count=len(errors),
            total_count=len(document_ids),
        )
        _append_error_log(db, task_repo, task_id, errors)

        logger.info(
            "GA generation complete | project=%s docs=%d pairs=%d errors=%d peak_concurrency=%d",
            project_id, processed_docs, created, len(errors), runner.peak_in_flight,
        )
    except Exception as e:
        logger.error("GA generation failed | project=%s error=%s", project_id, str(e))
        try:
            db.rollback()
        except Exception:
            pass
        run_svc.fail_run(generation_run_id, error_message=str(e), processed_items=created)
        task_repo.fail_task(task_id, str(e))
        raise


def _append_error_log(db: Session, task_repo: TaskRepository, task_id: str, errors: list[dict]) -> None:
    if not errors:
        return
    task = task_repo.get_task(task_id)
    if task is None:
        return
    log = list(task.error_log or [])
    log.extend(errors[:MAX_ERROR_LOG])
    if len(errors) > MAX_ERROR_LOG:
        log.append({"item_id": None, "message": f"... and {len(errors) - MAX_ERROR_LOG} more errors"})
    task.error_log = log
    db.commit()
