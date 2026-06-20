"""
Pydantic v2 schemas — Part 2.
Covers everything schemas.py left out: documents, chunks, GA pairs, full
question/dataset/conversation CRUD (not just the generate request), exports,
and prompts. Import alongside schemas.py — split only for file length.
"""
from datetime import datetime
from typing import Optional, Literal, Any, Dict, List
from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.schemas import GenerationConfigBase  # reuse the shared base


class LLMResponse(BaseModel):
    content: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ProviderTestResult(BaseModel):
    success: bool
    provider: str
    model: str
    latency_ms: int
    error: Optional[str] = None


# ── Documents ────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    filename: str
    file_type: Literal["pdf", "docx", "md", "txt"]
    file_size: int
    processing_status: Literal["queued", "parsing", "parsed", "failed"]
    parse_error: Optional[str] = None
    created_at: datetime


class DocumentUploadAccepted(BaseModel):
    documents: list[DocumentOut]


class DocumentDetailOut(DocumentOut):
    page_count: Optional[int] = None
    detected_language: Optional[str] = None
    parse_warnings: list[str] = Field(default_factory=list)


# ── Chunks ───────────────────────────────────────────────────────────

class ChunkGenerateRequest(BaseModel):
    document_ids: list[str] = Field(min_length=1)
    strategy: Literal["recursive", "markdown", "token"] = "recursive"
    chunk_size: int = Field(default=1000, ge=100, le=8000)
    chunk_overlap: int = Field(default=100, ge=0)

    @model_validator(mode="after")
    def check_overlap_smaller_than_size(self):
        # overlap must be meaningfully smaller than chunk_size or chunking
        # degenerates into near-duplicate chunks
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self


class ChunkPreviewRequest(BaseModel):
    document_id: str
    strategy: Literal["recursive", "markdown", "token"] = "recursive"
    chunk_size: int = Field(default=1000, ge=100, le=8000)
    chunk_overlap: int = Field(default=100, ge=0)


class ChunkPreviewOut(BaseModel):
    sample_chunks: list[str]  # first 3 chunks' content, not persisted
    estimated_total_chunks: int


class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_id: str
    chunk_index: int
    content: str
    token_count: int
    created_at: datetime


class ChunkUpdate(BaseModel):
    content: str = Field(min_length=1)


# ── GA Pairs ─────────────────────────────────────────────────────────

class GAPairGenerateRequest(BaseModel):
    document_ids: list[str] = Field(min_length=1)
    count_per_document: int = Field(default=3, ge=1, le=10)


class GAPairCreate(BaseModel):
    document_id: str
    genre_title: str = Field(min_length=1, max_length=128)
    genre_description: Optional[str] = None
    audience_title: str = Field(min_length=1, max_length=128)
    audience_description: Optional[str] = None


class GAPairUpdate(BaseModel):
    genre_title: Optional[str] = Field(default=None, min_length=1, max_length=128)
    genre_description: Optional[str] = None
    audience_title: Optional[str] = Field(default=None, min_length=1, max_length=128)
    audience_description: Optional[str] = None


class GAPairOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_id: str
    genre_title: str
    genre_description: Optional[str]
    audience_title: str
    audience_description: Optional[str]
    created_at: datetime


# ── Questions (full CRUD — generate request already lives in schemas.py) ──

class QuestionCreate(BaseModel):
    chunk_id: str
    ga_pair_id: Optional[str] = None
    question: str = Field(min_length=1)


class QuestionUpdate(BaseModel):
    question: Optional[str] = Field(default=None, min_length=1)


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    chunk_id: str
    ga_pair_id: Optional[str]
    generation_run_id: Optional[str]
    question: str
    answered: bool
    reviewed_at: Optional[datetime]
    created_at: datetime


class QuestionBulkDeleteRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=500)


class QuestionBulkUpdateRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=500)
    patch: QuestionUpdate


class QuestionListFilters(BaseModel):
    """Query params for GET /projects/{id}/questions — documented as a model for clarity, parsed from query string."""
    status: Optional[Literal["unanswered", "answered"]] = None
    chunk_id: Optional[str] = None
    ga_pair_id: Optional[str] = None
    generation_run_id: Optional[str] = None
    search: Optional[str] = None


# ── Answer generation + Dataset items ───────────────────────────────

class AnswerGenerateRequest(GenerationConfigBase):
    question_ids: list[str] = Field(min_length=1)
    dataset_type: Literal["qa", "mcq", "conversation", "classification"] = "qa"
    include_cot: bool = False


# Discriminated payload shapes — the API validates against the right one
# based on dataset_type before writing/reading a dataset_items row.

class QAPayload(BaseModel):
    question: str
    answer: str


class MCQPayload(BaseModel):
    question: str
    options: list[str] = Field(min_length=2)
    correct_answer: str

    @model_validator(mode="after")
    def check_answer_in_options(self):
        if self.correct_answer not in self.options:
            raise ValueError("correct_answer must be one of the provided options")
        return self


class ClassificationPayload(BaseModel):
    text: str
    label: str


DatasetPayload = QAPayload | MCQPayload | ClassificationPayload


class DatasetItemUpdate(BaseModel):
    payload: Optional[dict] = None  # validated against the row's dataset_type server-side before persisting
    cot: Optional[str] = None
    confirmed: Optional[bool] = None


class DatasetItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    question_id: str
    generation_run_id: Optional[str]
    dataset_type: Literal["qa", "mcq", "conversation", "classification"]
    payload: dict  # shape matches QAPayload / MCQPayload / ClassificationPayload per dataset_type
    answer_type: Literal["text", "label", "custom_format"]
    cot: Optional[str]
    cot_source: Literal["none", "generated", "optimized", "failed"]
    score: Optional[float]
    ai_evaluation: Optional[str]
    confirmed: bool
    created_at: datetime
    updated_at: datetime


class DatasetListFilters(BaseModel):
    confirmed: Optional[bool] = None
    min_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    generation_run_id: Optional[str] = None
    dataset_type: Optional[Literal["qa", "mcq", "conversation", "classification"]] = None


class DatasetBulkConfirmRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=2000)
    confirmed: bool = True


class DatasetBulkDeleteRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=2000)


class DatasetBulkExportRequest(BaseModel):
    """Export a hand-picked set of ids directly, bypassing the filter-based ExportCreate flow."""
    ids: list[str] = Field(min_length=1, max_length=5000)
    export_type: Literal["json", "jsonl", "alpaca", "sharegpt"]


# ── Evaluation ───────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    dataset_ids: list[str] = Field(min_length=1)
    judge_llm_key_id: Optional[str] = None


class ScoreDistributionBucket(BaseModel):
    range_start: float
    range_end: float
    count: int


class ScoresSummary(BaseModel):
    total_scored: int
    mean_score: Optional[float]
    median_score: Optional[float]
    below_threshold_count: int  # count where score < 0.5, the "needs attention" figure
    distribution: list[ScoreDistributionBucket]


# ── Conversations ────────────────────────────────────────────────────

class ConversationGenerateRequest(GenerationConfigBase):
    question_ids: list[str] = Field(min_length=1)
    turn_count: int = Field(default=4, ge=2, le=20)
    scenario: str = Field(min_length=1, max_length=512)
    role_a: str = Field(min_length=1, max_length=64)
    role_b: str = Field(min_length=1, max_length=64)


class ConversationMessage(BaseModel):
    from_: Literal["human", "gpt"] = Field(alias="from")
    value: str

    model_config = ConfigDict(populate_by_name=True)


class ConversationUpdate(BaseModel):
    raw_messages: list[ConversationMessage] = Field(min_length=1)


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    question_id: Optional[str]
    generation_run_id: Optional[str]
    raw_messages: list[ConversationMessage]
    turn_count: int
    scenario: Optional[str]
    role_a: Optional[str]
    role_b: Optional[str]
    created_at: datetime


# ── Generation Runs ──────────────────────────────────────────────────

class GenerationRunOut(BaseModel):
    """Backs GET /projects/{id}/runs — the traceability view: which model
    and prompt version produced which batch of output."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_type: str
    dataset_type: Optional[Literal["qa", "mcq", "conversation", "classification"]]
    model_name: str
    prompt_type: Optional[str]
    prompt_version: Optional[int]  # 0 means system default was used, not a project override
    status: Literal["queued", "processing", "done", "failed", "cancelled"]
    total_items: int
    processed_items: int
    created_at: datetime


# ── Global Search ────────────────────────────────────────────────────

class SearchResult(BaseModel):
    entity_type: Literal["document", "chunk", "question", "dataset_item", "conversation"]
    entity_id: str
    title: str
    snippet: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int


# ── Prompt Playground ────────────────────────────────────────────────

class PromptRenderRequest(BaseModel):
    """Renders a template against sample variables WITHOUT calling an LLM —
    pure string substitution, instant feedback while editing a prompt."""
    prompt_type: Literal["ga", "question", "answer", "evaluation", "conversation", "cot_synthesis", "cot_optimization"]
    content: str  # the draft content being edited, not yet saved
    variables: dict[str, str]


class PromptRenderResponse(BaseModel):
    rendered_prompt: str
    unresolved_variables: list[str] = Field(default_factory=list)  # {{vars}} in content with no matching key in `variables`


class PromptTestRequest(BaseModel):
    """Actually fires the rendered prompt at an LLM — costs a real call, unlike render."""
    prompt_type: Literal["ga", "question", "answer", "evaluation", "conversation", "cot_synthesis", "cot_optimization"]
    content: str
    variables: dict[str, str]
    llm_key_id: str


class PromptTestResponse(BaseModel):
    rendered_prompt: str
    llm_output: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


# ── CoT ──────────────────────────────────────────────────────────────

class CotSynthesizeRequest(GenerationConfigBase):
    pass  # dataset_id comes from the URL path, not the body


class CotOptimizeResult(BaseModel):
    previous_cot: str
    new_cot: str
    dataset_id: str


class CotBatchSynthesizeRequest(GenerationConfigBase):
    dataset_ids: list[str] = Field(min_length=1)


# ── Exports ──────────────────────────────────────────────────────────

class ExportFilter(BaseModel):
    confirmed: Optional[bool] = None
    min_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    generation_run_id: Optional[str] = None


class ExportCreate(BaseModel):
    export_type: Literal["json", "jsonl", "alpaca", "sharegpt"]
    filter: ExportFilter = Field(default_factory=ExportFilter)


class ExportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    export_type: str
    filter_snapshot: ExportFilter
    status: Literal["generating", "ready", "failed"]
    storage_url: Optional[str]
    row_count: Optional[int]
    created_at: datetime


# ── Custom Prompts ───────────────────────────────────────────────────

class PromptUpsertRequest(BaseModel):
    content: str = Field(min_length=1)


class PromptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    prompt_type: str
    content: str
    version: int
    is_system_default: bool  # true when no project override exists (version 0)
    created_at: Optional[datetime] = None


class PromptValidationError(BaseModel):
    detail: str = "unrecognized template variables"
    code: str = "UNKNOWN_TEMPLATE_VARS"
    unknown_variables: list[str]


# ── Stats ────────────────────────────────────────────────────────────

class ProjectStatsOut(BaseModel):
    """Backs GET /projects/{id}/stats — one call powers the whole dashboard.
    Reuses the same typed PipelineProgress and UsageSummary from schemas.py
    rather than loose dicts, so the dashboard component can rely on the
    field names instead of guessing at dict keys."""
    pipeline_progress: "PipelineProgress"
    recent_tasks: list["TaskOut"]
    usage_summary: "UsageSummary"
    recent_exports: list[ExportOut]


from app.schemas import PipelineProgress, TaskOut, UsageSummary  # noqa: E402  (avoids circular import at module top)
ProjectStatsOut.model_rebuild()
