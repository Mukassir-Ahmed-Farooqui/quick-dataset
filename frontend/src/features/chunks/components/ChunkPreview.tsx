import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { chunksApi } from '@/api/chunks'
import ErrorState from '@/components/common/ErrorState'
import { Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { WindowFrame } from '@/components/ui/window-frame'
import { useDebounce } from '@/hooks/useDebounce'
import type { DocumentOut } from '@/types/api'
import type { ChunkConfig } from './chunkConfig'

interface ChunkPreviewProps {
  projectId: string
  docs: DocumentOut[]
  docId: string | undefined
  onDocChange: (id: string) => void
  config: ChunkConfig
  valid: boolean
}

/** Live preview of how the selected settings split one document. Nothing is saved. */
export default function ChunkPreview({ projectId, docs, docId, onDocChange, config, valid }: ChunkPreviewProps) {
  const debounced = useDebounce(config, 400)
  const params = docId
    ? { document_id: docId, strategy: debounced.strategy, chunk_size: debounced.chunkSize, chunk_overlap: debounced.chunkOverlap }
    : null

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['chunk-preview', projectId, params],
    queryFn: () => chunksApi.preview(projectId, params!),
    enabled: !!params && valid,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  })

  const doc = docs.find((d) => d.id === docId)

  return (
    <WindowFrame
      title={doc ? `preview — ${doc.filename}` : 'preview'}
      right={isFetching && <Loader2 className="size-3 animate-spin text-fg-muted" aria-label="Updating preview" />}
      className="h-full min-h-[320px]"
      bodyClassName="flex flex-col"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line-hair px-3 py-2">
        <label htmlFor="preview-doc" className="eyebrow">
          Sample from
        </label>
        <Select id="preview-doc" value={docId ?? ''} onChange={(e) => onDocChange(e.target.value)} className="h-7 w-auto min-w-0 max-w-[60%] flex-1 text-xs">
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </Select>
        {data && (
          <span className="num ml-auto text-[11px] text-fg-secondary">
            ≈ {data.estimated_total_chunks.toLocaleString()} chunks
          </span>
        )}
      </div>

      <div className="max-h-[420px] min-h-0 flex-1 overflow-y-auto">
        {!valid ? (
          <p className="p-4 text-xs text-fg-muted">Fix the settings to see a preview.</p>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} compact className="m-3" />
        ) : isLoading || !data ? (
          <div className="space-y-4 p-4" aria-busy aria-label="Loading preview">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : data.sample_chunks.length === 0 ? (
          <p className="p-4 text-xs text-fg-muted">This document produced no text to chunk.</p>
        ) : (
          <ol className="divide-y divide-line-hair">
            {data.sample_chunks.map((c, i) => (
              <li key={i} className="px-4 py-3">
                <p className="mb-1.5 flex items-center gap-2 font-mono text-[11px] text-fg-muted">
                  <span className="text-accent">#{i}</span>
                  <span>{c.length.toLocaleString()} chars</span>
                </p>
                <p className="line-clamp-6 whitespace-pre-wrap font-mono text-xs leading-relaxed text-fg-secondary">{c}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </WindowFrame>
  )
}
