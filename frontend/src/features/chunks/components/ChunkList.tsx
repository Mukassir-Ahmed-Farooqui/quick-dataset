import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { chunksApi } from '@/api/chunks'
import ErrorState from '@/components/common/ErrorState'
import PaginationControls from '@/components/common/PaginationControls'
import SelectionBar from '@/components/common/SelectionBar'
import { ListSkeleton } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Checkbox, Select } from '@/components/ui/input'
import { useChunks, useUpdateChunk } from '@/hooks/useChunks'
import { plural } from '@/lib/format'
import { toastError } from '@/lib/toast'
import type { ChunkOut, DocumentOut } from '@/types/api'
import { undoDelete } from '@/features/projects/components/undoDelete'
import ChunkRow from './ChunkRow'

export default function ChunkList({ projectId, docs }: { projectId: string; docs: DocumentOut[] }) {
  const qc = useQueryClient()
  const [docFilter, setDocFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useChunks(projectId, { documentId: docFilter || undefined, page, pageSize })
  const update = useUpdateChunk(projectId)
  const chunks = useMemo(() => data?.items ?? [], [data])
  const total = data?.pagination.total_items ?? 0
  const names = useMemo(() => new Map(docs.map((d) => [d.id, d.filename])), [docs])

  const visibleSelected = chunks.filter((c) => selected.has(c.id)).map((c) => c.id)
  const allOnPage = chunks.length > 0 && visibleSelected.length === chunks.length

  const toggle = useCallback(
    (id: string) =>
      setSelected((s) => {
        const n = new Set(s)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      }),
    [],
  )

  const remove = useCallback(
    (ids: string[], label: string) =>
      undoDelete<ChunkOut>(qc, {
        listKey: ['chunks', projectId],
        ids,
        message: `${label} deleted`,
        remove: (id) => chunksApi.delete(projectId, id),
        invalidate: [['project', projectId]],
        onApplied: () => setSelected((s) => new Set([...s].filter((id) => !ids.includes(id)))),
      }),
    [qc, projectId],
  )

  const onDelete = useCallback((c: ChunkOut) => remove([c.id], `Chunk #${c.chunk_index}`), [remove])

  const onSave = useCallback(
    (chunkId: string, content: string) => {
      setEditingId(null)
      update.mutate({ chunkId, content }, { onError: (err) => toastError('Could not save chunk', err, () => update.mutate({ chunkId, content })) })
    },
    [update],
  )

  return (
    <section className="space-y-3" aria-labelledby="chunk-list-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="chunk-list-title" className="eyebrow text-fg">
          Saved chunks <span className="num ml-1 text-fg-muted">{total.toLocaleString()}</span>
        </h2>
        <Select
          aria-label="Filter by document"
          value={docFilter}
          onChange={(e) => {
            setDocFilter(e.target.value)
            setPage(1)
            setSelected(new Set())
          }}
          className="ml-auto h-8 w-auto max-w-[260px] text-xs"
        >
          <option value="">All documents</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : chunks.length === 0 ? (
        <p className="border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-muted">
          {docFilter ? 'No chunks for this document yet.' : 'No chunks yet — generate them above.'}
        </p>
      ) : (
        <div className="border border-line" aria-busy={isPlaceholderData || undefined}>
          <label className="flex cursor-pointer items-center gap-3 border-b border-line bg-bg-subtle px-4 py-2">
            <Checkbox
              checked={allOnPage}
              indeterminate={!allOnPage && visibleSelected.length > 0}
              onChange={() =>
                setSelected((s) => {
                  const n = new Set(s)
                  chunks.forEach((c) => (allOnPage ? n.delete(c.id) : n.add(c.id)))
                  return n
                })
              }
              aria-label="Select all chunks on this page"
            />
            <span className="eyebrow">Select page</span>
          </label>
          <ul className={isPlaceholderData ? 'divide-y divide-line-hair opacity-60' : 'divide-y divide-line-hair'}>
            {chunks.map((c) => (
              <ChunkRow
                key={c.id}
                chunk={c}
                filename={docFilter ? undefined : names.get(c.document_id)}
                selected={selected.has(c.id)}
                editing={editingId === c.id}
                saving={update.isPending && update.variables?.chunkId === c.id}
                onToggle={toggle}
                onEdit={setEditingId}
                onSave={onSave}
                onDelete={onDelete}
              />
            ))}
          </ul>
          <PaginationControls
            meta={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}

      <SelectionBar count={visibleSelected.length} onClear={() => setSelected(new Set())}>
        <Button variant="outline" size="xs" onClick={() => remove(visibleSelected, plural(visibleSelected.length, 'chunk'))}>
          <Trash2 /> Delete
        </Button>
      </SelectionBar>
    </section>
  )
}
