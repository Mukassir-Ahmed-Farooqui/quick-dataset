from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.models import Project, ProjectStatus, Document, Chunk, GAPair, Question, DatasetItem
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut, ProjectDetailOut, ProjectListItemOut, PipelineProgress
from app.repositories.llm_key_repository import LLMKeyRepository

class ProjectRepository:
    def __init__(self, db: Session):
        self.db = db

    def _get_llm_key_out(self, db_project: Project, user_id: str):
        if not db_project.default_llm_key:
            return None
        # We use LLMKeyRepository to ensure consistent formatting and masking
        key_repo = LLMKeyRepository(self.db)
        # Note: the key repo's `_mask_key` expects raw_key. But we don't have raw_key.
        # So we should call `get_key_by_id` logic from LLMKeyRepository? No, `get_keys_for_user` does the decryption mapping.
        # Actually, let's just decrypt and mask here to avoid circular logic or just rely on a helper.
        from app.core.crypto import decrypt
        try:
            raw_key = decrypt(db_project.default_llm_key.encrypted_api_key)
            masked_key = key_repo._mask_key(raw_key)
        except Exception:
            masked_key = "***"
        
        from app.schemas import LLMKeyOut
        return LLMKeyOut(
            id=str(db_project.default_llm_key.id),
            provider=db_project.default_llm_key.provider.value,
            name=db_project.default_llm_key.name,
            is_default=db_project.default_llm_key.is_default,
            created_at=db_project.default_llm_key.created_at,
            masked_key=masked_key,
            is_valid=db_project.default_llm_key.is_valid,
            last_validated_at=db_project.default_llm_key.last_validated_at
        )

    def create_project(self, user_id: str, data: ProjectCreate) -> ProjectDetailOut:
        # Check for duplicates
        existing = self.db.query(Project).filter(
            Project.owner_id == user_id,
            Project.name == data.name,
            Project.deleted_at == None
        ).first()
        if existing:
            raise ValueError(f"Project '{data.name}' already exists.")

        db_project = Project(
            owner_id=user_id,
            name=data.name,
            description=data.description,
            default_llm_key_id=data.default_llm_key_id,
            status=ProjectStatus.active
        )
        self.db.add(db_project)
        self.db.commit()
        self.db.refresh(db_project)
        
        return self.get_project_detail(user_id, str(db_project.id))

    def count_projects(self, user_id: str) -> int:
        return (
            self.db.query(func.count(Project.id))
            .filter(Project.owner_id == user_id, Project.deleted_at == None)
            .scalar()
        ) or 0

    def list_projects(self, user_id: str, skip: int = 0, limit: int = 50) -> list[Project]:
        return (
            self.db.query(Project)
            .filter(Project.owner_id == user_id, Project.deleted_at == None)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_projects(self, user_id: str, skip: int = 0, limit: int = 20) -> list[ProjectListItemOut]:
        db_projects = self.db.query(Project).filter(
            Project.owner_id == user_id,
            Project.deleted_at == None
        ).offset(skip).limit(limit).all()
        
        result = []
        for p in db_projects:
            doc_count = self.db.query(func.count(Document.id)).filter(Document.project_id == p.id, Document.deleted_at == None).scalar() or 0
            q_count = self.db.query(func.count(Question.id)).filter(Question.project_id == p.id, Question.deleted_at == None).scalar() or 0
            d_count = self.db.query(func.count(DatasetItem.id)).filter(DatasetItem.project_id == p.id, DatasetItem.deleted_at == None).scalar() or 0
            
            result.append(
                ProjectListItemOut(
                    id=str(p.id),
                    name=p.name,
                    description=p.description,
                    status=p.status.value,
                    default_llm_key=self._get_llm_key_out(p, user_id),
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                    document_count=doc_count,
                    question_count=q_count,
                    dataset_item_count=d_count,
                    last_activity_at=p.updated_at
                )
            )
        return result

    def get_project_detail(self, user_id: str, project_id: str) -> ProjectDetailOut | None:
        p = self.db.query(Project).filter(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at == None
        ).first()
        
        if not p:
            return None

        # Calculate pipeline progress (simple separate counts as requested to avoid premature optimization)
        docs = self.db.query(func.count(Document.id)).filter(Document.project_id == p.id, Document.deleted_at == None).scalar() or 0
        chunks = self.db.query(func.count(Chunk.id)).filter(Chunk.project_id == p.id, Chunk.deleted_at == None).scalar() or 0
        ga_pairs = self.db.query(func.count(GAPair.id)).filter(GAPair.project_id == p.id).scalar() or 0
        questions = self.db.query(func.count(Question.id)).filter(Question.project_id == p.id, Question.deleted_at == None).scalar() or 0
        questions_reviewed = self.db.query(func.count(Question.id)).filter(Question.project_id == p.id, Question.deleted_at == None, Question.reviewed_at != None).scalar() or 0
        items = self.db.query(func.count(DatasetItem.id)).filter(DatasetItem.project_id == p.id, DatasetItem.deleted_at == None).scalar() or 0
        items_confirmed = self.db.query(func.count(DatasetItem.id)).filter(DatasetItem.project_id == p.id, DatasetItem.deleted_at == None, DatasetItem.confirmed == True).scalar() or 0

        progress = PipelineProgress(
            documents=docs,
            chunks=chunks,
            ga_pairs=ga_pairs,
            questions=questions,
            questions_reviewed=questions_reviewed,
            dataset_items=items,
            dataset_items_confirmed=items_confirmed
        )
        
        return ProjectDetailOut(
            id=str(p.id),
            name=p.name,
            description=p.description,
            status=p.status.value,
            default_llm_key=self._get_llm_key_out(p, user_id),
            created_at=p.created_at,
            updated_at=p.updated_at,
            pipeline_progress=progress
        )

    def update_project(self, user_id: str, project_id: str, data: ProjectUpdate) -> ProjectDetailOut | None:
        p = self.db.query(Project).filter(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at == None
        ).first()
        
        if not p:
            return None
            
        if data.name is not None:
            # Check duplicates
            existing = self.db.query(Project).filter(
                Project.owner_id == user_id,
                Project.name == data.name,
                Project.id != p.id,
                Project.deleted_at == None
            ).first()
            if existing:
                raise ValueError(f"Project '{data.name}' already exists.")
            p.name = data.name
            
        if data.description is not None:
            p.description = data.description
            
        if data.default_llm_key_id is not None:
            p.default_llm_key_id = data.default_llm_key_id
            
        self.db.commit()
        return self.get_project_detail(user_id, project_id)

    def delete_project(self, user_id: str, project_id: str) -> bool:
        p = self.db.query(Project).filter(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at == None
        ).first()
        
        if not p:
            return False
            
        # Soft delete
        p.deleted_at = datetime.utcnow()
        p.status = ProjectStatus.archived
        self.db.commit()
        return True
