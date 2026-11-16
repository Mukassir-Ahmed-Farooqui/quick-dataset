import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Inbox, ListChecks, MessageSquare, RotateCw, Trash2, X } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { ListSkeleton } from '@/components/common/LoadingState'
import PaginationControls from '@/components/common/PaginationControls'
import SelectionBar from '@/components/common/SelectionBar'
import VirtualList, { type VirtualListHandle } from '@/components/common/VirtualList'
import { TaskTray } from '@/components/common/TaskProgress'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { useDebounce } from '@/hooks/useDebounce'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useQuestionStats } from '@/hooks/useQuestions'
import { useBulkConfirmItems, useBulkDeleteItems, useDatasetItems, useUpdateDatasetItem } from '@/hooks/useDatasetItems'
import { patchPagedLists, removeIds, restore } from '@/lib/optimistic'
import { useTrackedTasks } from '@/lib/tasks'
import { undoable } from '@/lib/undo'
import { sonnerToast, toastError } from '@/lib/toast'
import { plural } from '@/lib/format'
import type { DatasetItemOut } from '@/types/api'
import AnswerGeneratePanel from '../components/AnswerGeneratePanel'
import ItemDetail from '../components/ItemDetail'
import ReviewRow from '../components/ReviewRow'
import ReviewToolbar from '../components/ReviewToolbar'
import { answerKey, EMPTY_REVIEW_FILTERS, type ReviewFilters } from '../components/payload'

type Snapshot = Awaited<ReturnType<typeof patchPagedLists>>

export default function DatasetReviewPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Filters + paging ──
  const [filters, setFiltersState] = useState<ReviewFilters>(EMPTY_REVIEW_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const minScoreRaw = useDebounce(filters.minScore, 300)
  const minScore = minScoreRaw === '' || Number.isNaN(Number(minScoreRaw)) ? undefined : Number(minScoreRaw)
  const setFilters = (f: ReviewFilters) => {
    setFiltersState(f)
    setPage(1)
  }
  const filtersActive = !!(filters.status || filters.type || filters.minScore)

  const statsQ = useQuestionStats(projectId)
  const listQ = useDatasetItems(projectId, {
    datasetType: filters.type || undefined,
    confirmed: filters.status === '' ? undefined : filters.status === 'approved',
    minScore,
    page,
    pageSize,
  })
  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data])
  const meta = listQ.data?.pagination
  const unanswered = statsQ.data?.unanswered ?? 0
  const tasks = useTrackedTasks(projectId).filter((t) => t.kind === 'answers')

  // ── Active item (two-pane) ──
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIndex = Math.max(0, items.findIndex((i) => i.id === activeId))
  const active: DatasetItemOut | undefined = items[activeIndex]
  const listRef = useRef<VirtualListHandle>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = !!active && editingId === active.id

  const goTo = useCallback(
    (idx: number) => {
      if (items.length === 0) return
      const i = Math.max(0, Math.min(items.length - 1, idx))
      setActiveId(items[i].id)
      setEditingId(null)
      listRef.current?.scrollToIndex(i)
    },
    [items],
  )

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastIndex = useRef<number | null>(null)
  const ids = useMemo(() => items.map((i) => i.id), [items])
  const selectedOnPage = ids.filter((id) => selected.has(id)).length
  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const toggleOne = useCallback(
    (id: string, shiftKey: boolean) => {
      const idx = ids.indexOf(id)
      setSelected((prev) => {
        const next = new Set(prev)
        if (shiftKey && lastIndex.current !== null && idx >= 0) {
          const [a, b] = [Math.min(lastIndex.current, idx), Math.max(lastIndex.current, idx)]
          const on = !prev.has(id)
          ids.slice(a, b + 1).forEach((x) => (on ? next.add(x) : next.delete(x)))
        } else if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      lastIndex.current = idx
    },
    [ids],
  )

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id))
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)))
      return next
    })

  const onActivate = useCallback((id: string) => {
    setActiveId(id)
    setEditingId(null)
  }, [])

  // ── Mutations ──
  const update = useUpdateDatasetItem(projectId)
  const bulkConfirm = useBulkConfirmItems(projectId)
  const bulkDelete = useBulkDeleteItems(projectId)

  const setConfirmed = (item: DatasetItemOut | undefined, confirmed: boolean) => {
    if (!item) return
    const idx = items.findIndex((i) => i.id === item.id)
    // If the item will drop out of the current filter, move to its neighbour.
    const leaves = (filters.status === 'pending' && confirmed) || (filters.status === 'approved' && !confirmed)
    const nextItem = items[idx + 1] ?? (leaves ? items[idx - 1] : undefined)
    if (item.confirmed !== confirmed) {
      update.mutate({ itemId: item.id, data: { confirmed } }, { onError: (err) => toastError(confirmed ? 'Could not approve' : 'Could not reject', err) })
    }
    if (nextItem) goTo(items.indexOf(nextItem))
  }

  const saveAnswer = (value: string) => {
    if (!active) return
    const key = answerKey(active)
    let payload: Record<string, unknown>
    if (key) payload = { ...active.payload, [key]: value }
    else {
      try {
        payload = JSON.parse(value) as Record<string, unknown>
      } catch {
        sonnerToast.error('Invalid JSON', { description: 'Fix the payload syntax and save again.' })
        return
      }
    }
    update.mutate(
      { itemId: active.id, data: { payload } },
      { onSuccess: () => setEditingId(null), onError: (err) => toastError('Could not save answer', err) },
    )
  }

  const bulkSet = (confirmed: boolean) => {
    const sel = [...selected]
    bulkConfirm.mutate(
      { ids: sel, confirmed },
      {
        onSuccess: () => {
          sonnerToast.success(`${plural(sel.length, 'item')} ${confirmed ? 'approved' : 'rejected'}`)
          clearSelection()
        },
        onError: (err) => toastError(confirmed ? 'Could not approve items' : 'Could not reject items', err),
      },
    )
  }

  const deleteIds = (del: string[]) => {
    if (del.length === 0) return
    const key = ['dataset-items', projectId]
    if (active && del.includes(active.id)) {
      const rest = items.filter((i) => !del.includes(i.id))
      const after = items.slice(activeIndex + 1).find((i) => !del.includes(i.id)) ?? rest[rest.length - 1]
      setActiveId(after?.id ?? null)
    }
    let snap: Snapshot | undefined
    void undoable({
      message: del.length === 1 ? 'Item deleted' : `${plural(del.length, 'item')} deleted`,
      apply: async () => {
        snap = await patchPagedLists<DatasetItemOut>(qc, key, removeIds(del))
        setSelected((prev) => {
          const next = new Set(prev)
          del.forEach((id) => next.delete(id))
          return next
        })
      },
      rollback: () => {
        restore(qc, snap)
        qc.invalidateQueries({ queryKey: key })
      },
      commit: () => bulkDelete.mutateAsync(del),
      onCommitted: () => {
        qc.invalidateQueries({ queryKey: key })
        qc.invalidateQueries({ queryKey: ['questions', projectId] })
        qc.invalidateQueries({ queryKey: ['questions_stats', projectId] })
        qc.invalidateQueries({ queryKey: ['project', projectId] })
      },
    })
  }

  // ── Keyboard: a approve · r reject · j/k next/prev · e edit · x select ──
  useHotkeys(
    {
      a: () => setConfirmed(active, true),
      r: () => setConfirmed(active, false),
      j: () => goTo(activeIndex + 1),
      k: () => goTo(activeIndex - 1),
      ArrowDown: () => goTo(activeIndex + 1),
      ArrowUp: () => goTo(activeIndex - 1),
      e: () => active && setEditingId(active.id),
      x: () => active && toggleOne(active.id, false),
      Escape: () => (editing ? setEditingId(null) : clearSelection()),
    },
    items.length > 0,
  )

  // ── Generate panel (auto-open when there is nothing to review yet) ──
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null)
  const noItemsAtAll = !listQ.isLoading && (meta?.total_items ?? 0) === 0 && !filtersActive
  const showPanel = unanswered > 0 && (panelOpen ?? noItemsAtAll)
  const approvedOnPage = items.filter((i) => i.confirmed).length

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        eyebrow="Step 5 · Answers"
        title="Review answers"
        description="Approve the pairs worth training on and reject the rest. Only approved items are exported by default."
        action={
          <>
            {unanswered > 0 && !showPanel && (
              <Button variant="outline" onClick={() => setPanelOpen(true)}>
                <ListChecks /> Generate answers
                <span className="num ml-1 text-fg-muted">{unanswered.toLocaleString()}</span>
              </Button>
            )}
            <Button onClick={() => navigate(`/projects/${projectId}/export`)} disabled={(meta?.total_items ?? 0) === 0 && !filtersActive}>
              Export <ArrowRight />
            </Button>
          </>
        }
      />

      <TaskTray tasks={tasks} />

      {showPanel && <AnswerGeneratePanel projectId={projectId} documents={statsQ.data?.documents ?? []} onClose={() => setPanelOpen(false)} />}

      {listQ.isLoading ? (
        <ListSkeleton rows={8} />
      ) : listQ.isError ? (
        <ErrorState error={listQ.error} onRetry={() => void listQ.refetch()} />
      ) : noItemsAtAll ? (
        <EmptyState
          icon={MessageSquare}
          step="Step 5 · Answers"
          title={unanswered > 0 ? `${plural(unanswered, 'question')} waiting for answers` : 'No answers yet'}
          description={
            unanswered > 0
              ? 'Generate answers above. Each answer is scored for quality, so you can review the weakest first.'
              : 'Generate questions first, then come back to answer and review them.'
          }
          bullets={['a approve · r reject · j/k move · e edit', 'Filter by status or minimum score', 'Approved items flow into export']}
          action={
            unanswered === 0 ? (
              <Button onClick={() => navigate(`/projects/${projectId}/questions`)}>
                Go to questions <ArrowRight />
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section className="border border-line bg-bg">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
            <ReviewToolbar value={filters} onChange={setFilters} />
            <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-fg-muted xl:flex">
              <Kbd>a</Kbd> approve <Kbd>r</Kbd> reject <Kbd>j</Kbd>
              <Kbd>k</Kbd> move <Kbd>e</Kbd> edit <Kbd>x</Kbd> select
            </span>
          </div>

          <div className="grid lg:h-[calc(100vh-300px)] lg:min-h-[520px] lg:grid-cols-[minmax(300px,2fr)_3fr]">
            {/* List pane */}
            <div className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2.5 border-b border-line-hair bg-bg-subtle px-3 py-2">
                <Checkbox
                  checked={ids.length > 0 && selectedOnPage === ids.length}
                  indeterminate={selectedOnPage > 0 && selectedOnPage < ids.length}
                  onChange={toggleAll}
                  aria-label="Select all on this page"
                />
                <span className="eyebrow">{meta ? plural(meta.total_items, 'item') : '—'}</span>
                <span className="font-mono text-[10.5px] text-fg-muted">
                  {approvedOnPage}/{items.length} approved on page
                </span>
                {listQ.isFetching && <RotateCw className="ml-auto size-3 animate-spin text-fg-muted" aria-label="Refreshing" />}
              </div>
              {items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                  <Inbox className="size-5 text-fg-subtle" strokeWidth={1.5} />
                  <p className="font-display text-sm font-bold">Nothing matches</p>
                  <p className="text-sm text-fg-secondary">{filters.status === 'pending' ? 'All caught up — every item here is reviewed.' : 'Loosen the filters to see more.'}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilters(EMPTY_REVIEW_FILTERS)}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <VirtualList
                  ref={listRef}
                  items={items}
                  getKey={(i) => i.id}
                  estimateSize={66}
                  label="Dataset items"
                  className="max-h-[50vh] min-h-0 flex-1 lg:max-h-none"
                  renderItem={(item, i) => (
                    <ReviewRow item={item} index={i} active={item.id === active?.id} selected={selected.has(item.id)} onActivate={onActivate} onToggle={toggleOne} />
                  )}
                />
              )}
              <PaginationControls
                meta={meta}
                page={page}
                pageSize={pageSize}
                sizes={[25, 50, 100]}
                onPageChange={(p) => {
                  setPage(p)
                  setActiveId(null)
                }}
                onPageSizeChange={(s) => {
                  setPageSize(s)
                  setPage(1)
                }}
              />
            </div>

            {/* Detail pane */}
            <div className="min-h-[420px] min-w-0">
              {active ? (
                <ItemDetail
                  key={active.id}
                  item={active}
                  position={{ index: activeIndex, total: items.length }}
                  editing={editing}
                  saving={update.isPending && update.variables?.itemId === active.id && !!update.variables.data.payload}
                  onEdit={(on) => setEditingId(on ? active.id : null)}
                  onSaveAnswer={saveAnswer}
                  onApprove={() => setConfirmed(active, true)}
                  onReject={() => setConfirmed(active, false)}
                  onDelete={() => deleteIds([active.id])}
                  onPrev={() => goTo(activeIndex - 1)}
                  onNext={() => goTo(activeIndex + 1)}
                />
              ) : (
                <div className="grid h-full place-items-center p-10 text-sm text-fg-muted">Select an item to review.</div>
              )}
            </div>
          </div>
        </section>
      )}

      <SelectionBar count={selected.size} onClear={clearSelection}>
        <Button variant="outline" size="xs" onClick={() => bulkSet(true)} loading={bulkConfirm.isPending && bulkConfirm.variables?.confirmed}>
          <Check /> Approve
        </Button>
        <Button variant="outline" size="xs" onClick={() => bulkSet(false)} loading={bulkConfirm.isPending && !bulkConfirm.variables?.confirmed}>
          <X /> Reject
        </Button>
        <Button variant="outline" size="xs" onClick={() => deleteIds([...selected])}>
          <Trash2 /> Delete
        </Button>
      </SelectionBar>
    </div>
  )
}
