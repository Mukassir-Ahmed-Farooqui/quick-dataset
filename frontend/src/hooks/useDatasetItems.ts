import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { datasetItemsApi } from '@/api/dataset_items'
import { patchIds, patchPagedLists, restore } from '@/lib/optimistic'
import type { AnswerGeneratePayload, DatasetItemOut, DatasetItemUpdate } from '@/types/api'

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
    queryFn: () =>
      datasetItemsApi.list(projectId, {
        dataset_type: datasetType,
        confirmed,
        min_score: minScore,
        generation_run_id: generationRunId,
        page,
        page_size: pageSize,
      }),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  })
}

export function useGenerateAnswers(projectId: string) {
  return useMutation({
    mutationFn: (data: AnswerGeneratePayload) => datasetItemsApi.generate(projectId, data),
  })
}

export function useEstimateAnswers(projectId: string) {
  return useMutation({
    mutationFn: (data: AnswerGeneratePayload) => datasetItemsApi.estimate(projectId, data),
  })
}

/** Optimistic: confirm/unconfirm and payload edits show instantly. */
export function useUpdateDatasetItem(projectId: string) {
  const qc = useQueryClient()
  const key = ['dataset-items', projectId]
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: DatasetItemUpdate }) => datasetItemsApi.update(projectId, itemId, data),
    onMutate: ({ itemId, data }) => patchPagedLists<DatasetItemOut>(qc, key, patchIds([itemId], data as Partial<DatasetItemOut>)),
    onError: (_e, _v, snap) => restore(qc, snap),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useBulkConfirmItems(projectId: string) {
  const qc = useQueryClient()
  const key = ['dataset-items', projectId]
  return useMutation({
    mutationFn: (data: { ids: string[]; confirmed: boolean }) => datasetItemsApi.bulkConfirm(projectId, data),
    onMutate: ({ ids, confirmed }) => patchPagedLists<DatasetItemOut>(qc, key, patchIds(ids, { confirmed })),
    onError: (_e, _v, snap) => restore(qc, snap),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useBulkDeleteItems(projectId: string) {
  return useMutation({ mutationFn: (ids: string[]) => datasetItemsApi.bulkDelete(projectId, { ids }) })
}
