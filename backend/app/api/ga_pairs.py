"""GA Pairs API — list, create, generate, estimate, update, delete."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, bad_request
from app.models import User
from app.repositories.ga_pair_repository import GAPairRepository
from app.repositories.document_repository import DocumentRepository
from app.services.generation.ga_generator import generate_ga_pairs
from app.services.generation.estimator import estimate_ga_generation
from app.schemas_extended import GAPairCreate, GAPairUpdate, GAPairOut
from app.schemas import (
    GenerationConfigBase,
    TaskAcceptedResponse,
    GenerationEstimateResponse,
    PaginatedResponse,
    pagination_meta,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/ga-pairs", tags=["ga-pairs"])


# ── GA Generate Request ─────────────────────────────────────────────

class GAGenerateRequest(GenerationConfigBase):
    document_ids: list[str]
    pairs_per_document: int = 3
    model: str = "gpt-4o-mini"


# ── Estimate ─────────────────────────────────────────────────────────

@router.post("/estimate", response_model=GenerationEstimateResponse)
def estimate_ga_pairs(
    project_id: str,
    data: GAGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estimate GA pair generation cost without calling the LLM."""
    if not data.document_ids:
        raise bad_request("At least one document_id is required")

    doc_repo = DocumentRepository(db)
    for doc_id in data.document_ids:
        if not doc_repo.get_document(project_id, doc_id):
            raise not_found(f"Document {doc_id}")

    return estimate_ga_generation(
        document_count=len(data.document_ids) * data.pairs_per_document,
        provider="",
        model=data.model,
    )


# ── Generate ─────────────────────────────────────────────────────────

@router.post("/generate", response_model=TaskAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_ga_pairs_endpoint(
    project_id: str,
    data: GAGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate GA pairs for selected documents via LLM.

    Returns 202 Accepted with task_id and generation_run_id immediately.
    Actual generation runs in the background.
    """
    if not data.document_ids:
        raise bad_request("At least one document_id is required")

    # Validate documents exist and belong to project
    doc_repo = DocumentRepository(db)
    for doc_id in data.document_ids:
        doc = doc_repo.get_document(project_id, doc_id)
        if not doc:
            raise not_found(f"Document {doc_id}")
        if doc.processing_status != "parsed":
            raise bad_request(f"Document '{doc.filename}' is not yet parsed (status: {doc.processing_status})")

    # Launch background task — everything happens inside, including run + task creation
    async def _run_in_background():
        from app.core.database import SessionLocal
        bg_db = SessionLocal()
        try:
            result = await generate_ga_pairs(
                db=bg_db,
                project_id=project_id,
                user_id=str(current_user.id),
                document_ids=data.document_ids,
                pairs_per_document=data.pairs_per_document,
                llm_key_id=data.llm_key_id,
                model=data.model,
                temperature=data.temperature_override or 0.7,
                max_tokens=data.max_tokens_override or 2048,
            )
            logger.info(
                "GA generation complete | task=%s run=%s",
                result.get("task_id"), result.get("generation_run_id"),
            )
        except Exception as e:
            logger.error("GA generation background task failed: %s", str(e))
        finally:
            bg_db.close()

    background_tasks.add_task(_run_in_background)

    return TaskAcceptedResponse(
        task_id="pending",
        generation_run_id="pending",
    )


# ── List ─────────────────────────────────────────────────────────────

@router.get("")
def list_ga_pairs(
    project_id: str,
    document_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List GA pairs for a project, optionally filtered by document."""
    repo = GAPairRepository(db)
    rows = repo.list_pairs(project_id, document_id=document_id, skip=(page - 1) * page_size, limit=page_size)
    total = repo.count_pairs(project_id, document_id=document_id)
    items = [GAPairOut.model_validate(r) for r in rows]
    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))


# ── Create (manual) ──────────────────────────────────────────────────

@router.post("", response_model=GAPairOut, status_code=status.HTTP_201_CREATED)
def create_ga_pair(
    project_id: str,
    data: GAPairCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually create a single GA pair."""
    doc_repo = DocumentRepository(db)
    if not doc_repo.get_document(project_id, data.document_id):
        raise not_found("Document")

    repo = GAPairRepository(db)
    pair = repo.create_pair(
        project_id=project_id,
        document_id=data.document_id,
        genre_title=data.genre_title,
        genre_description=data.genre_description,
        audience_title=data.audience_title,
        audience_description=data.audience_description,
    )
    return pair


# ── Update ───────────────────────────────────────────────────────────

@router.patch("/{pair_id}", response_model=GAPairOut)
def update_ga_pair(
    project_id: str,
    pair_id: str,
    data: GAPairUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a GA pair's genre/audience fields."""
    repo = GAPairRepository(db)
    pair = repo.update_pair(project_id, pair_id, data)
    if not pair:
        raise not_found("GA Pair")
    return pair


# ── Delete ───────────────────────────────────────────────────────────

@router.delete("/{pair_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ga_pair(
    project_id: str,
    pair_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a GA pair permanently (no soft delete — per rules.md)."""
    repo = GAPairRepository(db)
    success = repo.delete_pair(project_id, pair_id)
    if not success:
        raise not_found("GA Pair")
    return None
