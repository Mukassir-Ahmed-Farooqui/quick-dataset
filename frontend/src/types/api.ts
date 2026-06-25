export interface PaginationMeta {
  page: number
  page_size: number
  total_items: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

export interface PageEnvelope<T> {
  items: T[]
  pagination: PaginationMeta
}

export interface ErrorResponse {
  detail: string
  code: string
}

export interface User {
  id: string
  username: string
  email: string
  avatar_url: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
}

export interface ProjectCreate {
  name: string
  description?: string
  default_llm_key_id?: string
}

export interface ProjectUpdate {
  name?: string
  description?: string
  default_llm_key_id?: string
}

export interface LLMKeyCreate {
  provider: LLMProvider
  name: string
  api_key: string
  is_default?: boolean
}

export interface LLMKeyUpdate {
  name?: string
  api_key?: string
  is_default?: boolean
}

export type LLMProvider = 'openrouter' | 'openai' | 'groq' | 'gemini'

export interface LLMKeyOut {
  id: string
  provider: string
  name: string
  masked_key: string
  is_default: boolean
  is_valid: boolean | null
  last_validated_at: string | null
  created_at: string
}

export interface GAPairOut {
  id: string
  document_id: string
  genre_title: string
  genre_description: string | null
  audience_title: string
  audience_description: string | null
  created_at: string
}

export interface GAPairCreate {
  document_id: string
  genre_title: string
  genre_description?: string
  audience_title: string
  audience_description?: string
}

export interface GAPairUpdate {
  genre_title?: string
  genre_description?: string
  audience_title?: string
  audience_description?: string
}

export interface GAGeneratePayload {
  document_ids: string[]
  pairs_per_document: number
  model?: string
  llm_key_id?: string
}

export interface GenerationEstimateResponse {
  estimated_item_count: number
  estimated_input_tokens: number
  estimated_output_tokens: number
  estimated_cost_usd: number
  warning: string | null
}

export interface LLMKeyTestResult {
  success: boolean
  provider: string
  model: string
  latency_ms: number | null
  error: string | null
}

export interface PipelineProgress {
  documents: number
  chunks: number
  ga_pairs: number
  questions: number
  questions_reviewed: number
  dataset_items: number
  dataset_items_confirmed: number
}

export interface ProjectOut {
  id: string
  name: string
  description: string | null
  status: string
  default_llm_key: LLMKeyOut | null
  created_at: string
  updated_at: string
}

export interface ProjectDetailOut extends ProjectOut {
  pipeline_progress: PipelineProgress
}

export interface ProjectListItemOut extends ProjectOut {
  document_count: number
  question_count: number
  dataset_item_count: number
  last_activity_at: string | null
}

export type ProcessingStatus = 'queued' | 'parsing' | 'parsed' | 'failed'

export interface DocumentOut {
  id: string
  filename: string
  file_type: 'pdf' | 'docx' | 'md' | 'txt'
  file_size: number
  processing_status: ProcessingStatus
  parse_error: string | null
  created_at: string
}

export type ChunkStrategy = 'recursive' | 'markdown' | 'token'

export interface ChunkOut {
  id: string
  document_id: string
  chunk_index: number
  content: string
  token_count: number
  created_at: string
}

export interface ChunkPreviewOut {
  sample_chunks: string[]
  estimated_total_chunks: number
}

// ── Questions ────────────────────────────────────────────────────────

export interface QuestionOut {
  id: string
  chunk_id: string
  ga_pair_id: string | null
  generation_run_id: string | null
  question: string
  answered: boolean
  reviewed_at: string | null
  created_at: string
  document_id: string | null
  document_filename: string | null
}

export interface QuestionStatsDocument {
  document_id: string | null
  document_filename: string | null
  unanswered_count: number
  unanswered_question_ids: string[]
}

export interface QuestionStatsResponse {
  total: number
  answered: number
  unanswered: number
  documents: QuestionStatsDocument[]
}

export interface QuestionCreate {
  chunk_id: string
  ga_pair_id?: string
  question: string
}

export interface QuestionUpdate {
  question?: string
}

export interface QuestionBulkDeleteRequest {
  ids: string[]
}

export interface QuestionBulkUpdateRequest {
  ids: string[]
  patch: QuestionUpdate
}

export interface QuestionGeneratePayload {
  chunk_ids: string[]
  ga_pair_ids?: string[]
  dataset_type?: 'qa' | 'mcq' | 'conversation' | 'classification'
  questions_per_combination?: number
  llm_key_id?: string
  temperature_override?: number
  max_tokens_override?: number
}

// ── Generation Runs ──────────────────────────────────────────────────

export interface GenerationRunOut {
  id: string
  run_type: string
  dataset_type: string | null
  model_name: string
  prompt_type: string | null
  prompt_version: number | null
  status: string
  total_items: number
  processed_items: number
  created_at: string
}

export interface TaskAcceptedResponse {
  task_id: string
  generation_run_id: string
}

export interface TaskErrorEntry {
  item_id: string | null
  message: string
}

export interface TaskOut {
  id: string
  task_type: string
  status: 'queued' | 'processing' | 'done' | 'failed' | 'cancelled'
  total_count: number
  completed_count: number
  error_count: number
  error_log: TaskErrorEntry[]
  started_at: string | null
  completed_at: string | null
}

// ── Dataset Items ───────────────────────────────────────────────────

export interface DatasetItemOut {
  id: string
  question_id: string
  generation_run_id: string | null
  dataset_type: 'qa' | 'mcq' | 'conversation' | 'classification'
  payload: Record<string, unknown>
  answer_type: string
  cot: string | null
  cot_source: string
  score: number | null
  ai_evaluation: string | null
  confirmed: boolean
  created_at: string
  updated_at: string
  source_document_filename: string | null
  source_chunk_index: number | null
}

export interface DatasetItemUpdate {
  payload?: Record<string, unknown>
  cot?: string
  confirmed?: boolean
}

export interface AnswerGeneratePayload {
  question_ids: string[]
  dataset_type?: 'qa' | 'mcq' | 'conversation' | 'classification'
  llm_key_id?: string
  temperature_override?: number
  max_tokens_override?: number
}

export interface DatasetBulkConfirmRequest {
  ids: string[]
  confirmed: boolean
}

export interface DatasetBulkDeleteRequest {
  ids: string[]
}

// ── Exports ─────────────────────────────────────────────────────────

export interface ExportFilter {
  confirmed?: boolean
  min_score?: number
  generation_run_id?: string
}

export interface ExportCreate {
  export_type: 'json' | 'jsonl' | 'alpaca' | 'sharegpt'
  filter: ExportFilter
}

export interface ExportOut {
  id: string
  export_type: string
  filter_snapshot: ExportFilter
  status: 'generating' | 'ready' | 'failed'
  storage_url: string | null
  row_count: number | null
  created_at: string
}

// ── Search ──────────────────────────────────────────────────────────

export interface SearchResult {
  entity_type: 'document' | 'chunk' | 'question' | 'dataset_item' | 'conversation'
  entity_id: string
  title: string
  snippet: string
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
}

// ── Prompts ─────────────────────────────────────────────────────────

export interface PromptOut {
  prompt_type: string
  content: string
  version: number
  is_system_default: boolean
  created_at: string | null
}

export interface PromptUpsertRequest {
  content: string
}

export interface PromptRenderRequest {
  prompt_type: string
  content: string
  variables: Record<string, string>
}

export interface PromptRenderResponse {
  rendered_prompt: string
  unresolved_variables: string[]
}

export interface PromptTestRequest {
  prompt_type: string
  content: string
  variables: Record<string, string>
  llm_key_id: string
}

export interface PromptTestResponse {
  rendered_prompt: string
  llm_output: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
}
