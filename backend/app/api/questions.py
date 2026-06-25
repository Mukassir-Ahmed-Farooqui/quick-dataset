"""Questions API — list, create, update, delete, bulk operations, generate, estimate."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, bad_request
from app.models import User, DatasetType as DatasetTypeEnum, PromptType, GenerationRunType
from app.repositories.question_repository import QuestionRepository
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.ga_pair_repository import GAPairRepository
from app.repositories.task_repository import TaskRepository
from app.services.generation.question_generator import generate_questions
from app.services.generation.estimator import estimate_question_generation
from app.schemas import (
    GenerationConfigBase,
    TaskAcceptedResponse,
    GenerationEstimateResponse,
    PaginatedResponse,
    pagination_meta,
    QuestionGenerateRequest,
)
from app.schemas_extended import (
    QuestionCreate,
    QuestionUpdate,
    QuestionOut,
    QuestionStatsResponse,
    QuestionBulkDeleteRequest,
    QuestionBulkUpdateRequest,
    QuestionListFilters,
)
from app.services.generation.generation_run_service import GenerationRunService
from app.services.generation.resolver import resolve_llm_config_with_model
from app.services.prompts.prompt_service import PromptService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/questions", tags=["questions"])


# ── Estimate ─────────────────────────────────────────────────────────

@router.post("/estimate", response_model=GenerationEstimateResponse)
def estimate_questions(
    project_id: str,
    data: QuestionGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estimate question generation cost without calling the LLM."""
    if not data.chunk_ids:
        raise bad_request("At least one chunk_id is required")

    chunk_repo = ChunkRepository(db)
    chunk_count = 0
    for cid in data.chunk_ids:
        if chunk_repo.get_chunk(project_id, cid):
            chunk_count += 1

    ga_pair_count = 0
    if data.ga_pair_ids:
        ga_repo = GAPairRepository(db)
        for gid in data.ga_pair_ids:
            if ga_repo.get_pair(project_id, gid):
                ga_pair_count += 1
    if ga_pair_count == 0:
        ga_pair_count = 1  # at minimum, there's always one combination

    # Resolve provider from project's default key
    from app.repositories.llm_key_repository import LLMKeyRepository
    key_repo = LLMKeyRepository(db)
    key = key_repo.get_default_key(str(current_user.id))
    provider = key.provider.value if key else "openai"

    return estimate_question_generation(
        chunk_count=chunk_count,
        ga_pair_count=ga_pair_count,
        questions_per_combination=data.questions_per_combination,
        provider=provider,
    )


# ── Generate ─────────────────────────────────────────────────────────

@router.post("/generate", response_model=TaskAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_questions_endpoint(
    project_id: str,
    data: QuestionGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate questions for selected chunks × GA pairs via LLM.

    Returns 202 Accepted with real task_id and generation_run_id.
    Actual generation runs in the background. Frontend polls task/{id} for status.
    """
    if not data.chunk_ids:
        raise bad_request("At least one chunk_id is required")

    chunk_repo = ChunkRepository(db)
    all_chunks = []
    for cid in data.chunk_ids:
        chunk = chunk_repo.get_chunk(project_id, cid)
        if not chunk:
            raise not_found(f"Chunk {cid}")
        all_chunks.append(chunk)

    if data.ga_pair_ids:
        ga_repo = GAPairRepository(db)
        for gid in data.ga_pair_ids:
            if not ga_repo.get_pair(project_id, gid):
                raise not_found(f"GA Pair {gid}")

    # Resolve LLM config synchronously to fail fast if no key configured
    try:
        config = resolve_llm_config_with_model(
            db, project_id, str(current_user.id),
            model="gpt-4o-mini",
            llm_key_id=data.llm_key_id,
            temperature=data.temperature_override or 0.7,
            max_tokens=data.max_tokens_override or 2048,
        )
    except Exception as e:
        raise bad_request(f"Cannot start generation: {str(e)}", "LLM_CONFIG_FAILED")

    # Create GenerationRun + Task synchronously so frontend gets real IDs
    total_expected = len(data.chunk_ids) * (len(data.ga_pair_ids) if data.ga_pair_ids else 1) * data.questions_per_combination
    total_combos = len(data.chunk_ids) * (len(data.ga_pair_ids) if data.ga_pair_ids else 1)

    prompt_svc = PromptService(db)
    prompt_out = prompt_svc.get_active_prompt(project_id, PromptType.question)

    run_svc = GenerationRunService(db)
    run = run_svc.create_run(
        project_id=project_id,
        run_type=GenerationRunType.question_generation,
        model_name="gpt-4o-mini",
        dataset_type=DatasetTypeEnum(data.dataset_type),
        prompt_type=PromptType.question,
        prompt_version=prompt_out.version,
        total_items=total_expected,
    )

    task_repo = TaskRepository(db)
    task = task_repo.create_task(
        project_id=project_id,
        task_type="question-generation",
        total_count=total_combos,
        generation_run_id=str(run.id),
    )

    # Launch background task with pre-created run + task
    async def _run_in_background():
        from app.core.database import SessionLocal
        bg_db = SessionLocal()
        try:
            await generate_questions(
                db=bg_db,
                project_id=project_id,
                user_id=str(current_user.id),
                chunk_ids=data.chunk_ids,
                ga_pair_ids=data.ga_pair_ids,
                task_id=str(task.id),
                generation_run_id=str(run.id),
                questions_per_combination=data.questions_per_combination,
                dataset_type=DatasetTypeEnum(data.dataset_type),
                llm_key_id=data.llm_key_id,
                model="gpt-4o-mini",
                temperature=data.temperature_override or 0.7,
                max_tokens=data.max_tokens_override or 2048,
            )
        except Exception as e:
            logger.error("Question generation background task failed: %s", str(e))
            # Mark task as failed if it hasn't been already
            try:
                tr = TaskRepository(bg_db)
                tr.fail_task(str(task.id), str(e))
                run_svc2 = GenerationRunService(bg_db)
                run_svc2.fail_run(str(run.id), error_message=str(e))
            except Exception:
                pass
        finally:
            bg_db.close()

    background_tasks.add_task(_run_in_background)

    return TaskAcceptedResponse(
        task_id=str(task.id),
        generation_run_id=str(run.id),
    )


# ── Stats ────────────────────────────────────────────────────────────

@router.get("/stats", response_model=QuestionStatsResponse)
def get_question_stats(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated statistics for questions grouped by document."""
    repo = QuestionRepository(db)
    return repo.get_question_stats(project_id)


# ── List ─────────────────────────────────────────────────────────────

@router.get("")
def list_questions(
    project_id: str,
    chunk_id: Optional[str] = Query(None),
    ga_pair_id: Optional[str] = Query(None),
    generation_run_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List questions for a project with filters and search."""
    repo = QuestionRepository(db)
    rows = repo.list_questions(
        project_id,
        chunk_id=chunk_id,
        ga_pair_id=ga_pair_id,
        generation_run_id=generation_run_id,
        status=status,
        search=search,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    total = repo.count_questions(
        project_id,
        chunk_id=chunk_id,
        ga_pair_id=ga_pair_id,
        generation_run_id=generation_run_id,
        status=status,
        search=search,
    )
    items = [QuestionOut.model_validate(r) for r in rows]
    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))


# ── Create (manual) ──────────────────────────────────────────────────

@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(
    project_id: str,
    data: QuestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually create a single question."""
    chunk_repo = ChunkRepository(db)
    if not chunk_repo.get_chunk(project_id, data.chunk_id):
        raise not_found("Chunk")

    repo = QuestionRepository(db)
    q = repo.create_question(
        project_id=project_id,
        chunk_id=data.chunk_id,
        ga_pair_id=data.ga_pair_id,
        question=data.question,
    )
    return q


# ── Get ──────────────────────────────────────────────────────────────

@router.get("/{question_id}", response_model=QuestionOut)
def get_question(
    project_id: str,
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = QuestionRepository(db)
    q = repo.get_question(project_id, question_id)
    if not q:
        raise not_found("Question")
    return q


# ── Update ───────────────────────────────────────────────────────────

@router.patch("/{question_id}", response_model=QuestionOut)
def update_question(
    project_id: str,
    question_id: str,
    data: QuestionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a question's text."""
    repo = QuestionRepository(db)
    q = repo.update_question(project_id, question_id, data.question)
    if not q:
        raise not_found("Question")
    return q


# ── Delete ───────────────────────────────────────────────────────────

@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    project_id: str,
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a question."""
    repo = QuestionRepository(db)
    success = repo.soft_delete_question(project_id, question_id)
    if not success:
        raise not_found("Question")
    return None


# ── Bulk Delete ──────────────────────────────────────────────────────

@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_questions(
    project_id: str,
    data: QuestionBulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk soft-delete questions by IDs."""
    repo = QuestionRepository(db)
    count = repo.bulk_delete(project_id, data.ids)
    logger.info("Bulk deleted %d questions from project %s", count, project_id)
    return None


# ── Bulk Update ──────────────────────────────────────────────────────

@router.post("/bulk-update")
def bulk_update_questions(
    project_id: str,
    data: QuestionBulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk update questions (e.g., mark answered)."""
    repo = QuestionRepository(db)
    updated = []
    for qid in data.ids:
        if data.patch.question is not None:
            q = repo.update_question(project_id, qid, data.patch.question)
        else:
            q = repo.mark_answered(project_id, qid)
        if q:
            updated.append(q)
    return {"updated": len(updated)}
