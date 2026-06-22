import { apiClient } from './client'
import type { TaskOut } from '@/types/api'

export const tasksApi = {
  get: (taskId: string) =>
    apiClient.get<TaskOut>(`/tasks/${taskId}`).then(r => r.data),

  cancel: (taskId: string) =>
    apiClient.post<TaskOut>(`/tasks/${taskId}/cancel`).then(r => r.data),
}
