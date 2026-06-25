import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exportsApi } from '@/api/exports'
import type { ExportCreate } from '@/types/api'

export function useExports(projectId: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['exports', projectId, page, pageSize],
    queryFn: () => exportsApi.list(projectId, page, pageSize),
    enabled: !!projectId,
  })
}

export function useCreateExport(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ExportCreate) => exportsApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports', projectId] })
    },
  })
}

export function useDeleteExport(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (exportId: string) => exportsApi.delete(projectId, exportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports', projectId] })
    },
  })
}
