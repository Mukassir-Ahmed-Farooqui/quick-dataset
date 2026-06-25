"""
Question Generator — generates questions from chunks + GA pairs.

Follows the exact same architecture as ga_generator.py:
    resolve_llm_config() → tracked_complete() → GenerationRunService
    → PromptService → TaskRepository → QuestionRepository

Generates combinatorially: N chunks × M GA pairs × Q questions_per_combination.
Every LLM call goes through tracked_complete() — never a bare provider call.
"""

import json
import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.models import Question, GenerationRunType, PromptType, DatasetType
from app.repositories.question_repository import QuestionRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.ga_pair_repository import GAPairRepository
from app.services.generation.resolver import resolve_llm_config_with_model
from app.services.generation.generation_run_service import GenerationRunService
from app.services.llm.tracked_call import tracked_complete
from app.services.prompts.prompt_service import PromptService

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"
MAX_RETRIES = 2


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
) -> None:
    """Generate questions for specified chunks and GA pairs.

    This is the background task entry point. Manages full lifecycle:
    1. Loads chunks + GA pairs
    2. Loads prompt
    3. Resolves LLM config
    4. For each (chunk, GA pair) combination, calls LLM
    5. Parses output and creates Question rows
    6. Completes/fails run and task

    Args:
        task_id: Background task ID.
        generation_run_id: Generation run ID.
    """
    chunk_repo = ChunkRepository(db)
    ga_pair_repo = GAPairRepository(db)
    question_repo = QuestionRepository(db)
    task_repo = TaskRepository(db)
    run_svc = GenerationRunService(db)
    prompt_svc = PromptService(db)

    # 1. Load chunks
    all_chunks = []
    for cid in chunk_ids:
        chunk = chunk_repo.get_chunk(project_id, cid)
        if chunk:
            all_chunks.append(chunk)
        else:
            logger.warning("Chunk %s not found, skipping", cid)

    if not all_chunks:
        raise ValueError("No valid chunks found for the given chunk_ids")

    # 2. Load GA pairs (or create a default "no genre/audience" placeholder)
    all_ga_pairs = []
    if ga_pair_ids:
        for gid in ga_pair_ids:
            pair = ga_pair_repo.get_pair(project_id, gid)
            if pair:
                all_ga_pairs.append(pair)
    else:
        # Use a dummy pair when no GA pairs selected
        class DummyPair:
            id = None
            genre_title = "General"
            genre_description = "General understanding"
            audience_title = "General audience"
            audience_description = "General audience"

        all_ga_pairs = [DummyPair()]

    if not all_ga_pairs:
        raise ValueError("No valid GA pairs found")

    # 3. Load prompt
    prompt_out = prompt_svc.get_active_prompt(project_id, PromptType.question)
    prompt_template = prompt_out.content
    prompt_version = prompt_out.version

    # 4. Resolve LLM config
    config = resolve_llm_config_with_model(
        db, project_id, user_id,
        model=model,
        llm_key_id=llm_key_id,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    # 5. Compute expected total
    total_expected = len(all_chunks) * len(all_ga_pairs) * questions_per_combination
    total_combos = len(all_chunks) * len(all_ga_pairs)

    # 6. Start task and run
    task_repo.start_task(task_id)
    run_svc.start_run(generation_run_id)

    # 8. Generate questions per combination
    all_questions: list[Question] = []
    errors: list[dict] = []
    processed_combos = 0

    try:
        for chunk in all_chunks:
            for ga_pair in all_ga_pairs:
                genre = ga_pair.genre_title if hasattr(ga_pair, 'genre_title') else "General"
                audience = ga_pair.audience_title if hasattr(ga_pair, 'audience_title') else "General"

                # Build prompt with chunk content + GA pair context
                prompt = prompt_template.replace("{content}", chunk.content[:6000])
                prompt = prompt.replace("{genre}", genre)
                prompt = prompt.replace("{audience}", audience)
                prompt = prompt.replace("{questions_per_combination}", str(questions_per_combination))

                raw_output = None
                last_error = None

                for attempt in range(MAX_RETRIES + 1):
                    try:
                        response = await tracked_complete(
                            db=db,
                            project_id=project_id,
                            config=config,
                            messages=[{"role": "user", "content": prompt}],
                            model=model,
                            temperature=temperature,
                            max_tokens=max_tokens,
                            task_id=task_id,
                        )
                        raw_output = response.content
                        break
                    except Exception as e:
                        last_error = str(e)
                        logger.warning(
                            "Question LLM call failed (attempt %d/%d) | chunk=%s ga=%s error=%s",
                            attempt + 1, MAX_RETRIES + 1, chunk.id, ga_pair.id, last_error,
                        )

                if raw_output is None:
                    errors.append({
                        "item_id": chunk.id,
                        "message": f"LLM call failed after {MAX_RETRIES + 1} attempts: {last_error}",
                    })
                    continue

                # Parse questions from output
                question_texts = _parse_questions_output(raw_output, questions_per_combination)

                if not question_texts:
                    errors.append({
                        "item_id": chunk.id,
                        "message": "Could not parse any questions from LLM output",
                    })

                for q_text in question_texts:
                    try:
                        q = Question(
                            project_id=project_id,
                            chunk_id=chunk.id,
                            ga_pair_id=ga_pair.id if hasattr(ga_pair, 'id') else None,
                            generation_run_id=generation_run_id,
                            question=q_text,
                        )
                        all_questions.append(q)
                    except Exception as e:
                        errors.append({
                            "item_id": chunk.id,
                            "message": f"Failed to create question row: {str(e)}",
                        })

                processed_combos += 1
                task_repo.update_progress(task_id, completed_increment=1)

        # Bulk insert all questions
        if all_questions:
            question_repo.bulk_create(all_questions)

        # Complete run
        run_svc.complete_run(
            generation_run_id,
            processed_items=len(all_questions),
            total_items=len(all_questions),
        )

        # Complete task
        task_repo.complete_task(
            task_id,
            completed_count=processed_combos,
            error_count=len(errors),
            total_count=total_combos,
        )

        logger.info(
            "Question generation complete | project=%s chunks=%d ga_pairs=%d questions=%d errors=%d",
            project_id, len(all_chunks), len(all_ga_pairs), len(all_questions), len(errors),
        )

    except Exception as e:
        logger.error("Question generation failed | project=%s error=%s", project_id, str(e))
        run_svc.fail_run(generation_run_id, error_message=str(e), processed_items=len(all_questions))
        task_repo.fail_task(task_id, str(e))
        raise


def _parse_questions_output(raw_output: str, expected_count: int) -> list[str]:
    """Parse LLM output into a list of question strings.

    Handles:
    1. JSON array of strings (with or without markdown code fences)
    2. One question per line (with or without trailing ?)
    3. Numbered lists (1., 2., etc.)
    4. Bullet lists (-, *)
    5. Paragraph with multiple sentences ending in ?

    The critical pattern: if LLM wraps JSON in ```json ... ```, the code
    fences MUST be removed BEFORE JSON parsing is attempted. Previous bug:
    JSON inside code fences was never parsed as JSON, producing garbage
    like '[\"Q1?' as question text.
    """
    import re

    if not raw_output:
        return []

    cleaned = raw_output.strip()

    # Strategy 1: Strip markdown code fences FIRST (before JSON parse)
    # This handles ```json [...]``` and ```[...]``` patterns
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove opening fence line (```json or ```)
        cleaned = "\n".join(lines[1:])
        # Remove closing fence
        if "```" in cleaned:
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    # Strategy 2: JSON array of strings (after code fence removal, so
    # ```json [...]``` works correctly now)
    if cleaned.startswith("["):
        try:
            data = json.loads(cleaned)
            if isinstance(data, list) and all(isinstance(s, str) for s in data):
                # Successfully parsed JSON array — join into lines for final cleanup
                cleaned = "\n".join(data)
        except json.JSONDecodeError:
            pass

    # Strategy 3: Split into lines and extract questions
    questions: list[str] = []
    for line in cleaned.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Remove numbering/bullets
        processed = re.sub(r"^\d+[\.\)、]\s*", "", line)
        processed = re.sub(r"^[-*]\s+", "", processed)
        # Remove quotes if the whole line is wrapped
        processed = processed.strip("\"'")
        processed = processed.strip()

        if len(processed) > 10:
            if processed.endswith("?"):
                questions.append(processed)
            else:
                q_mark = processed.find("?")
                if q_mark >= 0:
                    before = processed[:q_mark + 1].strip()
                    if len(before) > 10:
                        questions.append(before)
                else:
                    questions.append(processed)

    # Strategy 4: Fallback — split on ? if line-by-line gave nothing
    if not questions:
        parts = cleaned.split("?")
        for part in parts[:-1]:
            part = part.strip()
            sentences = re.split(r'[.!]\s+', part)
            last = sentences[-1].strip()
            if len(last) > 10:
                questions.append(last + "?")

    return questions[:expected_count]
