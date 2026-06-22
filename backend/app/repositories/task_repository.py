"""Task repository — query and update background task status."""
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Task, TaskStatus

logger = logging.getLogger(__name__)


class TaskRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_task(self, task_id: str, project_id: str | None = None) -> Task | None:
        q = self.db.query(Task).filter(Task.id == task_id)
        if project_id:
            q = q.filter(Task.project_id == project_id)
        return q.first()

    def create_task(
        self,
        project_id: str,
        task_type: str,
        total_count: int = 0,
        generation_run_id: str | None = None,
    ) -> Task:
        task = Task(
            project_id=project_id,
            task_type=task_type,
            status=TaskStatus.queued,
            total_count=total_count,
            generation_run_id=generation_run_id,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def start_task(self, task_id: str) -> None:
        task = self.get_task(task_id)
        if task:
            task.status = TaskStatus.processing
            task.started_at = datetime.utcnow()
            self.db.commit()

    def update_progress(self, task_id: str, completed_increment: int = 1, error_increment: int = 0) -> None:
        """Increment progress counters without changing status or completed_at.

        Safe to call from inside a processing loop — never sets status='done'
        prematurely. Only increments completed_count and error_count.
        """
        task = self.get_task(task_id)
        if task:
            task.completed_count += completed_increment
            task.error_count += error_increment
            self.db.commit()

    def complete_task(self, task_id: str, completed_count: int = 0, error_count: int = 0, total_count: int | None = None) -> None:
        task = self.get_task(task_id)
        if task:
            final_total = total_count if total_count is not None else task.total_count
            if completed_count > final_total:
                completed_count = final_total
                logger.warning(
                    "Task %s: completed_count (%d) clamped to total_count (%d)",
                    task_id, completed_count, final_total,
                )
            task.status = TaskStatus.done
            task.completed_count = completed_count
            if total_count is not None:
                task.total_count = total_count
            task.error_count = error_count
            task.completed_at = datetime.utcnow()
            self.db.commit()

    def fail_task(self, task_id: str, error: str) -> None:
        task = self.get_task(task_id)
        if task:
            task.status = TaskStatus.failed
            task.error_log = task.error_log + [{"message": error}]
            task.completed_at = datetime.utcnow()
            self.db.commit()

    def cancel_task(self, task_id: str, project_id: str) -> bool:
        task = self.get_task(task_id, project_id=project_id)
        if not task:
            return False
        if task.status in (TaskStatus.done, TaskStatus.failed, TaskStatus.cancelled):
            return False
        task.status = TaskStatus.cancelled
        task.cancel_requested = True
        task.completed_at = datetime.utcnow()
        self.db.commit()
        return True
