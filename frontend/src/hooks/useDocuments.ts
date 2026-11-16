import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'

interface UseDocumentsOptions {
  page?: number
  pageSize?: number
}

/** Polls every 2.5s only while some document is still queued/parsing. */
export function useDocuments(projectId: string, options: UseDocumentsOptions = {}) {
  const { page = 1, pageSize = 100 } = options
  return useQuery({
    queryKey: ['documents', projectId, page, pageSize],
    queryFn: () => documentsApi.list(projectId, page, pageSize),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const items = query.state.data?.items
      if (!items) return false
      return items.some((d) => d.processing_status === 'queued' || d.processing_status === 'parsing') ? 2500 : false
    },
  })
}

export function useUploadDocuments(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => documentsApi.upload(projectId, files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useDeleteDocument(projectId: string) {
  return useMutation({ mutationFn: (documentId: string) => documentsApi.delete(projectId, documentId) })
}
