"""
SQLAlchemy models for Dataset Factory.
Every table from the ERD, with proper Enums (not raw strings), indexes on
every foreign key, and relationship() wiring for ORM-level navigation.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer,
    String, Text, UniqueConstraint, Index, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def gen_uuid():
    return str(uuid.uuid4())


class SoftDeleteMixin:
    """
    Mix into any table where an accidental bulk delete would be catastrophic.
    deleted_at IS NULL means "live" — every query against these tables must
    filter WHERE deleted_at IS NULL (enforced at the repository layer, not
    the DB, since Postgres has no native row-visibility-by-default concept
    without RLS). Hard-delete past a retention window is a periodic cleanup
    task (TaskType.cleanup), not something the API does directly.
    """
    deleted_at = Column(DateTime, nullable=True, index=True)


# ── Enums ─────────────────────────────────────────────────────────────
# Using real Python Enums (not bare strings) means SQLAlchemy + Postgres
# both enforce valid values at the DB level — a typo like "genrated"
# becomes a 500 at insert time instead of silently corrupting data.

class LLMProvider(str, enum.Enum):
    openrouter = "openrouter"
    openai = "openai"
    groq = "groq"
    gemini = "gemini"


class ProjectStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class ProcessingStatus(str, enum.Enum):
    queued = "queued"
    parsing = "parsing"
    parsed = "parsed"
    failed = "failed"


class ChunkStrategy(str, enum.Enum):
    recursive = "recursive"
    markdown = "markdown"
    token = "token"


class DatasetType(str, enum.Enum):
    qa = "qa"
    mcq = "mcq"
    conversation = "conversation"
    classification = "classification"


class AnswerType(str, enum.Enum):
    text = "text"
    label = "label"
    custom_format = "custom_format"


class CotSource(str, enum.Enum):
    none = "none"
    generated = "generated"
    optimized = "optimized"
    failed = "failed"


class GenerationRunType(str, enum.Enum):
    """What GenerationRun.run_type uses — only types that actually produce
    generated output via an LLM call and get traced for prompt/model lineage."""
    ga_generation = "ga-generation"
    question_generation = "question-generation"
    answer_generation = "answer-generation"
    evaluation = "evaluation"
    conversation_generation = "conversation-generation"
    cot_synthesis = "cot-synthesis"
    cot_optimization = "cot-optimization"


class TaskType(str, enum.Enum):
    """What Task.task_type uses — a superset of GenerationRunType, since
    tasks also cover non-generation background work (parsing, export,
    and future operational jobs like reindex/cleanup/replay) that has
    no associated model or prompt and therefore no GenerationRun row."""
    text_processing = "text-processing"
    ga_generation = "ga-generation"
    question_generation = "question-generation"
    answer_generation = "answer-generation"
    evaluation = "evaluation"
    conversation_generation = "conversation-generation"
    cot_synthesis = "cot-synthesis"
    cot_optimization = "cot-optimization"
    export = "export"
    reindex = "reindex"      # planned: rebuild search indexes
    cleanup = "cleanup"      # planned: hard-delete soft-deleted rows past retention
    rechunk = "rechunk"      # planned: re-run chunking after a strategy change


class TaskStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class ExportType(str, enum.Enum):
    json = "json"
    jsonl = "jsonl"
    alpaca = "alpaca"
    sharegpt = "sharegpt"


class PromptType(str, enum.Enum):
    ga = "ga"
    question = "question"
    answer = "answer"
    evaluation = "evaluation"
    conversation = "conversation"
    cot_synthesis = "cot_synthesis"
    cot_optimization = "cot_optimization"


# ── Core tables ──────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    llm_keys = relationship("UserLLMKey", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class UserLLMKey(Base):
    __tablename__ = "user_llm_keys"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(Enum(LLMProvider), nullable=False)
    name = Column(String(128), nullable=False)
    encrypted_api_key = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    last_validated_at = Column(DateTime, nullable=True)
    is_valid = Column(Boolean, nullable=True)  # null = never tested
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="llm_keys")


class Project(Base, SoftDeleteMixin):
    __tablename__ = "projects"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    default_llm_key_id = Column(UUID(as_uuid=False), ForeignKey("user_llm_keys.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.active, nullable=False)
    archived_at = Column(DateTime, nullable=True)  # set when status -> archived, drives 30-day hard-delete
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    default_llm_key = relationship("UserLLMKey")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="project", cascade="all, delete-orphan")
    ga_pairs = relationship("GAPair", back_populates="project", cascade="all, delete-orphan")
    generation_runs = relationship("GenerationRun", back_populates="project", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="project", cascade="all, delete-orphan")
    dataset_items = relationship("DatasetItem", back_populates="project", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    exports = relationship("Export", back_populates="project", cascade="all, delete-orphan")
    custom_prompts = relationship("CustomPrompt", back_populates="project", cascade="all, delete-orphan")
    usage_logs = relationship("LLMUsageLog", back_populates="project", cascade="all, delete-orphan")


class Document(Base, SoftDeleteMixin):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(512), nullable=False)
    file_type = Column(String(16), nullable=False)  # pdf, docx, md, txt
    storage_url = Column(String(1024), nullable=False)  # R2 object key
    file_size = Column(Integer, nullable=False)
    md5 = Column(String(32), nullable=False, index=True)
    processing_status = Column(Enum(ProcessingStatus), default=ProcessingStatus.queued, nullable=False)
    parse_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    ga_pairs = relationship("GAPair", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("project_id", "md5", name="uq_document_dedup_per_project"),
        Index("ix_documents_project_status", "project_id", "processing_status"),
    )


class Chunk(Base, SoftDeleteMixin):
    __tablename__ = "chunks"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=False), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False)
    chunk_metadata = Column(JSONB, nullable=True)  # e.g. {"heading": "...", "page": 4, "contains_table": true, "contains_code": false}. Deliberately flexible — quality_score and similar future signals go here as optional keys rather than new columns, since computing them (e.g. via an LLM judge call) is an opt-in cost, not a default part of chunking.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="chunks")
    document = relationship("Document", back_populates="chunks")
    questions = relationship("Question", back_populates="chunk")

    __table_args__ = (
        # Partial unique: only enforces uniqueness for active (non-deleted) chunks.
        # Soft-deleted rows can share (document_id, chunk_index) with active ones
        # so re-generation after soft-delete doesn't cause IntegrityError.
        Index(
            "uq_chunk_order_per_document",
            "document_id",
            "chunk_index",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # GIN index over to_tsvector, not a plain-column GIN index — plain
        # GIN on text only helps array/jsonb containment, not full-text
        # search. This is what actually makes `search` filters fast once
        # chunk volume passes a few thousand rows.
        Index(
            "ix_chunks_content_search",
            text("to_tsvector('english', content)"),
            postgresql_using="gin",
        ),
    )


class GAPair(Base):
    __tablename__ = "ga_pairs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=False), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    genre_title = Column(String(128), nullable=False)
    genre_description = Column(Text, nullable=True)
    audience_title = Column(String(128), nullable=False)
    audience_description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="ga_pairs")
    document = relationship("Document", back_populates="ga_pairs")
    questions = relationship("Question", back_populates="ga_pair")


class GenerationRun(Base):
    """
    Tracks WHICH model + WHICH prompt version produced a batch of output.
    This is the traceability backbone — every questions/datasets/conversations
    row links back here so you can always answer "what produced this row?"
    """
    __tablename__ = "generation_runs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    run_type = Column(Enum(GenerationRunType), nullable=False)
    # Lives here, not on Question: the same question text can be answered as
    # QA, MCQ, or classification depending on the run that processes it — the
    # output shape is a property of the generation, not of the question.
    dataset_type = Column(Enum(DatasetType), nullable=True)  # null for runs that don't produce dataset_items (e.g. ga-generation)
    model_name = Column(String(128), nullable=False)
    prompt_type = Column(Enum(PromptType), nullable=True)  # null if run_type has no associated prompt (e.g. export)
    prompt_version = Column(Integer, nullable=True)  # snapshot of custom_prompts.version at call time
    status = Column(Enum(TaskStatus), default=TaskStatus.queued, nullable=False)
    total_items = Column(Integer, default=0, nullable=False)
    processed_items = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)  # set once when completed_at is set — avoids recomputing on every read
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="generation_runs")
    questions = relationship("Question", back_populates="generation_run")
    dataset_items = relationship("DatasetItem", back_populates="generation_run")
    conversations = relationship("Conversation", back_populates="generation_run")
    tasks = relationship("Task", back_populates="generation_run")


class Question(Base, SoftDeleteMixin):
    __tablename__ = "questions"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id = Column(UUID(as_uuid=False), ForeignKey("chunks.id", ondelete="CASCADE"), nullable=False, index=True)
    ga_pair_id = Column(UUID(as_uuid=False), ForeignKey("ga_pairs.id", ondelete="SET NULL"), nullable=True, index=True)
    generation_run_id = Column(UUID(as_uuid=False), ForeignKey("generation_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    question = Column(Text, nullable=False)
    answered = Column(Boolean, default=False, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)  # set whenever a human touches this row post-generation
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="questions")
    chunk = relationship("Chunk", back_populates="questions")
    ga_pair = relationship("GAPair", back_populates="questions")
    generation_run = relationship("GenerationRun", back_populates="questions")
    dataset_items = relationship("DatasetItem", back_populates="question")
    conversations = relationship("Conversation", back_populates="question")

    __table_args__ = (
        Index("ix_questions_project_answered", "project_id", "answered"),
        Index(
            "ix_questions_search",
            text("to_tsvector('english', question)"),
            postgresql_using="gin",
        ),
    )


class DatasetItem(Base, SoftDeleteMixin):
    """
    payload is JSONB rather than fixed question/answer columns because the
    shape genuinely differs by dataset_type:
      qa             -> {"question": "...", "answer": "..."}
      mcq            -> {"question": "...", "options": [...], "correct_answer": "..."}
    classification -> {"text": "...", "label": "..."}
    The dataset_type column (mirrored from the parent generation_run at
    write time) is the discriminator the API layer uses to know which
    payload shape to expect and validate against — see schemas_extended.py
    DatasetPayload variants.

    source_document_id / source_chunk_id / source_ga_pair_id are a
    deliberate denormalization: "which document produced this row" is one
    of the most common questions in a review UI ("show me all dataset
    items from manual.pdf"), and without these you'd join dataset_items ->
    questions -> chunks -> documents on every such query. Written once at
    generation time from question.chunk.document_id and friends; never
    needs updating since lineage is immutable history, not live state.
    """
    __tablename__ = "dataset_items"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=False), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    generation_run_id = Column(UUID(as_uuid=False), ForeignKey("generation_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    source_document_id = Column(UUID(as_uuid=False), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    source_chunk_id = Column(UUID(as_uuid=False), ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True, index=True)
    source_ga_pair_id = Column(UUID(as_uuid=False), ForeignKey("ga_pairs.id", ondelete="SET NULL"), nullable=True)
    dataset_type = Column(Enum(DatasetType), default=DatasetType.qa, nullable=False)
    payload = Column(JSONB, nullable=False)  # shape depends on dataset_type, see docstring above
    item_metadata = Column(JSONB, nullable=True)  # narrow: difficulty, language, generation_temperature — properties OF the item, not a dumping ground
    answer_type = Column(Enum(AnswerType), default=AnswerType.text, nullable=False)
    cot = Column(Text, nullable=True)
    cot_source = Column(Enum(CotSource), default=CotSource.none, nullable=False)
    score = Column(Float, nullable=True)  # null until evaluated
    ai_evaluation = Column(Text, nullable=True)
    confirmed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="dataset_items")
    question = relationship("Question", back_populates="dataset_items")
    generation_run = relationship("GenerationRun", back_populates="dataset_items")

    __table_args__ = (
        Index("ix_datasets_project_confirmed", "project_id", "confirmed"),
        Index("ix_datasets_project_score", "project_id", "score"),
        Index("ix_datasets_project_type", "project_id", "dataset_type"),
        Index("ix_datasets_source_document", "source_document_id"),
        Index("ix_datasets_payload_gin", "payload", postgresql_using="gin"),
    )


class Conversation(Base, SoftDeleteMixin):
    __tablename__ = "conversations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=False), ForeignKey("questions.id", ondelete="SET NULL"), nullable=True, index=True)
    generation_run_id = Column(UUID(as_uuid=False), ForeignKey("generation_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    raw_messages = Column(JSONB, nullable=False)  # [{"from": "human", "value": "..."}, ...]
    turn_count = Column(Integer, nullable=False)
    scenario = Column(String(512), nullable=True)
    role_a = Column(String(64), nullable=True)
    role_b = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="conversations")
    question = relationship("Question", back_populates="conversations")
    generation_run = relationship("GenerationRun", back_populates="conversations")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    generation_run_id = Column(UUID(as_uuid=False), ForeignKey("generation_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    task_type = Column(Enum(TaskType), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.queued, nullable=False)
    total_count = Column(Integer, default=0, nullable=False)
    completed_count = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    error_log = Column(JSONB, default=list, nullable=False)  # [{"item_id": "...", "message": "..."}]
    cancel_requested = Column(Boolean, default=False, nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)  # how many times this task has been auto-retried as a whole
    max_retries = Column(Integer, default=3, nullable=False)  # worker gives up and marks failed beyond this
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="tasks")
    generation_run = relationship("GenerationRun", back_populates="tasks")

    __table_args__ = (
        Index("ix_tasks_project_status", "project_id", "status"),
    )


class LLMUsageLog(Base):
    """
    One row per LLM API call. This is the raw ledger that powers cost
    estimation, the usage dashboard, and per-provider spend breakdowns.
    """
    __tablename__ = "llm_usage_logs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_llm_key_id = Column(UUID(as_uuid=False), ForeignKey("user_llm_keys.id", ondelete="SET NULL"), nullable=True, index=True)
    task_id = Column(UUID(as_uuid=False), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    provider = Column(Enum(LLMProvider), nullable=False)
    model = Column(String(128), nullable=False)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    estimated_cost_usd = Column(Float, nullable=True)  # computed at write-time from the pricing table
    latency_ms = Column(Integer, nullable=False)
    status = Column(String(32), nullable=False)  # "success" | "error"
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    project = relationship("Project", back_populates="usage_logs")

    __table_args__ = (
        Index("ix_usage_project_created", "project_id", "created_at"),
    )


class Export(Base, SoftDeleteMixin):
    __tablename__ = "exports"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    export_type = Column(Enum(ExportType), nullable=False)
    filter_snapshot = Column(JSONB, nullable=False)  # the filter dict used, for history display
    status = Column(String(32), default="generating", nullable=False)  # generating | ready | failed
    storage_url = Column(String(1024), nullable=True)
    row_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="exports")


class CustomPrompt(Base):
    """
    Versioned prompt overrides. Never UPDATE in place — always INSERT a
    new row with version + 1, so generation_runs.prompt_version stays a
    valid, permanent pointer into history even after later edits.
    """
    __tablename__ = "custom_prompts"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt_type = Column(Enum(PromptType), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)  # only one active row per (project, prompt_type)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="custom_prompts")

    __table_args__ = (
        UniqueConstraint("project_id", "prompt_type", "version", name="uq_prompt_version"),
        Index("ix_prompts_active_lookup", "project_id", "prompt_type", "is_active"),
    )
