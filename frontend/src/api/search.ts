import { apiClient } from './client'
import type { SearchResponse } from '@/types/api'

export const searchApi = {
  search: (projectId: string, q: string, limit = 20) =>
    apiClient.get<SearchResponse>(`/projects/${projectId}/search`, { params: { q, limit } }).then(r => r.data),
}
