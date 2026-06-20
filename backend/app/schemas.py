"""
Pydantic v2 schemas — exact request/response contracts.
Naming convention: {Entity}Create (request body for POST), {Entity}Update
(PATCH body, all fields optional), {Entity}Out (response shape).
"""
from datetime import datetime
from typing import Optional, Literal, Any
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
import re


# ── Shared ───────────────────────────────────────────────────────────

class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PageEnvelope(BaseModel):
    """Every list endpoint returns this exact shape."""
    model_config = ConfigDict(arbitrary_types_allowed=True)
    items: list
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    detail: str
    code: str


# ── Auth ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("password must contain at least one letter and one number")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    email: EmailStr
    avatar_url: Optional[str] = None
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut


# ── LLM Keys / Providers ────────────────────────────────────────────

class LLMKeyCreate(BaseModel):
    provider: Literal["openrouter", "openai", "groq", "gemini"]
    name: str = Field(min_length=1, max_length=128)
    api_key: str = Field(min_length=10)  # raw key, never stored or echoed back
    is_default: bool = False


class LLMKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    provider: str
    name: str
    masked_key: str  # computed field, e.g. "sk-...ab12" — see service layer
    is_default: bool
    is_valid: Optional[bool]
    last_validated_at: Optional[datetime]
    created_at: datetime


class LLMKeyTestResult(BaseModel):
    """Response for POST /providers/{id}/test. Named LLMKeyTestResult since
    it tests a saved key row, not a free-floating provider — but the shape
    covers everything a 'ProviderTestResult' would need."""
    success: bool
    provider: str
    model: str
    latency_ms: Optional[int] = None
    error: Optional[str] = None


# ── Projects ─────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    default_llm_key_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    default_llm_key_id: Optional[str] = None


class PipelineProgress(BaseModel):
    documents: int
    chunks: int
    ga_pairs: int
    questions: int
    questions_reviewed: int
    dataset_items: int
    dataset_items_confirmed: int


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str]
    status: str
    default_llm_key: Optional[LLMKeyOut] = None
    created_at: datetime
    updated_at: datetime


class ProjectDetailOut(ProjectOut):
    pipeline_progress: PipelineProgress


class ProjectListItemOut(ProjectOut):
    document_count: int
    question_count: int
    dataset_item_count: int
    last_activity_at: Optional[datetime]


# ── Generation config (shared base — see generation-architecture.md) ──

class GenerationConfigBase(BaseModel):
    """
    Every generate-something endpoint extends this. Centralizing it means
    llm_key_id resolution, temperature override, and max_tokens override
    are validated identically everywhere instead of six slightly-different
    copies drifting apart over time.
    """
    llm_key_id: Optional[str] = None  # falls back to project.default_llm_key_id if omitted
    temperature_override: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens_override: Optional[int] = Field(default=None, ge=1, le=32000)


class QuestionGenerateRequest(GenerationConfigBase):
    chunk_ids: list[str] = Field(min_length=1)
    ga_pair_ids: Optional[list[str]] = None
    dataset_type: Literal["qa", "mcq", "conversation", "classification"] = "qa"
    questions_per_combination: int = Field(default=1, ge=1, le=10)


class GenerationEstimateResponse(BaseModel):
    estimated_item_count: int
    estimated_input_tokens: int
    estimated_output_tokens: int
    estimated_cost_usd: float
    warning: Optional[str] = None  # e.g. "this exceeds 1000 items, consider narrowing your selection"


class TaskAcceptedResponse(BaseModel):
    task_id: str
    generation_run_id: str


# ── Tasks ────────────────────────────────────────────────────────────

class TaskErrorEntry(BaseModel):
    item_id: Optional[str]
    message: str


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    task_type: str
    status: Literal["queued", "processing", "done", "failed", "cancelled"]
    total_count: int
    completed_count: int
    error_count: int
    error_log: list[TaskErrorEntry]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


# ── Usage tracking ───────────────────────────────────────────────────

class UsageLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: Optional[float]
    latency_ms: int
    status: str
    created_at: datetime


class UsageSummary(BaseModel):
    total_calls: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    by_provider: dict[str, float]  # provider -> cost_usd
    by_task_type: dict[str, float]  # task_type -> cost_usd
    period_start: datetime
    period_end: datetime
