"""Chunks API — preview, generate, list, update, delete."""
import os
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models import User
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.services.chunking import chunk_document, preview_chunks
from app.schemas import TaskAcceptedResponse
from app.schemas_extended import ChunkGenerateRequest, ChunkPreviewRequest, ChunkPreviewOut, ChunkOut, ChunkUpdate

router = APIRouter(prefix="/projects/{project_id}/chunks", tags=["chunks"])
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage")


def _generate_in_background(project_id: str, document_ids: list[str], strategy: str, chunk_size: int, chunk_overlap: int):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        repo = ChunkRepository(db)
        doc_repo = DocumentRepository(db)

        for doc_id in document_ids:
            doc = doc_repo.get_document(project_id, doc_id)
            if not doc:
                continue

            md_path = os.path.join(STORAGE_DIR, project_id, doc.filename + ".md")
            text_path = os.path.join(STORAGE_DIR, project_id, doc.filename)

            path = md_path if os.path.exists(md_path) else text_path
            if not os.path.exists(path):
                continue

            with open(path, "r", encoding="utf-8") as f:
                text = f.read()

            chunks_data = chunk_document(
                text, strategy=strategy, chunk_size=chunk_size, chunk_overlap=chunk_overlap,
            )

            from app.models import Chunk
            chunk_objs = []
            for i, c in enumerate(chunks_data):
                metadata = {"heading_path": c.get("heading_path", [])} if "heading_path" in c else None
                chunk_objs.append(Chunk(
                    project_id=project_id,
                    document_id=doc_id,
                    chunk_index=i,
                    content=c["content"],
                    token_count=c["token_count"],
                    chunk_metadata=metadata,
                ))

            repo.bulk_create(chunk_objs)
    finally:
        db.close()


@router.post("/preview", response_model=ChunkPreviewOut)
def preview(
    project_id: str,
    data: ChunkPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc_repo = DocumentRepository(db)
    doc = doc_repo.get_document(project_id, data.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    md_path = os.path.join(STORAGE_DIR, project_id, doc.filename + ".md")
    text_path = os.path.join(STORAGE_DIR, project_id, doc.filename)
    path = md_path if os.path.exists(md_path) else text_path
    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail="Document not yet parsed")

    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    result = preview_chunks(
        text,
        strategy=data.strategy,
        chunk_size=data.chunk_size,
        chunk_overlap=data.chunk_overlap,
    )
    return result


@router.post("/generate", response_model=TaskAcceptedResponse, status_code=202)
def generate_chunks(
    project_id: str,
    data: ChunkGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc_repo = DocumentRepository(db)
    for doc_id in data.document_ids:
        if not doc_repo.get_document(project_id, doc_id):
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")

    # Soft-delete existing chunks for these documents first
    chunk_repo = ChunkRepository(db)
    for doc_id in data.document_ids:
        chunk_repo.soft_delete_by_document(project_id, doc_id)

    import uuid
    task_id = str(uuid.uuid4())
    background_tasks.add_task(
        _generate_in_background,
        project_id, data.document_ids, data.strategy, data.chunk_size, data.chunk_overlap,
    )
    return TaskAcceptedResponse(task_id=task_id, generation_run_id=task_id)


@router.get("", response_model=list[ChunkOut])
def list_chunks(
    project_id: str,
    document_id: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ChunkRepository(db)
    return repo.get_chunks(project_id, document_id=document_id, skip=skip, limit=limit)


@router.get("/{chunk_id}", response_model=ChunkOut)
def get_chunk(
    project_id: str,
    chunk_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ChunkRepository(db)
    chunk = repo.get_chunk(project_id, chunk_id)
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return chunk


@router.patch("/{chunk_id}", response_model=ChunkOut)
def update_chunk(
    project_id: str,
    chunk_id: str,
    data: ChunkUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ChunkRepository(db)
    success = repo.update_chunk_content(project_id, chunk_id, data.content)
    if not success:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return repo.get_chunk(project_id, chunk_id)


@router.delete("/{chunk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chunk(
    project_id: str,
    chunk_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ChunkRepository(db)
    success = repo.soft_delete_chunk(project_id, chunk_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chunk not found")
