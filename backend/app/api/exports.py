"""Exports API — generate, list, and download dataset exports.

Supports JSON, JSONL, Alpaca, and ShareGPT formats.
For MVP, exports are written to local storage. R2 integration is a future enhancement.
"""
import json
import os
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, bad_request
from app.core.config import settings
from app.models import User, Export, ExportType
from app.schemas_extended import ExportCreate, ExportOut, DatasetItemOut
from app.schemas import PaginatedResponse, pagination_meta
from app.services.generation.answer_generator import DatasetItemRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/exports", tags=["exports"])

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "exports")


# ── Create Export ────────────────────────────────────────────────────

@router.post("", response_model=ExportOut, status_code=status.HTTP_201_CREATED)
def create_export(
    project_id: str,
    data: ExportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new export job. Runs in background."""
    repo = DatasetItemRepository(db)

    # Create export record
    export = Export(
        project_id=project_id,
        export_type=ExportType(data.export_type),
        filter_snapshot=data.filter.model_dump(),
        status="generating",
    )
    db.add(export)
    db.commit()
    db.refresh(export)

    export_id = str(export.id)

    # Run in background
    async def _generate_export():
        from app.core.database import SessionLocal
        bg_db = SessionLocal()
        try:
            items = repo.get_exportable_items(
                project_id,
                confirmed=data.filter.confirmed,
                min_score=data.filter.min_score,
                generation_run_id=data.filter.generation_run_id,
            )

            os.makedirs(EXPORT_DIR, exist_ok=True)
            file_path = os.path.join(EXPORT_DIR, f"{export_id}.json")

            export_format = ExportType(data.export_type)
            row_count = _write_export_file(file_path, items, export_format)

            # Update export record
            bg_export = bg_db.query(Export).filter(Export.id == export_id).first()
            if bg_export:
                bg_export.status = "ready"
                bg_export.storage_url = file_path
                bg_export.row_count = row_count
                bg_db.commit()

            logger.info(
                "Export complete | id=%s type=%s rows=%d",
                export_id, data.export_type, row_count,
            )
        except Exception as e:
            logger.error("Export failed | id=%s error=%s", export_id, str(e))
            bg_export = bg_db.query(Export).filter(Export.id == export_id).first()
            if bg_export:
                bg_export.status = "failed"
                bg_db.commit()
        finally:
            bg_db.close()

    background_tasks.add_task(_generate_export)

    return ExportOut(
        id=export_id,
        export_type=data.export_type,
        filter_snapshot=data.filter,
        status="generating",
        storage_url=None,
        row_count=None,
        created_at=export.created_at,
    )


# ── List Exports ─────────────────────────────────────────────────────

@router.get("")
def list_exports(
    project_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List export history for a project."""
    q = db.query(Export).filter(Export.project_id == project_id)
    total = q.count()
    rows = (
        q.order_by(Export.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        ExportOut(
            id=str(r.id),
            export_type=r.export_type.value if hasattr(r.export_type, 'value') else r.export_type,
            filter_snapshot=r.filter_snapshot,
            status=r.status,
            storage_url=r.storage_url,
            row_count=r.row_count,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))


# ── Download Export ──────────────────────────────────────────────────

@router.get("/{export_id}/download")
def download_export(
    project_id: str,
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download an export file."""
    export = (
        db.query(Export)
        .filter(Export.id == export_id, Export.project_id == project_id)
        .first()
    )
    if not export:
        raise not_found("Export")

    if export.status != "ready" or not export.storage_url:
        raise bad_request("Export is not ready yet", "EXPORT_NOT_READY")

    if not os.path.exists(export.storage_url):
        raise not_found("Export file")

    filename = f"dataset-export-{export.export_type.value}.json"
    return FileResponse(
        export.storage_url,
        media_type="application/json",
        filename=filename,
    )


# ── Delete Export ────────────────────────────────────────────────────

@router.delete("/{export_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_export(
    project_id: str,
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete an export record."""
    export = (
        db.query(Export)
        .filter(Export.id == export_id, Export.project_id == project_id)
        .first()
    )
    if not export:
        raise not_found("Export")
    export.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ── Format writers ───────────────────────────────────────────────────

def _write_export_file(
    file_path: str,
    items: list,
    export_format: ExportType,
) -> int:
    """Write dataset items to a file in the specified format.

    Returns the number of rows written.
    """
    if export_format == ExportType.json:
        return _write_json(file_path, items)
    elif export_format == ExportType.jsonl:
        return _write_jsonl(file_path, items)
    elif export_format == ExportType.alpaca:
        return _write_alpaca(file_path, items)
    elif export_format == ExportType.sharegpt:
        return _write_sharegpt(file_path, items)
    return 0


def _write_json(file_path: str, items: list) -> int:
    """Write as a JSON array of payload objects."""
    data = []
    for item in items:
        entry = dict(item.payload)
        entry["id"] = item.id
        if hasattr(item, 'score') and item.score is not None:
            entry["score"] = item.score
        data.append(entry)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return len(data)


def _write_jsonl(file_path: str, items: list) -> int:
    """Write as JSONL (one JSON object per line)."""
    count = 0
    with open(file_path, "w", encoding="utf-8") as f:
        for item in items:
            entry = dict(item.payload)
            entry["id"] = item.id
            if hasattr(item, 'score') and item.score is not None:
                entry["score"] = item.score
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            count += 1
    return count


def _write_alpaca(file_path: str, items: list) -> int:
    """Write in Alpaca format: [{"instruction": "...", "input": "...", "output": "..."}]."""
    data = []
    for item in items:
        payload = item.payload
        if item.dataset_type.value == "qa":
            data.append({
                "instruction": payload.get("question", ""),
                "input": "",
                "output": payload.get("answer", ""),
            })
        elif item.dataset_type.value == "mcq":
            instruction = payload.get("question", "")
            options_text = "\n".join(
                f"{chr(65 + i)}. {opt}"
                for i, opt in enumerate(payload.get("options", []))
            )
            data.append({
                "instruction": instruction,
                "input": options_text,
                "output": payload.get("correct_answer", ""),
            })
        else:
            data.append({
                "instruction": payload.get("text", ""),
                "input": "",
                "output": payload.get("label", ""),
            })
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return len(data)


def _write_sharegpt(file_path: str, items: list) -> int:
    """Write in ShareGPT format: [{"conversations": [{"from": "...", "value": "..."}]}]."""
    data = []
    for item in items:
        payload = item.payload
        if item.dataset_type.value == "qa":
            data.append({
                "conversations": [
                    {"from": "human", "value": payload.get("question", "")},
                    {"from": "gpt", "value": payload.get("answer", "")},
                ]
            })
        elif item.dataset_type.value == "mcq":
            question = payload.get("question", "")
            options = payload.get("options", [])
            question_with_options = question + "\n\n" + "\n".join(
                f"{chr(65 + i)}. {opt}" for i, opt in enumerate(options)
            )
            data.append({
                "conversations": [
                    {"from": "human", "value": question_with_options},
                    {"from": "gpt", "value": payload.get("correct_answer", "")},
                ]
            })
        else:
            data.append({
                "conversations": [
                    {"from": "human", "value": payload.get("text", "")},
                    {"from": "gpt", "value": payload.get("label", "")},
                ]
            })
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return len(data)
