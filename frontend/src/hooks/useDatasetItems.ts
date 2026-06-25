import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { datasetItemsApi } from '@/api/dataset_items'
import type { AnswerGeneratePayload, DatasetItemUpdate } from '@/types/api'

interface UseDatasetItemsOptions {
  datasetType?: string
  confirmed?: boolean
  minScore?: number
  generationRunId?: string
  page?: number
  pageSize?: number
}

export function useDatasetItems(projectId: string, options: UseDatasetItemsOptions = {}) {
  const { datasetType, confirmed, minScore, generationRunId, page = 1, pageSize = 50 } = options
  return useQuery({
    queryKey: ['dataset-items', projectId, { datasetType, confirmed, minScore, generationRunId }, page, pageSize],
    queryFn: () => datasetItemsApi.list(projectId, {
      dataset_type: datasetType,
      confirmed,
      min_score: minScore,
      generation_run_id: generationRunId,
      page,
      page_size: pageSize,
    }),
    enabled: !!projectId,
  })
}

export function useGenerateAnswers(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AnswerGeneratePayload) => datasetItemsApi.generate(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', projectId] })
      queryClient.invalidateQueries({ queryKey: ['questions', projectId] })
    },
  })
}

export function useEstimateAnswers(projectId: string) {
  return useMutation({
    mutationFn: (data: AnswerGeneratePayload) => datasetItemsApi.estimate(projectId, data),
  })
}

export function useUpdateDatasetItem(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: DatasetItemUpdate }) =>
      datasetItemsApi.update(projectId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', projectId] })
    },
  })
}

export function useBulkConfirmItems(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { ids: string[]; confirmed: boolean }) =>
      datasetItemsApi.bulkConfirm(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', projectId] })
    },
  })
}

export function useBulkDeleteItems(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      datasetItemsApi.bulkDelete(projectId, { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', projectId] })
    },
  })
}
