import { apiClient } from './client'
import type {
  PromptOut, PromptUpsertRequest,
  PromptRenderRequest, PromptRenderResponse,
  PromptTestRequest, PromptTestResponse,
} from '@/types/api'

export const promptsApi = {
  getActive: (projectId: string, promptType: string) =>
    apiClient.get<PromptOut>(`/projects/${projectId}/prompts/${promptType}`).then(r => r.data),

  listVersions: (projectId: string, promptType: string) =>
    apiClient.get<PromptOut[]>(`/projects/${projectId}/prompts/${promptType}/versions`).then(r => r.data),

  getVersion: (projectId: string, promptType: string, version: number) =>
    apiClient.get<PromptOut>(`/projects/${projectId}/prompts/${promptType}/versions/${version}`).then(r => r.data),

  upsert: (projectId: string, promptType: string, data: PromptUpsertRequest) =>
    apiClient.put<PromptOut>(`/projects/${projectId}/prompts/${promptType}`, data).then(r => r.data),

  render: (projectId: string, promptType: string, data: PromptRenderRequest) =>
    apiClient.post<PromptRenderResponse>(`/projects/${projectId}/prompts/${promptType}/render`, data).then(r => r.data),

  test: (projectId: string, promptType: string, data: PromptTestRequest) =>
    apiClient.post<PromptTestResponse>(`/projects/${projectId}/prompts/${promptType}/test`, data).then(r => r.data),
}
