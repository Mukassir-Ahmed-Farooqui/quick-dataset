"""Dataset Items API — review, confirm, delete, and generate answers for questions."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, bad_request
from app.models import User, DatasetType as DatasetTypeEnum
from app.repositories.question_repository import QuestionRepository
from app.services.generation.answer_generator import DatasetItemRepository
from app.services.generation.answer_generator import generate_answers
from app.services.generation.estimator import estimate_answer_generation
from app.schemas import (
    GenerationConfigBase,
    TaskAcceptedResponse,
    GenerationEstimateResponse,
    PaginatedResponse,
    pagination_meta,
)
from app.schemas_extended import (
    AnswerGenerateRequest,
    DatasetItemOut,
    DatasetItemUpdate,
    DatasetBulkConfirmRequest,
    DatasetBulkDeleteRequest,
    DatasetListFilters,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/dataset-items", tags=["dataset-items"])


# ── Answer Generation Estimate ───────────────────────────────────────

@router.post("/estimate", response_model=GenerationEstimateResponse)
def estimate_answers(
    project_id: str,
    data: AnswerGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estimate answer generation cost without calling the LLM."""
    if not data.question_ids:
        raise bad_request("At least one question_id is required")

    from app.repositories.llm_key_repository import LLMKeyRepository
    key_repo = LLMKeyRepository(db)
    key = key_repo.get_default_key(str(current_user.id))
    provider = key.provider.value if key else "openai"

    return estimate_answer_generation(
        question_count=len(data.question_ids),
        provider=provider,
    )


# ── Answer Generation ────────────────────────────────────────────────

@router.post("/generate", response_model=TaskAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_answers_endpoint(
    project_id: str,
    data: AnswerGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate answers for selected questions via LLM.

    Returns 202 Accepted with real task_id and generation_run_id immediately.
    Actual generation runs in the background. Frontend polls task/{id} for status.
    """
    if not data.question_ids:
        raise bad_request("At least one question_id is required")

    # Validate questions exist
    question_repo = QuestionRepository(db)
    for qid in data.question_ids:
        q = question_repo.get_question(project_id, qid)
        if not q:
            raise not_found(f"Question {qid}")

    # Resolve LLM config synchronously to fail fast if no key configured
    from app.services.generation.resolver import resolve_llm_config_with_model
    try:
        resolve_llm_config_with_model(
            db, project_id, str(current_user.id),
            model="gpt-4o-mini",
            llm_key_id=data.llm_key_id,
            temperature=data.temperature_override or 0.7,
            max_tokens=data.max_tokens_override or 4096,
        )
    except Exception as e:
        raise bad_request(f"Cannot start generation: {str(e)}", "LLM_CONFIG_FAILED")

    # Create GenerationRun + Task synchronously so frontend gets real IDs
    from app.models import GenerationRunType, PromptType
    from app.repositories.task_repository import TaskRepository
    from app.services.generation.generation_run_service import GenerationRunService
    from app.services.prompts.prompt_service import PromptService

    prompt_svc = PromptService(db)
    prompt_out = prompt_svc.get_active_prompt(project_id, PromptType.answer)

    run_svc = GenerationRunService(db)
    run = run_svc.create_run(
        project_id=project_id,
        run_type=GenerationRunType.answer_generation,
        model_name="gpt-4o-mini",
        dataset_type=DatasetTypeEnum(data.dataset_type),
        prompt_type=PromptType.answer,
        prompt_version=prompt_out.version,
        total_items=len(data.question_ids),
    )

    task_repo = TaskRepository(db)
    task = task_repo.create_task(
        project_id=project_id,
        task_type="answer-generation",
        total_count=len(data.question_ids),
        generation_run_id=str(run.id),
    )

    # Launch background task with pre-created run + task
    async def _run_in_background():
        from app.core.database import SessionLocal
        bg_db = SessionLocal()
        try:
            result = await generate_answers(
                db=bg_db,
                project_id=project_id,
                user_id=str(current_user.id),
                question_ids=data.question_ids,
                dataset_type=DatasetTypeEnum(data.dataset_type),
                llm_key_id=data.llm_key_id,
                model="gpt-4o-mini",
                temperature=data.temperature_override or 0.7,
                max_tokens=data.max_tokens_override or 4096,
                existing_run_id=str(run.id),
                existing_task_id=str(task.id),
            )
            logger.info(
                "Answer generation complete | task=%s run=%s",
                result.get("task_id"), result.get("generation_run_id"),
            )
        except Exception as e:
            logger.error("Answer generation background task failed: %s", str(e))
            # Mark task and run as failed if not already done
            try:
                from app.repositories.task_repository import TaskRepository as TR
                tr = TR(bg_db)
                tr.fail_task(str(task.id), str(e))
                from app.services.generation.generation_run_service import GenerationRunService as GRS
                grs = GRS(bg_db)
                grs.fail_run(str(run.id), error_message=str(e))
            except Exception:
                pass
        finally:
            bg_db.close()

    background_tasks.add_task(_run_in_background)

    return TaskAcceptedResponse(
        task_id=str(task.id),
        generation_run_id=str(run.id),
    )


# ── List ─────────────────────────────────────────────────────────────

@router.get("")
def list_dataset_items(
    project_id: str,
    dataset_type: Optional[str] = Query(None),
    confirmed: Optional[bool] = Query(None),
    min_score: Optional[float] = Query(None, ge=0.0, le=1.0),
    generation_run_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List dataset items with filters."""
    repo = DatasetItemRepository(db)
    rows = repo.list_items(
        project_id,
        dataset_type=dataset_type,
        confirmed=confirmed,
        min_score=min_score,
        generation_run_id=generation_run_id,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    total = repo.count_items(
        project_id,
        dataset_type=dataset_type,
        confirmed=confirmed,
        min_score=min_score,
        generation_run_id=generation_run_id,
    )
    items = [DatasetItemOut.model_validate(r) for r in rows]
    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))


# ── Get ──────────────────────────────────────────────────────────────

@router.get("/{item_id}", response_model=DatasetItemOut)
def get_dataset_item(
    project_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = DatasetItemRepository(db)
    item = repo.get_item(project_id, item_id)
    if not item:
        raise not_found("Dataset Item")
    return item


# ── Update ───────────────────────────────────────────────────────────

@router.patch("/{item_id}", response_model=DatasetItemOut)
def update_dataset_item(
    project_id: str,
    item_id: str,
    data: DatasetItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a dataset item (payload, cot, confirmed status)."""
    repo = DatasetItemRepository(db)
    kwargs = {}
    if data.payload is not None:
        kwargs["payload"] = data.payload
    if data.cot is not None:
        kwargs["cot"] = data.cot
    if data.confirmed is not None:
        kwargs["confirmed"] = data.confirmed

    item = repo.update_item(project_id, item_id, **kwargs)
    if not item:
        raise not_found("Dataset Item")
    return item


# ── Bulk Confirm ─────────────────────────────────────────────────────

@router.post("/bulk-confirm")
def bulk_confirm_items(
    project_id: str,
    data: DatasetBulkConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk confirm or unconfirm dataset items."""
    repo = DatasetItemRepository(db)
    count = repo.bulk_confirm(project_id, data.ids, data.confirmed)
    return {"updated": count}


# ── Bulk Delete ──────────────────────────────────────────────────────

@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_items(
    project_id: str,
    data: DatasetBulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk soft-delete dataset items."""
    repo = DatasetItemRepository(db)
    repo.bulk_delete(project_id, data.ids)
    return None
