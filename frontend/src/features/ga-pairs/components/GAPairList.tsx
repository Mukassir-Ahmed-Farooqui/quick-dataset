import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { gaPairsApi } from '@/api/ga_pairs'
import ErrorState from '@/components/common/ErrorState'
import PaginationControls from '@/components/common/PaginationControls'
import SelectionBar from '@/components/common/SelectionBar'
import { ListSkeleton } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Checkbox, Select } from '@/components/ui/input'
import { useGAPairs, useUpdateGAPair } from '@/hooks/useGAPairs'
import { plural } from '@/lib/format'
import { toastError } from '@/lib/toast'
import type { DocumentOut, GAPairOut } from '@/types/api'
import { undoDelete } from '@/features/projects/components/undoDelete'
import GAPairRow from './GAPairRow'
import { toUpdate, type GAPairValues } from './GAPairEditor'
import AddPairDialog from './AddPairDialog'

export default function GAPairList({ projectId, docs }: { projectId: string; docs: DocumentOut[] }) {
  const qc = useQueryClient()
  const [docFilter, setDocFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useGAPairs(projectId, { documentId: docFilter || undefined, page, pageSize })
  const update = useUpdateGAPair(projectId)
  const pairs = useMemo(() => data?.items ?? [], [data])
  const total = data?.pagination.total_items ?? 0
  const names = useMemo(() => new Map(docs.map((d) => [d.id, d.filename])), [docs])

  const visibleSelected = pairs.filter((p) => selected.has(p.id)).map((p) => p.id)
  const allOnPage = pairs.length > 0 && visibleSelected.length === pairs.length

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
      undoDelete<GAPairOut>(qc, {
        listKey: ['ga-pairs', projectId],
        ids,
        message: `${label} deleted`,
        remove: (id) => gaPairsApi.delete(projectId, id),
        invalidate: [['project', projectId]],
        onApplied: () => setSelected((s) => new Set([...s].filter((id) => !ids.includes(id)))),
      }),
    [qc, projectId],
  )
  const onDelete = useCallback((p: GAPairOut) => remove([p.id], 'Pair'), [remove])

  const onSave = useCallback(
    (pairId: string, v: GAPairValues) => {
      setEditingId(null)
      const data = toUpdate(v)
      update.mutate({ pairId, data }, { onError: (err) => toastError('Could not save pair', err, () => update.mutate({ pairId, data })) })
    },
    [update],
  )

  return (
    <section className="space-y-3" aria-labelledby="ga-list-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ga-list-title" className="eyebrow mr-auto text-fg">
          Pairs <span className="num ml-1 text-fg-muted">{total.toLocaleString()}</span>
        </h2>
        <Select
          aria-label="Filter by document"
          value={docFilter}
          onChange={(e) => {
            setDocFilter(e.target.value)
            setPage(1)
            setSelected(new Set())
          }}
          className="h-8 w-auto max-w-[240px] text-xs"
        >
          <option value="">All documents</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={docs.length === 0}>
          <Plus /> Add manually
        </Button>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : pairs.length === 0 ? (
        <p className="border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-muted">
          {docFilter ? 'No pairs for this document yet.' : 'No pairs yet — generate them above or add one manually.'}
        </p>
      ) : (
        <div className="border border-line">
          <label className="flex cursor-pointer items-center gap-3 border-b border-line bg-bg-subtle px-4 py-2">
            <Checkbox
              checked={allOnPage}
              indeterminate={!allOnPage && visibleSelected.length > 0}
              onChange={() =>
                setSelected((s) => {
                  const n = new Set(s)
                  pairs.forEach((p) => (allOnPage ? n.delete(p.id) : n.add(p.id)))
                  return n
                })
              }
              aria-label="Select all pairs on this page"
            />
            <span className="eyebrow">Select page</span>
          </label>
          <ul className={isPlaceholderData ? 'divide-y divide-line-hair opacity-60' : 'divide-y divide-line-hair'}>
            {pairs.map((p) => (
              <GAPairRow
                key={p.id}
                pair={p}
                filename={docFilter ? undefined : names.get(p.document_id)}
                selected={selected.has(p.id)}
                editing={editingId === p.id}
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
        <Button variant="outline" size="xs" onClick={() => remove(visibleSelected, plural(visibleSelected.length, 'pair'))}>
          <Trash2 /> Delete
        </Button>
      </SelectionBar>

      {adding && <AddPairDialog projectId={projectId} docs={docs} open={adding} onOpenChange={setAdding} />}
    </section>
  )
}
