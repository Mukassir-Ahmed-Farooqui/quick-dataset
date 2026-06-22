import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gaPairsApi } from '@/api/ga_pairs'
import type { GAGeneratePayload, GAPairCreate, GAPairUpdate } from '@/types/api'

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
  })
}

export function useGenerateGAPairs(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: GAGeneratePayload) => gaPairsApi.generate(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ga-pairs', projectId] })
    },
  })
}

export function useEstimateGAPairs(projectId: string) {
  return useMutation({
    mutationFn: (data: GAGeneratePayload) => gaPairsApi.estimate(projectId, data),
  })
}

export function useCreateGAPair(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: GAPairCreate) => gaPairsApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ga-pairs', projectId] })
    },
  })
}

export function useUpdateGAPair(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ pairId, data }: { pairId: string; data: GAPairUpdate }) =>
      gaPairsApi.update(projectId, pairId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ga-pairs', projectId] })
    },
  })
}

export function useDeleteGAPair(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pairId: string) => gaPairsApi.delete(projectId, pairId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ga-pairs', projectId] })
    },
  })
}
