"""GA Pair repository — CRUD for Genre/Audience pairs."""
import json
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import GAPair
from app.schemas_extended import GAPairCreate, GAPairUpdate, GAPairOut


class GAPairRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_pair(
        self,
        project_id: str,
        document_id: str,
        genre_title: str,
        genre_description: Optional[str] = None,
        audience_title: str = "",
        audience_description: Optional[str] = None,
    ) -> GAPair:
        pair = GAPair(
            project_id=project_id,
            document_id=document_id,
            genre_title=genre_title,
            genre_description=genre_description,
            audience_title=audience_title,
            audience_description=audience_description,
        )
        self.db.add(pair)
        self.db.commit()
        self.db.refresh(pair)
        return pair

    def bulk_create(self, pairs: list[GAPair]) -> list[GAPair]:
        self.db.add_all(pairs)
        self.db.commit()
        for p in pairs:
            self.db.refresh(p)
        return pairs

    def list_pairs(
        self,
        project_id: str,
        document_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[GAPair]:
        q = self.db.query(GAPair).filter(GAPair.project_id == project_id)
        if document_id:
            q = q.filter(GAPair.document_id == document_id)
        return q.order_by(GAPair.created_at.desc()).offset(skip).limit(limit).all()

    def count_pairs(
        self,
        project_id: str,
        document_id: Optional[str] = None,
    ) -> int:
        q = self.db.query(func.count(GAPair.id)).filter(GAPair.project_id == project_id)
        if document_id:
            q = q.filter(GAPair.document_id == document_id)
        return q.scalar() or 0

    def get_pair(self, project_id: str, pair_id: str) -> Optional[GAPair]:
        return (
            self.db.query(GAPair)
            .filter(GAPair.id == pair_id, GAPair.project_id == project_id)
            .first()
        )

    def update_pair(
        self,
        project_id: str,
        pair_id: str,
        data: GAPairUpdate,
    ) -> Optional[GAPair]:
        pair = self.get_pair(project_id, pair_id)
        if not pair:
            return None
        if data.genre_title is not None:
            pair.genre_title = data.genre_title
        if data.genre_description is not None:
            pair.genre_description = data.genre_description
        if data.audience_title is not None:
            pair.audience_title = data.audience_title
        if data.audience_description is not None:
            pair.audience_description = data.audience_description
        self.db.commit()
        self.db.refresh(pair)
        return pair

    def delete_pair(self, project_id: str, pair_id: str) -> bool:
        pair = self.get_pair(project_id, pair_id)
        if not pair:
            return False
        self.db.delete(pair)
        self.db.commit()
        return True

    def list_pairs_by_documents(
        self,
        project_id: str,
        document_ids: list[str],
    ) -> list[GAPair]:
        """Get all GA pairs for specific documents (used for redundancy check)."""
        return (
            self.db.query(GAPair)
            .filter(
                GAPair.project_id == project_id,
                GAPair.document_id.in_(document_ids),
            )
            .all()
        )
