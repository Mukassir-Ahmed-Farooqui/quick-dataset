import { apiClient } from './client'
import type {
  GAPairOut, GAPairCreate, GAPairUpdate, GAGeneratePayload,
  GenerationEstimateResponse, TaskAcceptedResponse, PageEnvelope,
} from '@/types/api'

export const gaPairsApi = {
  list: (projectId: string, documentId?: string, page = 1, pageSize = 50) => {
    const params: Record<string, unknown> = { page, page_size: pageSize }
    if (documentId !== undefined) {
      params.document_id = documentId
    }
    return apiClient.get<PageEnvelope<GAPairOut>>(`/projects/${projectId}/ga-pairs`, { params }).then(r => r.data)
  },

  create: (projectId: string, data: GAPairCreate) =>
    apiClient.post<GAPairOut>(`/projects/${projectId}/ga-pairs`, data).then(r => r.data),

  generate: (projectId: string, data: GAGeneratePayload) =>
    apiClient.post<TaskAcceptedResponse>(`/projects/${projectId}/ga-pairs/generate`, data).then(r => r.data),

  estimate: (projectId: string, data: GAGeneratePayload) =>
    apiClient.post<GenerationEstimateResponse>(`/projects/${projectId}/ga-pairs/estimate`, data).then(r => r.data),

  update: (projectId: string, pairId: string, data: GAPairUpdate) =>
    apiClient.patch<GAPairOut>(`/projects/${projectId}/ga-pairs/${pairId}`, data).then(r => r.data),

  delete: (projectId: string, pairId: string) =>
    apiClient.delete(`/projects/${projectId}/ga-pairs/${pairId}`),
}
