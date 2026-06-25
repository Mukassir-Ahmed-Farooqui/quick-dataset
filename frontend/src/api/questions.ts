import { apiClient } from './client'
import type {
  QuestionOut, QuestionCreate, QuestionUpdate,
  QuestionGeneratePayload, QuestionBulkDeleteRequest,
  GenerationEstimateResponse, TaskAcceptedResponse, PageEnvelope,
  QuestionStatsResponse,
} from '@/types/api'

export const questionsApi = {
  list: (
    projectId: string,
    params?: {
      chunk_id?: string
      ga_pair_id?: string
      generation_run_id?: string
      status?: string
      search?: string
      page?: number
      page_size?: number
    },
  ) =>
    apiClient.get<PageEnvelope<QuestionOut>>(`/projects/${projectId}/questions`, { params }).then(r => r.data),

  getStats: (projectId: string) =>
    apiClient.get<QuestionStatsResponse>(`/projects/${projectId}/questions/stats`).then(r => r.data),

  get: (projectId: string, questionId: string) =>
    apiClient.get<QuestionOut>(`/projects/${projectId}/questions/${questionId}`).then(r => r.data),

  create: (projectId: string, data: QuestionCreate) =>
    apiClient.post<QuestionOut>(`/projects/${projectId}/questions`, data).then(r => r.data),

  update: (projectId: string, questionId: string, data: QuestionUpdate) =>
    apiClient.patch<QuestionOut>(`/projects/${projectId}/questions/${questionId}`, data).then(r => r.data),

  delete: (projectId: string, questionId: string) =>
    apiClient.delete(`/projects/${projectId}/questions/${questionId}`),

  bulkDelete: (projectId: string, data: QuestionBulkDeleteRequest) =>
    apiClient.post(`/projects/${projectId}/questions/bulk-delete`, data),

  bulkUpdate: (projectId: string, data: { ids: string[]; patch: QuestionUpdate }) =>
    apiClient.post(`/projects/${projectId}/questions/bulk-update`, data),

  generate: (projectId: string, data: QuestionGeneratePayload) =>
    apiClient.post<TaskAcceptedResponse>(`/projects/${projectId}/questions/generate`, data).then(r => r.data),

  estimate: (projectId: string, data: QuestionGeneratePayload) =>
    apiClient.post<GenerationEstimateResponse>(`/projects/${projectId}/questions/estimate`, data).then(r => r.data),
}
