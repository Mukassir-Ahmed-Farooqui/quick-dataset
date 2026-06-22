"""
GA Pair Generator — first real consumer of the generation infrastructure.

Validates the entire chain end-to-end:
    resolve_llm_config() → tracked_complete() → GenerationRunService
    → PromptService → TaskRepository → GAPairRepository

Design:
- Generates Genre/Audience pairs per document via LLM.
- Each document produces N pairs (controlled by pairs_per_document).
- Output must be valid JSON matching the GenreAudiencePair schema.
- Malformed output is retried once per document, then skipped.
- Every LLM call goes through tracked_complete() — never a bare provider call.
"""

import json
import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.models import GAPair, GenerationRunType, PromptType
from app.repositories.ga_pair_repository import GAPairRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.document_repository import DocumentRepository
from app.services.generation.resolver import resolve_llm_config_with_model
from app.services.generation.generation_run_service import GenerationRunService
from app.services.llm.tracked_call import tracked_complete
from app.services.prompts.prompt_service import PromptService
from app.core.exceptions import bad_request

logger = logging.getLogger(__name__)

# Default model for GA generation
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_PAIRS_PER_DOC = 3
MAX_RETRIES = 1  # retry malformed output once per document


async def generate_ga_pairs(
    db: Session,
    project_id: str,
    user_id: str,
    document_ids: list[str],
    *,
    pairs_per_document: int = DEFAULT_PAIRS_PER_DOC,
    llm_key_id: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> dict:
    """Generate GA pairs for the specified documents.

    This is the background task entry point. It manages the full lifecycle:
    1. Creates GenerationRun + Task
    2. Loads prompt
    3. Resolves LLM config
    4. Calls LLM per document
    5. Parses + validates JSON output
    6. Creates GA pair rows
    7. Completes/fails run and task

    Args:
        db: Active DB session (caller creates/finalizes).
        project_id: Project scope.
        user_id: Current user id.
        document_ids: Documents to generate pairs for.
        pairs_per_document: Number of pairs per document.
        llm_key_id: Optional LLM key override.
        model: Model name for generation.
        temperature: Sampling temperature.
        max_tokens: Max tokens for response.

    Returns:
        dict with task_id and generation_run_id.
    """
    doc_repo = DocumentRepository(db)
    pair_repo = GAPairRepository(db)
    task_repo = TaskRepository(db)
    run_svc = GenerationRunService(db)
    prompt_svc = PromptService(db)

    # 1. Load prompt
    prompt_out = prompt_svc.get_active_prompt(project_id, PromptType.ga)
    prompt_template = prompt_out.content
    prompt_version = prompt_out.version

    # 2. Resolve LLM config
    config = resolve_llm_config_with_model(
        db, project_id, user_id,
        model=model,
        llm_key_id=llm_key_id,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    # 3. Create generation run
    total_expected = len(document_ids) * pairs_per_document
    run = run_svc.create_run(
        project_id=project_id,
        run_type=GenerationRunType.ga_generation,
        model_name=model,
        prompt_type=PromptType.ga,
        prompt_version=prompt_version,
        total_items=total_expected,
    )

    # 4. Create task
    task = task_repo.create_task(
        project_id=project_id,
        task_type="ga-generation",
        total_count=len(document_ids),
        generation_run_id=str(run.id),
    )
    task_repo.start_task(str(task.id))
    run_svc.start_run(str(run.id))

    # 5. Generate pairs per document
    all_pairs: list[GAPair] = []
    errors: list[dict] = []
    processed_docs = 0

    try:
        for doc_id in document_ids:
            doc = doc_repo.get_document(project_id, doc_id)
            if not doc:
                errors.append({"item_id": doc_id, "message": "Document not found"})
                continue

            # Build prompt with document content
            # Load document text from storage
            content = _load_document_content(project_id, doc.filename)

            if not content:
                errors.append({"item_id": doc_id, "message": f"No content available for {doc.filename}"})
                continue

            prompt = prompt_template.replace("{content}", content[:8000])
            prompt = prompt.replace("{pairs_per_document}", str(pairs_per_document))

            # Call LLM with retry
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
                        task_id=str(task.id),
                    )
                    raw_output = response.content
                    break
                except Exception as e:
                    last_error = str(e)
                    logger.warning(
                        "GA generation LLM call failed (attempt %d/%d) | doc=%s error=%s",
                        attempt + 1, MAX_RETRIES + 1, doc_id, last_error,
                    )

            if raw_output is None:
                errors.append({"item_id": doc_id, "message": f"LLM call failed after {MAX_RETRIES + 1} attempts: {last_error}"})
                continue

            # Parse JSON output
            pairs_data = _parse_ga_output(raw_output)

            if pairs_data is None:
                errors.append({"item_id": doc_id, "message": "Malformed LLM output — could not parse JSON"})
                continue

            # Create GA pair rows
            for pair_data in pairs_data:
                try:
                    genre = pair_data.get("genre", {})
                    audience = pair_data.get("audience", {})
                    pair = GAPair(
                        project_id=project_id,
                        document_id=doc_id,
                        genre_title=genre.get("title", "")[:128],
                        genre_description=genre.get("description"),
                        audience_title=audience.get("title", "")[:128],
                        audience_description=audience.get("description"),
                    )
                    all_pairs.append(pair)
                except Exception as e:
                    errors.append({"item_id": doc_id, "message": f"Failed to create pair row: {str(e)}"})

            processed_docs += 1
            task_repo.update_progress(str(task.id), completed_increment=1)

        # Bulk insert all pairs
        if all_pairs:
            pair_repo.bulk_create(all_pairs)

        # Complete run
        run_svc.complete_run(
            str(run.id),
            processed_items=len(all_pairs),
            total_items=len(all_pairs),
        )

        # Complete task — called ONCE at the very end, NOT in the loop
        task_repo.complete_task(
            str(task.id),
            completed_count=processed_docs,
            error_count=len(errors),
            total_count=len(document_ids),
        )

        logger.info(
            "GA generation complete | project=%s docs=%d pairs=%d errors=%d",
            project_id, processed_docs, len(all_pairs), len(errors),
        )

    except Exception as e:
        logger.error("GA generation failed | project=%s error=%s", project_id, str(e))
        run_svc.fail_run(str(run.id), error_message=str(e), processed_items=len(all_pairs))
        task_repo.fail_task(str(task.id), str(e))
        raise

    return {
        "task_id": str(task.id),
        "generation_run_id": str(run.id),
    }


def _parse_ga_output(raw_output: str) -> Optional[list[dict]]:
    """Parse LLM output into a list of Genre/Audience pair dicts.

    Attempts to extract JSON from:
    1. Pure JSON array
    2. JSON wrapped in markdown code blocks
    3. Text containing JSON array anywhere

    Returns None if parsing fails after all attempts.
    """
    if not raw_output:
        return None

    # Strategy 1: Strip markdown code fences
    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        # Remove opening fence
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned
        # Remove closing fence
        if "```" in cleaned:
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    # Strategy 2: Try to find JSON array in the text
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # Strategy 3: Find array between [ and ] anywhere in text
    import re
    match = re.search(r"\[[\s\S]*\]", cleaned)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    return None


def _load_document_content(project_id: str, filename: str) -> Optional[str]:
    """Load document content from storage.

    Tries parsed markdown first, then raw content.
    """
    import os
    STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage")

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
