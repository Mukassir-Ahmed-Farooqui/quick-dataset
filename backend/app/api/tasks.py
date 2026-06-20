"""Tasks API — poll status and cancel background tasks."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, task_already_completed
from app.models import User
from app.repositories.task_repository import TaskRepository
from app.schemas import TaskOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = TaskRepository(db)
    task = repo.get_task(task_id)
    if not task:
        raise not_found("Task")
    return task


@router.post("/{task_id}/cancel", response_model=TaskOut)
def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = TaskRepository(db)
    task = repo.get_task(task_id)
    if not task or task.project.owner_id != str(current_user.id):
        raise not_found("Task")

    success = repo.cancel_task(task_id, task.project_id)
    if not success:
        raise task_already_completed()
    return repo.get_task(task_id)
