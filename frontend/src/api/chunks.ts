import { apiClient } from './client'
import type { ChunkOut, ChunkPreviewOut, ChunkStrategy, TaskAcceptedResponse, PageEnvelope } from '@/types/api'

export interface ChunkGeneratePayload {
  document_ids: string[]
  strategy: ChunkStrategy
  chunk_size: number
  chunk_overlap: number
}

export interface ChunkPreviewPayload {
  document_id: string
  strategy: ChunkStrategy
  chunk_size: number
  chunk_overlap: number
}

export const chunksApi = {
  list: (projectId: string, documentId?: string, page = 1, pageSize = 20) => {
    const params: Record<string, unknown> = { page, page_size: pageSize }
    if (documentId !== undefined) {
      params.document_id = documentId
    }
    return apiClient.get<PageEnvelope<ChunkOut>>(`/projects/${projectId}/chunks`, { params }).then(r => r.data)
  },

  get: (projectId: string, chunkId: string) =>
    apiClient.get<ChunkOut>(`/projects/${projectId}/chunks/${chunkId}`).then(r => r.data),

  preview: (projectId: string, data: ChunkPreviewPayload) =>
    apiClient.post<ChunkPreviewOut>(`/projects/${projectId}/chunks/preview`, data).then(r => r.data),

  generate: (projectId: string, data: ChunkGeneratePayload) =>
    apiClient.post<TaskAcceptedResponse>(`/projects/${projectId}/chunks/generate`, data).then(r => r.data),

  update: (projectId: string, chunkId: string, content: string) =>
    apiClient.patch<ChunkOut>(`/projects/${projectId}/chunks/${chunkId}`, { content }).then(r => r.data),

  delete: (projectId: string, chunkId: string) =>
    apiClient.delete(`/projects/${projectId}/chunks/${chunkId}`),
}
