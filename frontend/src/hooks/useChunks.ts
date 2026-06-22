import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chunksApi, type ChunkGeneratePayload, type ChunkPreviewPayload } from '@/api/chunks'

interface UseChunksOptions {
  documentId?: string
  page?: number
  pageSize?: number
  search?: string
}

export function useChunks(projectId: string, options: UseChunksOptions = {}) {
  const { documentId, page = 1, pageSize = 50, search } = options
  return useQuery({
    queryKey: ['chunks', projectId, documentId, { search }, page, pageSize],
    queryFn: () => chunksApi.list(projectId, documentId, page, pageSize),
    enabled: !!projectId,
    refetchInterval: 5000,
  })
}

export function useChunkPreview(projectId: string) {
  return useMutation({
    mutationFn: (data: ChunkPreviewPayload) => chunksApi.preview(projectId, data),
  })
}

export function useGenerateChunks(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ChunkGeneratePayload) => chunksApi.generate(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chunks', projectId] })
    },
  })
}

export function useUpdateChunk(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ chunkId, content }: { chunkId: string; content: string }) =>
      chunksApi.update(projectId, chunkId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chunks', projectId] })
    },
  })
}

export function useDeleteChunk(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (chunkId: string) => chunksApi.delete(projectId, chunkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chunks', projectId] })
    },
  })
}
