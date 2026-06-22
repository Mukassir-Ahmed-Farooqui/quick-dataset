import { apiClient } from './client'
import type { LLMKeyCreate, LLMKeyOut, LLMKeyTestResult, PageEnvelope } from '@/types/api'

export const providersApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PageEnvelope<LLMKeyOut>>('/providers', { params: { page, page_size: pageSize } }).then(r => r.data),

  create: (data: LLMKeyCreate) =>
    apiClient.post<LLMKeyOut>('/providers', data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/providers/${id}`),

  test: (id: string, model?: string) =>
    apiClient.post<LLMKeyTestResult>(`/providers/${id}/test`, null, { params: { model } }).then(r => r.data),
}
