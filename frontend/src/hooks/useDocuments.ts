import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'
import type { DocumentOut, PageEnvelope } from '@/types/api'

interface UseDocumentsOptions {
  page?: number
  pageSize?: number
  search?: string
}

export function useDocuments(projectId: string, options: UseDocumentsOptions = {}) {
  const { page = 1, pageSize = 50, search } = options
  return useQuery({
    queryKey: ['documents', projectId, { search }, page, pageSize],
    queryFn: () => documentsApi.list(projectId, page, pageSize),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as PageEnvelope<DocumentOut> | undefined
      if (!data?.items) return 5000
      const hasPending = data.items.some(
        (d) => d.processing_status === 'queued' || d.processing_status === 'parsing',
      )
      return hasPending ? 3000 : false
    },
  })
}

export function useUploadDocuments(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => documentsApi.upload(projectId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
    },
  })
}

export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) => documentsApi.delete(projectId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
    },
  })
}
