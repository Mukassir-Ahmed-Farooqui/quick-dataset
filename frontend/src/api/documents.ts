import { apiClient } from './client'
import type { DocumentOut, PageEnvelope } from '@/types/api'

export const documentsApi = {
  list: (projectId: string, page = 1, pageSize = 20) =>
    apiClient.get<PageEnvelope<DocumentOut>>(`/projects/${projectId}/documents`, { params: { page, page_size: pageSize } }).then(r => r.data),

  get: (projectId: string, documentId: string) =>
    apiClient.get<DocumentOut>(`/projects/${projectId}/documents/${documentId}`).then(r => r.data),

  upload: (projectId: string, files: File[]) => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    return apiClient.post<DocumentOut[]>(`/projects/${projectId}/documents/upload`, formData).then(r => r.data)
  },

  delete: (projectId: string, documentId: string) =>
    apiClient.delete(`/projects/${projectId}/documents/${documentId}`),
}
