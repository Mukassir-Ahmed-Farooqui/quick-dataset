import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { chunksApi, type ChunkGeneratePayload, type ChunkPreviewPayload } from '@/api/chunks'
import { patchIds, patchPagedLists, restore } from '@/lib/optimistic'
import type { ChunkOut } from '@/types/api'

interface UseChunksOptions {
  documentId?: string
  page?: number
  pageSize?: number
  enabled?: boolean
}

export function useChunks(projectId: string, options: UseChunksOptions = {}) {
  const { documentId, page = 1, pageSize = 50, enabled = true } = options
  return useQuery({
    queryKey: ['chunks', projectId, documentId, page, pageSize],
    queryFn: () => chunksApi.list(projectId, documentId, page, pageSize),
    enabled: !!projectId && enabled,
    placeholderData: keepPreviousData,
  })
}

export function useChunkPreview(projectId: string) {
  return useMutation({ mutationFn: (data: ChunkPreviewPayload) => chunksApi.preview(projectId, data) })
}

export function useGenerateChunks(projectId: string) {
  return useMutation({ mutationFn: (data: ChunkGeneratePayload) => chunksApi.generate(projectId, data) })
}

export function useUpdateChunk(projectId: string) {
  const qc = useQueryClient()
  const key = ['chunks', projectId]
  return useMutation({
    mutationFn: ({ chunkId, content }: { chunkId: string; content: string }) => chunksApi.update(projectId, chunkId, content),
    onMutate: ({ chunkId, content }) => patchPagedLists<ChunkOut>(qc, key, patchIds<ChunkOut>([chunkId], { content })),
    onError: (_e, _v, snap) => restore(qc, snap),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteChunk(projectId: string) {
  return useMutation({ mutationFn: (chunkId: string) => chunksApi.delete(projectId, chunkId) })
}
