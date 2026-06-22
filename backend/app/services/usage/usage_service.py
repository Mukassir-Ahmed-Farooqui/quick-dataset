"""
Usage Service — aggregates LLM usage data for dashboard and reporting.

Provides:
- Usage summaries (total calls, tokens, cost) for a project/time range
- Provider breakdown (cost per provider)
- Task type breakdown (cost per task type)
- Paginated usage logs

Every method operates on LLMUsageLog rows written by tracked_complete().
"""

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import LLMUsageLog, Task
from app.schemas import UsageLogOut, UsageSummary


class UsageService:
    """Aggregate and query LLM usage data."""

    def __init__(self, db: Session):
        self.db = db

    def get_usage_summary(
        self,
        project_id: str,
        *,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> UsageSummary:
        """Build a UsageSummary for a project within a time range.

        Args:
            project_id: Project scope.
            since: Start of time range (default: 30 days ago).
            until: End of time range (default: now).

        Returns:
            UsageSummary with aggregated totals and breakdowns.
        """
        if since is None:
            since = datetime.utcnow() - timedelta(days=30)
        if until is None:
            until = datetime.utcnow()

        base = self.db.query(LLMUsageLog).filter(
            LLMUsageLog.project_id == project_id,
            LLMUsageLog.created_at >= since,
            LLMUsageLog.created_at <= until,
        )

        # Totals
        totals = base.with_entities(
            func.count(LLMUsageLog.id).label("total_calls"),
            func.coalesce(func.sum(LLMUsageLog.input_tokens), 0).label("total_input"),
            func.coalesce(func.sum(LLMUsageLog.output_tokens), 0).label("total_output"),
            func.coalesce(func.sum(LLMUsageLog.estimated_cost_usd), 0.0).label("total_cost"),
        ).first()

        # Provider breakdown
        provider_rows = (
            base.with_entities(
                LLMUsageLog.provider,
                func.coalesce(func.sum(LLMUsageLog.estimated_cost_usd), 0.0).label("cost"),
            )
            .group_by(LLMUsageLog.provider)
            .all()
        )
        by_provider: dict[str, float] = {
            row.provider: round(float(row.cost), 6) for row in provider_rows
        }

        # Task type breakdown (join with tasks table)
        task_cost_rows = (
            self.db.query(
                Task.task_type,
                func.coalesce(func.sum(LLMUsageLog.estimated_cost_usd), 0.0).label("cost"),
            )
            .join(LLMUsageLog, LLMUsageLog.task_id == Task.id)
            .filter(
                Task.project_id == project_id,
                LLMUsageLog.created_at >= since,
                LLMUsageLog.created_at <= until,
            )
            .group_by(Task.task_type)
            .all()
        )
        by_task_type: dict[str, float] = {
            row.task_type.value if hasattr(row.task_type, 'value') else str(row.task_type): round(float(row.cost), 6)
            for row in task_cost_rows
        }

        return UsageSummary(
            total_calls=totals.total_calls or 0,
            total_input_tokens=totals.total_input or 0,
            total_output_tokens=totals.total_output or 0,
            total_cost_usd=round(float(totals.total_cost or 0.0), 6),
            by_provider=by_provider,
            by_task_type=by_task_type,
            period_start=since,
            period_end=until,
        )

    def get_usage_logs(
        self,
        project_id: str,
        *,
        skip: int = 0,
        limit: int = 50,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        provider: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[list[UsageLogOut], int]:
        """Get paginated usage logs for a project.

        Args:
            project_id: Project scope.
            skip: Pagination offset.
            limit: Pagination limit.
            since: Start of time range.
            until: End of time range.
            provider: Filter by provider name.
            status: Filter by status ("success" or "error").

        Returns:
            Tuple of (list of UsageLogOut, total count).
        """
        q = self.db.query(LLMUsageLog).filter(
            LLMUsageLog.project_id == project_id,
        )

        if since:
            q = q.filter(LLMUsageLog.created_at >= since)
        if until:
            q = q.filter(LLMUsageLog.created_at <= until)
        if provider:
            q = q.filter(LLMUsageLog.provider == provider)
        if status:
            q = q.filter(LLMUsageLog.status == status)

        total = q.count()

        rows = (
            q.order_by(LLMUsageLog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        items = [UsageLogOut.model_validate(r) for r in rows]
        return items, total

    def get_cost_breakdown(
        self,
        project_id: str,
        *,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> list[dict]:
        """Get daily cost breakdown for charting.

        Returns list of {date: str, cost: float} sorted chronologically.
        """
        if since is None:
            since = datetime.utcnow() - timedelta(days=30)
        if until is None:
            until = datetime.utcnow()

        rows = (
            self.db.query(
                func.date_trunc("day", LLMUsageLog.created_at).label("day"),
                func.coalesce(func.sum(LLMUsageLog.estimated_cost_usd), 0.0).label("cost"),
            )
            .filter(
                LLMUsageLog.project_id == project_id,
                LLMUsageLog.created_at >= since,
                LLMUsageLog.created_at <= until,
                LLMUsageLog.status == "success",
            )
            .group_by(func.date_trunc("day", LLMUsageLog.created_at))
            .order_by("day")
            .all()
        )

        return [
            {"date": row.day.isoformat() if hasattr(row.day, 'isoformat') else str(row.day),
             "cost": round(float(row.cost), 6)}
            for row in rows
        ]

    def get_latest_usage(
        self,
        project_id: str,
        limit: int = 20,
    ) -> list[UsageLogOut]:
        """Get most recent usage logs for a project."""
        rows = (
            self.db.query(LLMUsageLog)
            .filter(LLMUsageLog.project_id == project_id)
            .order_by(LLMUsageLog.created_at.desc())
            .limit(limit)
            .all()
        )
        return [UsageLogOut.model_validate(r) for r in rows]
