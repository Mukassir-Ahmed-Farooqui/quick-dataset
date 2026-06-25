import { apiClient } from './client'
import type { ExportCreate, ExportOut, PageEnvelope } from '@/types/api'

export const exportsApi = {
  list: (projectId: string, page = 1, pageSize = 20) =>
    apiClient.get<PageEnvelope<ExportOut>>(`/projects/${projectId}/exports`, { params: { page, page_size: pageSize } }).then(r => r.data),

  create: (projectId: string, data: ExportCreate) =>
    apiClient.post<ExportOut>(`/projects/${projectId}/exports`, data).then(r => r.data),

  download: (projectId: string, exportId: string) =>
    apiClient.get<Blob>(`/projects/${projectId}/exports/${exportId}/download`, { responseType: 'blob' }).then(r => r.data),

  delete: (projectId: string, exportId: string) =>
    apiClient.delete(`/projects/${projectId}/exports/${exportId}`),
}
