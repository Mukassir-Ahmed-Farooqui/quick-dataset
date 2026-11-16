"""
Question Generator — generates questions from chunks + GA pairs.

Pipeline (Easy Dataset logic, see lib/services/questions):
    resolve_llm_config() -> plan jobs -> LLMRunner (concurrent tracked_complete)
    -> parse / clean / dedupe -> Question rows

- Question count scales with chunk length (``auto`` mode) and GA pairs are
  distributed across chunks; the legacy cross product is still available
  (``per_combination``). See ``planning.py``.
- Each prompt gets the chunk with its section prefix and the FULL
  genre/audience descriptions inside Easy Dataset's GA guidance block.
- LLM calls run concurrently; all DB writes happen in the consuming
  coroutine (SQLAlchemy Session is not shared across coroutines).
- Every LLM call goes through tracked_complete() — never a bare provider call.
"""

import logging
import random
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Chunk, GAPair, Question, PromptType, DatasetType
from app.repositories.task_repository import TaskRepository
from app.services.generation.context import (
    GA_QUESTION_CHECK,
    GA_QUESTION_NOTE,
    build_chunk_context,
    ga_values,
    render_ga_question_block,
    render_prompt,
)
from app.services.generation.generation_run_service import GenerationRunService
from app.services.generation.llm_runner import LLMRunner
from app.services.generation.planning import (
    DEFAULT_CHARS_PER_QUESTION,
    DEFAULT_MAX_QUESTIONS_PER_CHUNK,
    ChunkInfo,
    GAInfo,
    QuestionJob,
    plan_question_jobs,
)
from app.services.generation.question_postprocess import dedupe_questions, postprocess_questions
from app.services.generation.resolver import resolve_llm_config_with_model
from app.services.prompts.prompt_service import PromptService

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"
PARSE_RETRIES = 1          # re-ask once when a response yields no usable question
MAX_CONTEXT_TOKENS = 6000  # token-aware cap on chunk text sent to the LLM
MAX_ERROR_LOG = 50


def build_question_prompt(
    template: str,
    *,
    chunk_text: str,
    chunk_metadata: Optional[dict],
    count: int,
    ga_pair: Optional[dict],
    max_context_tokens: int = MAX_CONTEXT_TOKENS,
) -> str:
    """Render the question prompt for one (chunk, GA pair, count) job."""
    content = build_chunk_context(chunk_text, chunk_metadata, max_tokens=max_context_tokens)
    genre, audience = ga_values(ga_pair)
    ga_block = render_ga_question_block(genre, audience)
    return render_prompt(template, {
        "content": content,
        "text": content,
        "text_length": len(chunk_text or ""),
        "textLength": len(chunk_text or ""),
        "questions_per_combination": count,
        "number": count,
        "genre": genre or "General",
        "audience": audience or "General audience",
        "ga_prompt": ga_block,
        "gaPrompt": ga_block,
        "ga_prompt_note": GA_QUESTION_NOTE if ga_block else "",
        "gaPromptNote": GA_QUESTION_NOTE if ga_block else "",
        "ga_prompt_check": GA_QUESTION_CHECK if ga_block else "",
        "gaPromptCheck": GA_QUESTION_CHECK if ga_block else "",
    })


async def generate_questions(
    db: Session,
    project_id: str,
    user_id: str,
    chunk_ids: list[str],
    task_id: str,
    generation_run_id: str,
    ga_pair_ids: Optional[list[str]] = None,
    *,
    questions_per_combination: int = 1,
    dataset_type: DatasetType = DatasetType.qa,
    llm_key_id: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    question_count_mode: str = "auto",
    chars_per_question: Optional[int] = None,
    max_questions_per_chunk: Optional[int] = None,
    question_mark_removal_probability: float = 0.0,
    concurrency: Optional[int] = None,
    dedupe_against_existing: bool = True,
    seed: Optional[int] = None,
) -> None:
    """Generate questions for specified chunks and GA pairs (background task entry point)."""
    task_repo = TaskRepository(db)
    run_svc = GenerationRunService(db)
    prompt_svc = PromptService(db)

    # 1. Load chunks (preserving request order) and snapshot to plain dicts —
    #    worker coroutines must never touch ORM objects / the Session.
    rows = (
        db.query(Chunk)
        .filter(Chunk.project_id == project_id, Chunk.id.in_(chunk_ids), Chunk.deleted_at.is_(None))
        .all()
    )
    by_id = {str(c.id): c for c in rows}
    chunks: dict[str, dict] = {}
    for cid in chunk_ids:
        c = by_id.get(str(cid))
        if c is None:
            logger.warning("Chunk %s not found, skipping", cid)
            continue
        chunks[str(c.id)] = {
            "id": str(c.id),
            "document_id": str(c.document_id) if c.document_id else None,
            "content": c.content or "",
            "metadata": c.chunk_metadata if isinstance(c.chunk_metadata, dict) else None,
        }
    if not chunks:
        raise ValueError("No valid chunks found for the given chunk_ids")

    # 2. GA pairs (none selected -> generate without a GA perspective)
    ga_pairs: dict[Optional[str], Optional[dict]] = {}
    if ga_pair_ids:
        pair_rows = (
            db.query(GAPair)
            .filter(GAPair.project_id == project_id, GAPair.id.in_(ga_pair_ids))
            .all()
        )
        for p in pair_rows:
            ga_pairs[str(p.id)] = {
                "id": str(p.id),
                "document_id": str(p.document_id) if p.document_id else None,
                "genre_title": p.genre_title,
                "genre_description": p.genre_description,
                "audience_title": p.audience_title,
                "audience_description": p.audience_description,
            }
        if not ga_pairs:
            raise ValueError("No valid GA pairs found")

    # 3. Prompt + LLM config
    prompt_template = prompt_svc.get_active_prompt(project_id, PromptType.question).content
    config = resolve_llm_config_with_model(
        db, project_id, user_id,
        model=model, llm_key_id=llm_key_id,
        temperature=temperature, max_tokens=max_tokens,
    )

    # 4. Plan the LLM calls
    jobs: list[QuestionJob] = plan_question_jobs(
        [ChunkInfo(c["id"], c["document_id"], len(c["content"])) for c in chunks.values()],
        [GAInfo(p["id"], p["document_id"]) for p in ga_pairs.values() if p],
        mode=question_count_mode,
        questions_per_combination=questions_per_combination,
        chars_per_question=chars_per_question or DEFAULT_CHARS_PER_QUESTION,
        max_questions_per_chunk=max_questions_per_chunk or DEFAULT_MAX_QUESTIONS_PER_CHUNK,
    )
    total_expected = sum(j.count for j in jobs)

    # 5. Existing questions per chunk, so reruns don't recreate duplicates
    accepted: dict[str, list[str]] = defaultdict(list)
    if dedupe_against_existing:
        for chunk_id, text in (
            db.query(Question.chunk_id, Question.question)
            .filter(
                Question.project_id == project_id,
                Question.chunk_id.in_(list(chunks)),
                Question.deleted_at.is_(None),
            )
            .all()
        ):
            accepted[str(chunk_id)].append(text)

    # 6. Start task + run; the plan decides the real totals
    task_repo.start_task(task_id)
    run_svc.start_run(generation_run_id)
    task = task_repo.get_task(task_id)
    if task is not None:
        task.total_count = len(jobs)
    run = run_svc.get_run(generation_run_id)
    if run is not None:
        run.total_items = total_expected
    db.commit()

    logger.info(
        "Question generation starting | project=%s chunks=%d ga_pairs=%d mode=%s calls=%d expected=%d",
        project_id, len(chunks), len(ga_pairs), question_count_mode, len(jobs), total_expected,
    )

    runner = LLMRunner(db, project_id, config, model, task_id=task_id, concurrency=concurrency, seed=seed)
    rng = random.Random(seed)
    errors: list[dict] = []
    pending: list[Question] = []
    created = 0
    processed = 0

    async def worker(job: QuestionJob) -> list[str]:
        chunk = chunks[job.chunk_id]
        prompt = build_question_prompt(
            prompt_template,
            chunk_text=chunk["content"],
            chunk_metadata=chunk["metadata"],
            count=job.count,
            ga_pair=ga_pairs.get(job.ga_pair_id),
        )
        questions: list[str] = []
        for _ in range(PARSE_RETRIES + 1):
            raw = await runner.complete(prompt, temperature=temperature, max_tokens=max_tokens)
            questions = postprocess_questions(
                raw, limit=job.count,
                question_mark_removal_probability=question_mark_removal_probability, rng=rng,
            )
            if questions:
                break
        return questions

    def on_result(job: QuestionJob, questions: Optional[list[str]], error: Optional[BaseException]) -> None:
        nonlocal processed
        processed += 1
        if error is not None:
            errors.append({"item_id": job.chunk_id, "message": f"LLM call failed: {error}"})
            return
        if not questions:
            errors.append({"item_id": job.chunk_id, "message": "Could not parse any valid questions from LLM output"})
            return
        fresh = dedupe_questions(questions, existing=accepted[job.chunk_id])
        accepted[job.chunk_id].extend(fresh)
        for text in fresh:
            pending.append(Question(
                project_id=project_id,
                chunk_id=job.chunk_id,
                ga_pair_id=job.ga_pair_id,
                generation_run_id=generation_run_id,
                question=text,
            ))

    def on_flush(n_done: int) -> bool:
        nonlocal created
        if pending:
            db.add_all(pending)
            created += len(pending)
            pending.clear()
        db.commit()
        task_repo.update_progress(task_id, completed_increment=n_done)
        t = task_repo.get_task(task_id)
        return bool(t is not None and t.cancel_requested)

    try:
        await runner.run_all(jobs, worker, on_result, on_flush=on_flush)
        if pending:
            on_flush(0)

        run_svc.complete_run(generation_run_id, processed_items=created, total_items=created)
        task_repo.complete_task(
            task_id,
            completed_count=processed,
            error_count=len(errors),
            total_count=len(jobs),
        )
        _append_error_log(db, task_repo, task_id, errors)

        logger.info(
            "Question generation complete | project=%s calls=%d questions=%d errors=%d peak_concurrency=%d",
            project_id, len(jobs), created, len(errors), runner.peak_in_flight,
        )
    except Exception as e:
        logger.error("Question generation failed | project=%s error=%s", project_id, str(e))
        db.rollback()
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


def _parse_questions_output(raw_output: str, expected_count: int) -> list[str]:
    """Backward-compatible helper: parse + clean + dedupe, capped at expected_count."""
    return postprocess_questions(raw_output, limit=expected_count)
