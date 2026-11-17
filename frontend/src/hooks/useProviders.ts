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

/** Live model list for one key. The backend caches it for about an hour. */
export function useProviderModels(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['providers', 'models', id],
    queryFn: () => providersApi.models(id as string),
    enabled: !!id && enabled,
    staleTime: 60 * 60_000,
    retry: false,
  })
}
