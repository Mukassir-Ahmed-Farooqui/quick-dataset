"""Document repository — soft-delete-aware CRUD for uploaded files."""
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Document, ProcessingStatus


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_document(
        self,
        project_id: str,
        filename: str,
        file_type: str,
        file_bytes: bytes,
        storage_url: str = "",
    ) -> Document:
        md5_hash = hashlib.md5(file_bytes).hexdigest()

        existing = (
            self.db.query(Document)
            .filter(
                Document.project_id == project_id,
                Document.md5 == md5_hash,
                Document.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise ValueError(f"DUPLICATE_DOCUMENT: {existing.filename}")

        doc = Document(
            project_id=project_id,
            filename=filename,
            file_type=file_type,
            storage_url=storage_url,
            file_size=len(file_bytes),
            md5=md5_hash,
            processing_status=ProcessingStatus.queued,
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def get_documents(self, project_id: str, skip: int = 0, limit: int = 20) -> list[Document]:
        return (
            self.db.query(Document)
            .filter(Document.project_id == project_id, Document.deleted_at.is_(None))
            .order_by(Document.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_document(self, project_id: str, document_id: str) -> Document | None:
        return (
            self.db.query(Document)
            .filter(
                Document.id == document_id,
                Document.project_id == project_id,
                Document.deleted_at.is_(None),
            )
            .first()
        )

    def update_status(self, document_id: str, status: ProcessingStatus, error: str | None = None) -> None:
        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.processing_status = status
            if error:
                doc.parse_error = error
            self.db.commit()

    def soft_delete_document(self, project_id: str, document_id: str) -> bool:
        doc = self.get_document(project_id, document_id)
        if not doc:
            return False
        doc.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def count_documents(self, project_id: str) -> int:
        return (
            self.db.query(func.count(Document.id))
            .filter(Document.project_id == project_id, Document.deleted_at.is_(None))
            .scalar()
        ) or 0
