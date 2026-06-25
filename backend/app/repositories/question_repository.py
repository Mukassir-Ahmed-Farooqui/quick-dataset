"""Question repository — CRUD for questions with search, filters, and bulk operations."""
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from app.models import Question, Chunk

logger = logging.getLogger(__name__)


class QuestionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_question(
        self,
        project_id: str,
        chunk_id: str,
        question: str,
        ga_pair_id: Optional[str] = None,
        generation_run_id: Optional[str] = None,
    ) -> Question:
        q = Question(
            project_id=project_id,
            chunk_id=chunk_id,
            ga_pair_id=ga_pair_id,
            generation_run_id=generation_run_id,
            question=question,
        )
        self.db.add(q)
        self.db.commit()
        self.db.refresh(q)
        return q

    def bulk_create(self, questions: list[Question]) -> list[Question]:
        self.db.add_all(questions)
        self.db.commit()
        for q in questions:
            self.db.refresh(q)
        return questions

    def list_questions(
        self,
        project_id: str,
        *,
        chunk_id: Optional[str] = None,
        ga_pair_id: Optional[str] = None,
        generation_run_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Question]:
        q = self.db.query(Question).options(
            joinedload(Question.chunk).joinedload(Chunk.document)
        ).filter(
            Question.project_id == project_id,
            Question.deleted_at.is_(None),
        )

        if chunk_id:
            q = q.filter(Question.chunk_id == chunk_id)
        if ga_pair_id:
            q = q.filter(Question.ga_pair_id == ga_pair_id)
        if generation_run_id:
            q = q.filter(Question.generation_run_id == generation_run_id)
        if status == "answered":
            q = q.filter(Question.answered == True)
        elif status == "unanswered":
            q = q.filter(Question.answered == False)
        if search:
            q = q.filter(Question.question.ilike(f"%{search}%"))

        return (
            q.order_by(Question.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_questions(
        self,
        project_id: str,
        *,
        chunk_id: Optional[str] = None,
        ga_pair_id: Optional[str] = None,
        generation_run_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> int:
        q = self.db.query(func.count(Question.id)).filter(
            Question.project_id == project_id,
            Question.deleted_at.is_(None),
        )

        if chunk_id:
            q = q.filter(Question.chunk_id == chunk_id)
        if ga_pair_id:
            q = q.filter(Question.ga_pair_id == ga_pair_id)
        if generation_run_id:
            q = q.filter(Question.generation_run_id == generation_run_id)
        if status == "answered":
            q = q.filter(Question.answered == True)
        elif status == "unanswered":
            q = q.filter(Question.answered == False)
        if search:
            q = q.filter(Question.question.ilike(f"%{search}%"))

        return q.scalar() or 0

    def get_question_stats(self, project_id: str) -> dict:
        """Get question counts grouped by document, and total/answered/unanswered counts."""
        questions = (
            self.db.query(Question)
            .options(joinedload(Question.chunk).joinedload(Chunk.document))
            .filter(
                Question.project_id == project_id,
                Question.deleted_at.is_(None)
            )
            .all()
        )
        
        total = len(questions)
        answered = 0
        unanswered = 0
        
        docs_map = {}
        
        for q in questions:
            if q.answered:
                answered += 1
            else:
                unanswered += 1
                doc_id = q.chunk.document_id if q.chunk else None
                doc_name = q.chunk.document.filename if q.chunk and q.chunk.document else "Unknown Document"
                
                if doc_id not in docs_map:
                    docs_map[doc_id] = {
                        "document_id": doc_id,
                        "document_filename": doc_name,
                        "unanswered_count": 0,
                        "unanswered_question_ids": []
                    }
                
                docs_map[doc_id]["unanswered_count"] += 1
                docs_map[doc_id]["unanswered_question_ids"].append(q.id)
                
        return {
            "total": total,
            "answered": answered,
            "unanswered": unanswered,
            "documents": list(docs_map.values())
        }

    def get_question(self, project_id: str, question_id: str) -> Optional[Question]:
        return (
            self.db.query(Question)
            .filter(
                Question.id == question_id,
                Question.project_id == project_id,
                Question.deleted_at.is_(None),
            )
            .first()
        )

    def update_question(
        self,
        project_id: str,
        question_id: str,
        question_text: str,
    ) -> Optional[Question]:
        q = self.get_question(project_id, question_id)
        if not q:
            return None
        q.question = question_text
        self.db.commit()
        self.db.refresh(q)
        return q

    def soft_delete_question(self, project_id: str, question_id: str) -> bool:
        q = self.get_question(project_id, question_id)
        if not q:
            return False
        q.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def bulk_delete(self, project_id: str, question_ids: list[str]) -> int:
        count = (
            self.db.query(Question)
            .filter(
                Question.id.in_(question_ids),
                Question.project_id == project_id,
                Question.deleted_at.is_(None),
            )
            .update({"deleted_at": datetime.utcnow()}, synchronize_session=False)
        )
        self.db.commit()
        return count

    def mark_answered(self, project_id: str, question_id: str) -> Optional[Question]:
        q = self.get_question(project_id, question_id)
        if not q:
            return None
        q.answered = True
        q.reviewed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(q)
        return q

    def get_questions_by_ids(
        self,
        project_id: str,
        question_ids: list[str],
    ) -> list[Question]:
        return (
            self.db.query(Question)
            .filter(
                Question.id.in_(question_ids),
                Question.project_id == project_id,
                Question.deleted_at.is_(None),
            )
            .all()
        )

    def get_unanswered_questions(
        self,
        project_id: str,
        chunk_ids: Optional[list[str]] = None,
        limit: int = 100,
    ) -> list[Question]:
        q = self.db.query(Question).filter(
            Question.project_id == project_id,
            Question.deleted_at.is_(None),
            Question.answered == False,
        )
        if chunk_ids:
            q = q.filter(Question.chunk_id.in_(chunk_ids))
        return q.order_by(Question.created_at.asc()).limit(limit).all()

    def get_questions_by_chunks(
        self,
        project_id: str,
        chunk_ids: list[str],
    ) -> list[Question]:
        return (
            self.db.query(Question)
            .filter(
                Question.project_id == project_id,
                Question.chunk_id.in_(chunk_ids),
                Question.deleted_at.is_(None),
            )
            .all()
        )
