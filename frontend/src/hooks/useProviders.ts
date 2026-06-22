import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { providersApi } from '@/api/providers'
import type { LLMKeyCreate } from '@/types/api'

interface UseProvidersOptions {
  page?: number
  pageSize?: number
  search?: string
}

export function useProviders(options: UseProvidersOptions = {}) {
  const { page = 1, pageSize = 50, search } = options
  return useQuery({
    queryKey: ['providers', { search }, page, pageSize],
    queryFn: () => providersApi.list(page, pageSize),
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LLMKeyCreate) => providersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => providersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}

export function useTestProvider() {
  return useMutation({
    mutationFn: ({ id, model }: { id: string; model?: string }) => providersApi.test(id, model),
  })
}
