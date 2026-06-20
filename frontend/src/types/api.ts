export interface PageEnvelope<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ErrorResponse {
  detail: string
  code: string
}

export interface UserOut {
  id: string
  username: string
  email: string
  avatar_url: string | null
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  user: UserOut
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
