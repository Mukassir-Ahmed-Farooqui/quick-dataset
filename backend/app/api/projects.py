from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, already_exists
from app.models import User
from app.repositories.project_repository import ProjectRepository
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut, ProjectDetailOut, ProjectListItemOut, PageEnvelope

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
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ProjectRepository(db)
    items = repo.get_projects(str(current_user.id), skip=0, limit=1000)
    total = len(items)
    start = (page - 1) * page_size
    paged = items[start:start + page_size]
    return {"items": paged, "total": total, "page": page, "page_size": page_size}

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
