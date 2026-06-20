"""Chunk repository — soft-delete-aware CRUD."""
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Chunk


class ChunkRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_chunk(
        self,
        project_id: str,
        document_id: str,
        chunk_index: int,
        content: str,
        token_count: int,
        metadata: dict | None = None,
    ) -> Chunk:
        chunk = Chunk(
            project_id=project_id,
            document_id=document_id,
            chunk_index=chunk_index,
            content=content,
            token_count=token_count,
            chunk_metadata=metadata,
        )
        self.db.add(chunk)
        return chunk

    def bulk_create(self, chunks: list[Chunk]) -> list[Chunk]:
        self.db.add_all(chunks)
        self.db.commit()
        for c in chunks:
            self.db.refresh(c)
        return chunks

    def get_chunks(
        self, project_id: str, document_id: str | None = None, skip: int = 0, limit: int = 100
    ) -> list[Chunk]:
        q = (
            self.db.query(Chunk)
            .filter(Chunk.project_id == project_id, Chunk.deleted_at.is_(None))
        )
        if document_id:
            q = q.filter(Chunk.document_id == document_id)
        return q.order_by(Chunk.chunk_index).offset(skip).limit(limit).all()

    def get_chunk(self, project_id: str, chunk_id: str) -> Chunk | None:
        return (
            self.db.query(Chunk)
            .filter(
                Chunk.id == chunk_id,
                Chunk.project_id == project_id,
                Chunk.deleted_at.is_(None),
            )
            .first()
        )

    def update_chunk_content(self, project_id: str, chunk_id: str, content: str) -> bool:
        chunk = self.get_chunk(project_id, chunk_id)
        if not chunk:
            return False
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        chunk.content = content
        chunk.token_count = len(enc.encode(content))
        self.db.commit()
        return True

    def soft_delete_chunk(self, project_id: str, chunk_id: str) -> bool:
        chunk = self.get_chunk(project_id, chunk_id)
        if not chunk:
            return False
        chunk.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def soft_delete_by_document(self, project_id: str, document_id: str) -> int:
        count = (
            self.db.query(Chunk)
            .filter(
                Chunk.project_id == project_id,
                Chunk.document_id == document_id,
                Chunk.deleted_at.is_(None),
            )
            .update({"deleted_at": datetime.utcnow()})
        )
        self.db.commit()
        return count

    def count_chunks(self, project_id: str) -> int:
        return (
            self.db.query(func.count(Chunk.id))
            .filter(Chunk.project_id == project_id, Chunk.deleted_at.is_(None))
            .scalar()
        ) or 0
