"""Documents API — upload, list, get, delete."""
import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models import User, ProcessingStatus
from app.repositories.document_repository import DocumentRepository
from app.services.parsing import parse_document
from app.schemas_extended import DocumentOut
from app.schemas import PageEnvelope

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage")
ALLOWED_EXTENSIONS = {"pdf": "pdf", "docx": "docx", "md": "md", "txt": "txt"}


def _file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")
    return ext


async def _parse_in_background(document_id: str, file_path: str, file_type: str, filename: str):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        repo = DocumentRepository(db)
        repo.update_status(document_id, ProcessingStatus.parsing)
        with open(file_path, "rb") as f:
            content = await parse_document(f.read(), file_type, filename)
        parsed_path = file_path + ".md"
        with open(parsed_path, "w", encoding="utf-8") as f:
            f.write(content)
        repo.update_status(document_id, ProcessingStatus.parsed)
    except Exception as e:
        repo = DocumentRepository(db)
        repo.update_status(document_id, ProcessingStatus.failed, str(e))
    finally:
        db.close()


@router.post("/upload", response_model=List[DocumentOut], status_code=status.HTTP_201_CREATED)
async def upload_documents(
    project_id: str,
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = DocumentRepository(db)
    project_dir = os.path.join(STORAGE_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)

    results = []
    for file in files:
        ext = _file_type(file.filename)
        file_bytes = await file.read()

        try:
            doc = repo.create_document(
                project_id=project_id,
                filename=file.filename,
                file_type=ext,
                file_bytes=file_bytes,
                storage_url=f"storage/{project_id}/{file.filename}",
            )
        except ValueError as e:
            msg = str(e)
            if msg.startswith("DUPLICATE_DOCUMENT:"):
                raise HTTPException(status_code=409, detail=msg)
            raise HTTPException(status_code=400, detail=msg)

        file_path = os.path.join(project_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # Create a Task row for tracking
        from app.repositories.task_repository import TaskRepository
        task_repo = TaskRepository(db)
        task = task_repo.create_task(
            project_id=project_id,
            task_type="text-processing",
            total_count=1,
        )
        task_repo.start_task(str(task.id))

        background_tasks.add_task(_parse_in_background, str(doc.id), file_path, ext, file.filename)
        results.append(doc)

    return results


@router.get("")
def list_documents(
    project_id: str,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = DocumentRepository(db)
    rows = repo.get_documents(project_id, skip=0, limit=10000)
    total = len(rows)
    start = (page - 1) * page_size
    paged = rows[start:start + page_size]
    items = [DocumentOut.model_validate(d) for d in paged]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    project_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = DocumentRepository(db)
    doc = repo.get_document(project_id, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    project_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = DocumentRepository(db)
    success = repo.soft_delete_document(project_id, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
