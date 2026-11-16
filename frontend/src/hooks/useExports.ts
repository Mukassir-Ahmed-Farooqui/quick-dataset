import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exportsApi } from '@/api/exports'
import type { ExportCreate } from '@/types/api'

/** Polls while an export is still generating. */
export function useExports(projectId: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['exports', projectId, page, pageSize],
    queryFn: () => exportsApi.list(projectId, page, pageSize),
    enabled: !!projectId,
    refetchInterval: (q) => (q.state.data?.items.some((e) => e.status === 'generating') ? 2000 : false),
  })
}

export function useCreateExport(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExportCreate) => exportsApi.create(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exports', projectId] }),
  })
}

export function useDeleteExport(projectId: string) {
  return useMutation({ mutationFn: (exportId: string) => exportsApi.delete(projectId, exportId) })
}
