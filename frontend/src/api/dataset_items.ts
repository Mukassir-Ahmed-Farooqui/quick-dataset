import { apiClient } from './client'
import type {
  DatasetItemOut, DatasetItemUpdate, AnswerGeneratePayload,
  DatasetBulkConfirmRequest, DatasetBulkDeleteRequest,
  GenerationEstimateResponse, TaskAcceptedResponse, PageEnvelope,
} from '@/types/api'

export const datasetItemsApi = {
  list: (
    projectId: string,
    params?: {
      dataset_type?: string
      confirmed?: boolean
      min_score?: number
      generation_run_id?: string
      page?: number
      page_size?: number
    },
  ) =>
    apiClient.get<PageEnvelope<DatasetItemOut>>(`/projects/${projectId}/dataset-items`, { params }).then(r => r.data),

  get: (projectId: string, itemId: string) =>
    apiClient.get<DatasetItemOut>(`/projects/${projectId}/dataset-items/${itemId}`).then(r => r.data),

  update: (projectId: string, itemId: string, data: DatasetItemUpdate) =>
    apiClient.patch<DatasetItemOut>(`/projects/${projectId}/dataset-items/${itemId}`, data).then(r => r.data),

  generate: (projectId: string, data: AnswerGeneratePayload) =>
    apiClient.post<TaskAcceptedResponse>(`/projects/${projectId}/dataset-items/generate`, data).then(r => r.data),

  estimate: (projectId: string, data: AnswerGeneratePayload) =>
    apiClient.post<GenerationEstimateResponse>(`/projects/${projectId}/dataset-items/estimate`, data).then(r => r.data),

  bulkConfirm: (projectId: string, data: DatasetBulkConfirmRequest) =>
    apiClient.post(`/projects/${projectId}/dataset-items/bulk-confirm`, data),

  bulkDelete: (projectId: string, data: DatasetBulkDeleteRequest) =>
    apiClient.post(`/projects/${projectId}/dataset-items/bulk-delete`, data),
}
