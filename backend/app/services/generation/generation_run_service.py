"""
Generation Run Service — tracks WHICH model + WHICH prompt version produced
a batch of output.

This is the traceability backbone of the entire generation system. Every
generation endpoint (GA, questions, answers, evaluation, conversations,
CoT) MUST use this service to create and complete runs. No generation
output is produced without a corresponding GenerationRun row.

Relationship with tasks:
- Every generation run has an associated Task (for progress polling).
- The task's generation_run_id FK links the progress bar to the run.
- The run captures what was run; the task captures how far along it is.

Usage:
    run_svc = GenerationRunService(db)
    run = run_svc.create_run(
        project_id=project_id,
        run_type=GenerationRunType.question_generation,
        model_name="gpt-4o",
        dataset_type=DatasetType.qa,
        total_items=expected_count,
    )
    # ... do generation ...
    run_svc.complete_run(run.id, processed_items=actual_count)
"""

import time
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models import (
    GenerationRun,
    GenerationRunType,
    DatasetType,
    PromptType,
    TaskStatus,
)

logger = logging.getLogger(__name__)


class GenerationRunService:
    """Service for managing generation run lifecycle.

    Every method operates within a caller-provided DB session — the caller
    is responsible for transaction boundaries.
    """

    def __init__(self, db: Session):
        self.db = db

    def create_run(
        self,
        project_id: str,
        run_type: GenerationRunType,
        model_name: str,
        *,
        dataset_type: Optional[DatasetType] = None,
        prompt_type: Optional[PromptType] = None,
        prompt_version: Optional[int] = None,
        total_items: int = 0,
    ) -> GenerationRun:
        """Create a new generation run in 'queued' status.

        Args:
            project_id: Project scope.
            run_type: Type of generation (ga, question, answer, etc.).
            model_name: The model identifier used (e.g. "gpt-4o").
            dataset_type: Dataset output type, if applicable.
            prompt_type: Which prompt template was used.
            prompt_version: Snapshot of custom_prompts.version at call time.
            total_items: Expected total item count (may be updated at
                completion time if generation is dynamic).

        Returns:
            The created GenerationRun row.
        """
        run = GenerationRun(
            project_id=project_id,
            run_type=run_type,
            dataset_type=dataset_type,
            model_name=model_name,
            prompt_type=prompt_type,
            prompt_version=prompt_version,
            status=TaskStatus.queued,
            total_items=total_items,
            processed_items=0,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        logger.info(
            "GenerationRun created | id=%s type=%s model=%s items=%d",
            run.id, run_type.value, model_name, total_items,
        )
        return run

    def start_run(self, run_id: str) -> Optional[GenerationRun]:
        """Mark a run as 'processing'. Returns None if run not found."""
        run = self._get_run(run_id)
        if not run:
            return None
        run.status = TaskStatus.processing
        run.started_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(run)
        return run

    def complete_run(
        self,
        run_id: str,
        processed_items: int = 0,
        total_items: Optional[int] = None,
    ) -> Optional[GenerationRun]:
        """Mark a run as 'done' with final counts.

        Args:
            run_id: The generation run id.
            processed_items: Number of items actually processed.
            total_items: If provided, overrides the initial total_items
                (useful when the exact count is only known at completion).

        Returns:
            Updated GenerationRun or None if not found.
        """
        run = self._get_run(run_id)
        if not run:
            return None

        run.status = TaskStatus.done
        run.completed_at = datetime.utcnow()
        run.processed_items = processed_items
        if total_items is not None:
            run.total_items = total_items
        if run.started_at:
            run.duration_ms = int(
                (run.completed_at - run.started_at).total_seconds() * 1000
            )
        self.db.commit()
        self.db.refresh(run)
        logger.info(
            "GenerationRun completed | id=%s items=%d duration=%dms",
            run_id, processed_items, run.duration_ms,
        )
        return run

    def fail_run(
        self,
        run_id: str,
        error_message: str = "",
        processed_items: int = 0,
    ) -> Optional[GenerationRun]:
        """Mark a run as 'failed' with an error.

        Args:
            run_id: The generation run id.
            error_message: Human-readable error description.
            processed_items: Number of items processed before failure.

        Returns:
            Updated GenerationRun or None if not found.
        """
        run = self._get_run(run_id)
        if not run:
            return None

        run.status = TaskStatus.failed
        run.completed_at = datetime.utcnow()
        run.processed_items = processed_items
        if run.started_at:
            run.duration_ms = int(
                (run.completed_at - run.started_at).total_seconds() * 1000
            )
        self.db.commit()
        self.db.refresh(run)
        logger.error(
            "GenerationRun FAILED | id=%s items=%d error=%s",
            run_id, processed_items, error_message,
        )
        return run

    def update_progress(
        self,
        run_id: str,
        processed_items: int,
    ) -> Optional[GenerationRun]:
        """Update processed_items count mid-run (for progress polling)."""
        run = self._get_run(run_id)
        if not run:
            return None
        run.processed_items = processed_items
        self.db.commit()
        return run

    def get_run(self, run_id: str) -> Optional[GenerationRun]:
        """Fetch a run by id."""
        return self._get_run(run_id)

    def list_runs(
        self,
        project_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> list[GenerationRun]:
        """List runs for a project, newest first."""
        return (
            self.db.query(GenerationRun)
            .filter(GenerationRun.project_id == project_id)
            .order_by(GenerationRun.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_runs(self, project_id: str) -> int:
        """Count total runs for a project."""
        return (
            self.db.query(GenerationRun.id)
            .filter(GenerationRun.project_id == project_id)
            .count()
        )

    def _get_run(self, run_id: str) -> Optional[GenerationRun]:
        return (
            self.db.query(GenerationRun)
            .filter(GenerationRun.id == run_id)
            .first()
        )
