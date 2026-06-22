import { apiClient } from './client'
import type { ProjectCreate, ProjectUpdate, ProjectDetailOut, ProjectListItemOut, PageEnvelope } from '@/types/api'

export const projectsApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PageEnvelope<ProjectListItemOut>>('/projects', { params: { page, page_size: pageSize } }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<ProjectDetailOut>(`/projects/${id}`).then(r => r.data),

  create: (data: ProjectCreate) =>
    apiClient.post<ProjectDetailOut>('/projects', data).then(r => r.data),

  update: (id: string, data: ProjectUpdate) =>
    apiClient.patch<ProjectDetailOut>(`/projects/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/projects/${id}`),
}
