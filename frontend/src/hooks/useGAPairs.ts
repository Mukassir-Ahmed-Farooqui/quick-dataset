import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { gaPairsApi } from '@/api/ga_pairs'
import { patchIds, patchPagedLists, restore } from '@/lib/optimistic'
import type { GAGeneratePayload, GAPairCreate, GAPairOut, GAPairUpdate } from '@/types/api'

interface UseGAPairsOptions {
  documentId?: string
  page?: number
  pageSize?: number
}

export function useGAPairs(projectId: string, options: UseGAPairsOptions = {}) {
  const { documentId, page = 1, pageSize = 50 } = options
  return useQuery({
    queryKey: ['ga-pairs', projectId, documentId, page, pageSize],
    queryFn: () => gaPairsApi.list(projectId, documentId, page, pageSize),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  })
}

export function useGenerateGAPairs(projectId: string) {
  return useMutation({ mutationFn: (data: GAGeneratePayload) => gaPairsApi.generate(projectId, data) })
}

export function useEstimateGAPairs(projectId: string) {
  return useMutation({ mutationFn: (data: GAGeneratePayload) => gaPairsApi.estimate(projectId, data) })
}

export function useCreateGAPair(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GAPairCreate) => gaPairsApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ga-pairs', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useUpdateGAPair(projectId: string) {
  const qc = useQueryClient()
  const key = ['ga-pairs', projectId]
  return useMutation({
    mutationFn: ({ pairId, data }: { pairId: string; data: GAPairUpdate }) => gaPairsApi.update(projectId, pairId, data),
    onMutate: ({ pairId, data }) => patchPagedLists<GAPairOut>(qc, key, patchIds([pairId], data as Partial<GAPairOut>)),
    onError: (_e, _v, snap) => restore(qc, snap),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteGAPair(projectId: string) {
  return useMutation({ mutationFn: (pairId: string) => gaPairsApi.delete(projectId, pairId) })
}
