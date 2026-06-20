from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_db, get_current_user
from app.models import User
from app.repositories.project_repository import ProjectRepository
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut, ProjectDetailOut, ProjectListItemOut

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    try:
        return repo.create_project(str(current_user.id), data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.get("", response_model=List[ProjectListItemOut])
def list_projects(skip: int = 0, limit: int = 20, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    return repo.get_projects(str(current_user.id), skip=skip, limit=limit)

@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    project = repo.get_project_detail(str(current_user.id), project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project

@router.patch("/{project_id}", response_model=ProjectDetailOut)
def update_project(project_id: str, data: ProjectUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    try:
        project = repo.update_project(str(current_user.id), project_id, data)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return project
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    success = repo.delete_project(str(current_user.id), project_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return None
