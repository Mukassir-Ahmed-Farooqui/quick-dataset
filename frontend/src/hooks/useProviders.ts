import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { providersApi } from '@/api/providers'
import type { LLMKeyCreate, LLMKeyUpdate } from '@/types/api'

export function useProviders(options: { page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 50 } = options
  return useQuery({
    queryKey: ['providers', page, pageSize],
    queryFn: () => providersApi.list(page, pageSize),
    staleTime: 60_000,
  })
}

export function useCreateProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LLMKeyCreate) => providersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useDeleteProvider() {
  return useMutation({ mutationFn: (id: string) => providersApi.delete(id) })
}

export function useTestProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, model }: { id: string; model?: string }) => providersApi.test(id, model),
    onSettled: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useUpdateProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: LLMKeyUpdate }) => providersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}
