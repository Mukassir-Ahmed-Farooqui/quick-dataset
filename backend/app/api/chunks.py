"""Chunks API — preview, generate, list, update, delete."""
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models import User
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.services.chunking import chunk_document, preview_chunks
from app.schemas import TaskAcceptedResponse, PaginatedResponse, pagination_meta
from app.schemas_extended import ChunkGenerateRequest, ChunkPreviewRequest, ChunkPreviewOut, ChunkOut, ChunkUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/chunks", tags=["chunks"])
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage")


def _generate_in_background(project_id: str, document_ids: list[str], strategy: str, chunk_size: int, chunk_overlap: int, task_id: str | None = None):
    from app.core.database import SessionLocal
    db = SessionLocal()
    total_created = 0
    try:
        repo = ChunkRepository(db)
        doc_repo = DocumentRepository(db)

        logger.info(f"[CHUNK-GEN] Starting: project={project_id}, docs={len(document_ids)}, strategy={strategy}, size={chunk_size}, overlap={chunk_overlap}")

        for doc_id in document_ids:
            doc = doc_repo.get_document(project_id, doc_id)
            if not doc:
                logger.warning(f"[CHUNK-GEN] Document {doc_id} not found, skipping")
                continue

            md_path = os.path.join(STORAGE_DIR, project_id, doc.filename + ".md")
            text_path = os.path.join(STORAGE_DIR, project_id, doc.filename)

            path = md_path if os.path.exists(md_path) else text_path
            if not os.path.exists(path):
                logger.warning(f"[CHUNK-GEN] No file on disk for doc {doc_id} ({doc.filename}), skipping")
                continue

            with open(path, "r", encoding="utf-8") as f:
                text = f.read()

            logger.info(f"[CHUNK-GEN] Doc '{doc.filename}': {len(text):,} chars, {len(text.split()):,} words")

            chunks_data = chunk_document(
                text, strategy=strategy, chunk_size=chunk_size, chunk_overlap=chunk_overlap,
            )

            logger.info(f"[CHUNK-GEN] Doc '{doc.filename}': chunker produced {len(chunks_data)} chunks")

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
            total_created += len(chunk_objs)
            logger.info(f"[CHUNK-GEN] Doc '{doc.filename}': {len(chunk_objs)} chunks saved to DB")

        logger.info(f"[CHUNK-GEN] Complete: {total_created} total chunks created across {len(document_ids)} documents")

    except Exception as e:
        logger.error(f"[CHUNK-GEN] Error: {e}", exc_info=True)
        db.rollback()
        if task_id:
            from app.repositories.task_repository import TaskRepository
            tr = TaskRepository(db)
            tr.fail_task(task_id, str(e))
        return

    finally:
        if task_id:
            from app.repositories.task_repository import TaskRepository
            tr = TaskRepository(db)
            task = tr.get_task(task_id)
            if task and task.status.value != "failed":
                tr.complete_task(task_id, completed_count=total_created, total_count=total_created)
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

    # Create a Task row so callers can poll status
    from app.repositories.task_repository import TaskRepository
    task_repo = TaskRepository(db)
    task = task_repo.create_task(
        project_id=project_id,
        task_type="text-processing",
        total_count=0,  # real count set at completion time
    )
    task_repo.start_task(str(task.id))
    task_id = str(task.id)

    background_tasks.add_task(
        _generate_in_background,
        project_id, data.document_ids, data.strategy, data.chunk_size, data.chunk_overlap,
        task_id,
    )
    return TaskAcceptedResponse(task_id=task_id, generation_run_id=task_id)


@router.get("")
def list_chunks(
    project_id: str,
    document_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ChunkRepository(db)
    rows = repo.list_chunks(project_id, document_id=document_id, skip=(page - 1) * page_size, limit=page_size)
    total = repo.count_chunks(project_id, document_id=document_id)
    items = [ChunkOut.model_validate(c) for c in rows]
    logger.info(f"[CHUNK-LIST] project={project_id}, doc={document_id}, page={page}, page_size={page_size}, total={total}, returned={len(items)}")
    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))


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
