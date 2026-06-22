from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, already_exists
from app.core.crypto import decrypt
from app.models import User, Document, Question, DatasetItem
from app.repositories.project_repository import ProjectRepository
from app.repositories.llm_key_repository import LLMKeyRepository
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut, ProjectDetailOut,
    ProjectListItemOut, LLMKeyOut, PaginatedResponse, pagination_meta,
)

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    try:
        return repo.create_project(str(current_user.id), data)
    except ValueError as e:
        raise already_exists("Project", data.name)

@router.get("")
def list_projects(
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ProjectRepository(db)
    total = repo.count_projects(str(current_user.id))
    rows = repo.list_projects(str(current_user.id), skip=(page - 1) * page_size, limit=page_size)
    if not rows:
        return PaginatedResponse(items=[], pagination=pagination_meta(page, page_size, total))

    project_ids = [str(p.id) for p in rows]

    # Batch-count aggregate fields — one query per metric, not N+1
    doc_counts = dict(
        db.query(Document.project_id, func.count(Document.id))
        .filter(Document.project_id.in_(project_ids), Document.deleted_at.is_(None))
        .group_by(Document.project_id)
        .all()
    )
    q_counts = dict(
        db.query(Question.project_id, func.count(Question.id))
        .filter(Question.project_id.in_(project_ids), Question.deleted_at.is_(None))
        .group_by(Question.project_id)
        .all()
    )
    d_counts = dict(
        db.query(DatasetItem.project_id, func.count(DatasetItem.id))
        .filter(DatasetItem.project_id.in_(project_ids), DatasetItem.deleted_at.is_(None))
        .group_by(DatasetItem.project_id)
        .all()
    )

    key_repo = LLMKeyRepository(db)

    items = []
    for p in rows:
        pid = str(p.id)

        # Convert default_llm_key relationship to LLMKeyOut
        llm_key_out = None
        if p.default_llm_key:
            try:
                raw_key = decrypt(p.default_llm_key.encrypted_api_key)
                masked = key_repo._mask_key(raw_key)
                llm_key_out = LLMKeyOut(
                    id=str(p.default_llm_key.id),
                    provider=p.default_llm_key.provider.value,
                    name=p.default_llm_key.name,
                    masked_key=masked,
                    is_default=p.default_llm_key.is_default,
                    is_valid=p.default_llm_key.is_valid,
                    last_validated_at=p.default_llm_key.last_validated_at,
                    created_at=p.default_llm_key.created_at,
                )
            except Exception:
                llm_key_out = LLMKeyOut(
                    id=str(p.default_llm_key.id),
                    provider=p.default_llm_key.provider.value,
                    name=p.default_llm_key.name,
                    masked_key="***",
                    is_default=p.default_llm_key.is_default,
                    is_valid=p.default_llm_key.is_valid,
                    last_validated_at=p.default_llm_key.last_validated_at,
                    created_at=p.default_llm_key.created_at,
                )

        items.append(ProjectListItemOut(
            id=pid,
            name=p.name,
            description=p.description,
            status=p.status.value if hasattr(p.status, 'value') else str(p.status),
            default_llm_key=llm_key_out,
            created_at=p.created_at,
            updated_at=p.updated_at,
            document_count=doc_counts.get(pid, 0),
            question_count=q_counts.get(pid, 0),
            dataset_item_count=d_counts.get(pid, 0),
            last_activity_at=p.updated_at,
        ))

    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))

@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    project = repo.get_project_detail(str(current_user.id), project_id)
    if not project:
        raise not_found("Project")
    return project

@router.patch("/{project_id}", response_model=ProjectDetailOut)
def update_project(project_id: str, data: ProjectUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    try:
        project = repo.update_project(str(current_user.id), project_id, data)
        if not project:
            raise not_found("Project")
        return project
    except ValueError as e:
        raise already_exists("Project", data.name or "")

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    success = repo.delete_project(str(current_user.id), project_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return None
