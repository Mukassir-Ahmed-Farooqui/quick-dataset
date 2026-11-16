import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Layers, ListChecks, MessageSquare, Plus, RotateCw, Search, Trash2 } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { ListSkeleton } from '@/components/common/LoadingState'
import PaginationControls from '@/components/common/PaginationControls'
import SelectionBar from '@/components/common/SelectionBar'
import VirtualList from '@/components/common/VirtualList'
import { TaskTray } from '@/components/common/TaskProgress'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { useDocuments } from '@/hooks/useDocuments'
import { useChunks } from '@/hooks/useChunks'
import { useGAPairs } from '@/hooks/useGAPairs'
import { useDebounce } from '@/hooks/useDebounce'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useBulkDeleteQuestions, useQuestionStats, useQuestions, useUpdateQuestion } from '@/hooks/useQuestions'
import { useGenerateAnswers } from '@/hooks/useDatasetItems'
import { patchPagedLists, removeIds, restore } from '@/lib/optimistic'
import { trackTask, useTrackedTasks } from '@/lib/tasks'
import { undoable } from '@/lib/undo'
import { sonnerToast, toastError } from '@/lib/toast'
import { plural } from '@/lib/format'
import type { ChunkOut, GAPairOut, QuestionOut } from '@/types/api'
import GeneratePanel from '../components/GeneratePanel'
import QuestionRow from '../components/QuestionRow'
import QuestionToolbar from '../components/QuestionToolbar'
import { EMPTY_FILTERS, type QuestionFilters } from '../components/filters'

type Snapshot = Awaited<ReturnType<typeof patchPagedLists>>

export default function QuestionsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Reference data ──
  const docsQ = useDocuments(projectId)
  const chunksQ = useChunks(projectId, { pageSize: 1000 })
  const gaQ = useGAPairs(projectId, { pageSize: 500 })
  const statsQ = useQuestionStats(projectId)

  const docs = useMemo(() => (docsQ.data?.items ?? []).filter((d) => d.processing_status === 'parsed'), [docsQ.data])
  const chunks = useMemo(() => chunksQ.data?.items ?? [], [chunksQ.data])
  const gaPairs = useMemo(() => gaQ.data?.items ?? [], [gaQ.data])

  const docName = useMemo(() => new Map((docsQ.data?.items ?? []).map((d) => [d.id, d.filename])), [docsQ.data])
  const chunkMap = useMemo(() => new Map<string, ChunkOut>(chunks.map((c) => [c.id, c])), [chunks])
  const gaMap = useMemo(() => new Map<string, GAPairOut>(gaPairs.map((g) => [g.id, g])), [gaPairs])

  // ── Filters + paging ──
  const [filters, setFiltersState] = useState<QuestionFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const search = useDebounce(filters.search.trim(), 300)
  const setFilters = (f: QuestionFilters) => {
    setFiltersState(f)
    setPage(1)
  }
  const searchRef = useRef<HTMLInputElement>(null)

  const listQ = useQuestions(projectId, {
    search: search || undefined,
    status: filters.status || undefined,
    gaPairId: filters.gaPairId || undefined,
    page,
    pageSize,
  })
  const pageItems = useMemo(() => listQ.data?.items ?? [], [listQ.data])
  // The list API has no document filter; narrow the loaded page client-side.
  const questions = useMemo(
    () => (filters.documentId ? pageItems.filter((q) => (q.document_id ?? chunkMap.get(q.chunk_id)?.document_id) === filters.documentId) : pageItems),
    [pageItems, filters.documentId, chunkMap],
  )
  const meta = listQ.data?.pagination
  const filtersActive = !!(filters.search || filters.status || filters.documentId || filters.gaPairId)

  // ── Background tasks ──
  const tasks = useTrackedTasks(projectId).filter((t) => t.kind === 'questions' || t.kind === 'answers')

  // ── Generate panel (open by default when there is nothing yet) ──
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null)
  const total = statsQ.data?.total ?? meta?.total_items ?? 0
  const hasChunks = chunks.length > 0
  const showPanel = hasChunks && (panelOpen ?? (!listQ.isLoading && total === 0 && !filtersActive))

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastIndex = useRef<number | null>(null)
  const visibleIds = useMemo(() => questions.map((q) => q.id), [questions])
  const selectedOnPage = visibleIds.filter((id) => selected.has(id)).length
  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const toggleOne = useCallback(
    (id: string, shiftKey: boolean) => {
      const idx = visibleIds.indexOf(id)
      setSelected((prev) => {
        const next = new Set(prev)
        if (shiftKey && lastIndex.current !== null && idx >= 0) {
          const [a, b] = [Math.min(lastIndex.current, idx), Math.max(lastIndex.current, idx)]
          const on = !prev.has(id)
          visibleIds.slice(a, b + 1).forEach((x) => (on ? next.add(x) : next.delete(x)))
        } else if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      lastIndex.current = idx
    },
    [visibleIds],
  )

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))
      visibleIds.forEach((id) => (allOn ? next.delete(id) : next.add(id)))
      return next
    })

  // ── Mutations ──
  const update = useUpdateQuestion(projectId)
  const bulkDelete = useBulkDeleteQuestions(projectId)
  const genAnswers = useGenerateAnswers(projectId)
  const [editingId, setEditingId] = useState<string | null>(null)

  const onSave = useCallback(
    (id: string, text: string) =>
      update.mutate(
        { questionId: id, data: { question: text } },
        {
          onSuccess: () => setEditingId(null),
          onError: (err) => toastError('Could not save question', err),
        },
      ),
    [update],
  )

  const deleteIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const key = ['questions', projectId]
      let snap: Snapshot | undefined
      void undoable({
        message: ids.length === 1 ? 'Question deleted' : `${plural(ids.length, 'question')} deleted`,
        apply: async () => {
          snap = await patchPagedLists<QuestionOut>(qc, key, removeIds(ids))
          setSelected((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => next.delete(id))
            return next
          })
        },
        rollback: () => {
          restore(qc, snap)
          qc.invalidateQueries({ queryKey: key })
        },
        commit: () => bulkDelete.mutateAsync(ids),
        onCommitted: () => {
          qc.invalidateQueries({ queryKey: key })
          qc.invalidateQueries({ queryKey: ['questions_stats', projectId] })
          qc.invalidateQueries({ queryKey: ['project', projectId] })
        },
      })
    },
    [projectId, qc, bulkDelete],
  )

  const onDeleteOne = useCallback((q: QuestionOut) => deleteIds([q.id]), [deleteIds])

  const answerSelected = () => {
    const ids = [...selected]
    genAnswers.mutate(
      { question_ids: ids, dataset_type: 'qa' },
      {
        onSuccess: (r) => {
          trackTask({ id: r.task_id, projectId, kind: 'answers', label: `Answering ${plural(ids.length, 'question')}` })
          sonnerToast.success('Answer generation started', {
            description: 'Review the answers when they land.',
            action: { label: 'Review', onClick: () => navigate(`/projects/${projectId}/dataset-review`) },
          })
          clearSelection()
        },
        onError: (err) => toastError('Could not start answer generation', err, answerSelected),
      },
    )
  }

  // ── Keyboard ──
  useHotkeys({
    '/': () => searchRef.current?.focus(),
    g: () => hasChunks && setPanelOpen(!showPanel),
    Escape: () => {
      if (editingId) setEditingId(null)
      else if (document.activeElement === searchRef.current) searchRef.current?.blur()
      else clearSelection()
    },
    Delete: () => deleteIds([...selected]),
  })

  const labels = useCallback(
    (q: QuestionOut) => {
      const c = chunkMap.get(q.chunk_id)
      const dn = q.document_filename ?? (c ? docName.get(c.document_id) : undefined)
      const chunkLabel = c ? `${dn ?? 'Doc'} · #${c.chunk_index + 1}` : dn ?? undefined
      const g = q.ga_pair_id ? gaMap.get(q.ga_pair_id) : undefined
      return { chunkLabel, lensLabel: g ? `${g.genre_title} / ${g.audience_title}` : undefined }
    },
    [chunkMap, docName, gaMap],
  )

  const refError = docsQ.error || chunksQ.error || gaQ.error
  const initialLoading = listQ.isLoading || chunksQ.isLoading

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        eyebrow="Step 4 · Questions"
        title="Questions"
        description="Turn every chunk into questions, seen through each genre × audience lens. Edit or prune them before answers are generated."
        action={
          <>
            {statsQ.data && statsQ.data.total > 0 && (
              <dl className="mr-2 flex divide-x divide-line border border-line">
                {[
                  ['Total', statsQ.data.total],
                  ['Answered', statsQ.data.answered],
                  ['Open', statsQ.data.unanswered],
                ].map(([k, v]) => (
                  <div key={k} className="px-3 py-1.5">
                    <dt className="eyebrow text-[9.5px]">{k}</dt>
                    <dd className="num text-sm text-fg">{Number(v).toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            )}
            {hasChunks && !showPanel && (
              <Button onClick={() => setPanelOpen(true)}>
                <Plus /> Generate
              </Button>
            )}
            {statsQ.data && statsQ.data.unanswered === 0 && statsQ.data.total > 0 && (
              <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/dataset-review`)}>
                Review answers <ArrowRight />
              </Button>
            )}
          </>
        }
      />

      {refError && <ErrorState compact error={refError} onRetry={() => void Promise.all([docsQ.refetch(), chunksQ.refetch(), gaQ.refetch()])} />}

      <TaskTray tasks={tasks} />

      {!chunksQ.isLoading && !hasChunks ? (
        <EmptyState
          icon={Layers}
          step="Step 4 · Questions"
          title="Chunk your documents first"
          description="Questions are written from chunks: short passages of your documents. Once chunks exist, one click generates questions for all of them."
          bullets={['Each chunk × lens becomes a prompt', 'Question count adapts to the chunk by default', 'Edit, filter and prune before answering']}
          action={
            <Button onClick={() => navigate(`/projects/${projectId}/chunks`)}>
              Go to chunks <ArrowRight />
            </Button>
          }
        />
      ) : (
        <>
          {showPanel && <GeneratePanel projectId={projectId} docs={docs} chunks={chunks} gaPairs={gaPairs} onClose={() => setPanelOpen(false)} />}

          {initialLoading ? (
            <ListSkeleton rows={8} />
          ) : listQ.isError ? (
            <ErrorState error={listQ.error} onRetry={() => void listQ.refetch()} />
          ) : total === 0 && !filtersActive ? (
            <EmptyState
              icon={MessageSquare}
              step="Step 4 · Questions"
              title="No questions yet"
              description="Pick the documents and lenses above and hit Generate. Smart defaults use everything, with the question count decided per chunk."
              bullets={['Chunks × lenses × count = questions', 'Runs in the background — keep working', 'Next: generate and review answers']}
            />
          ) : (
            <section className="border border-line bg-bg">
              <div className="border-b border-line-hair p-3">
                <QuestionToolbar ref={searchRef} value={filters} onChange={setFilters} docs={docs} gaPairs={gaPairs} />
              </div>
              <div className="flex items-center gap-3 border-b border-line bg-bg-subtle px-4 py-2">
                <Checkbox
                  checked={visibleIds.length > 0 && selectedOnPage === visibleIds.length}
                  indeterminate={selectedOnPage > 0 && selectedOnPage < visibleIds.length}
                  onChange={toggleAll}
                  aria-label="Select all on this page"
                />
                <span className="eyebrow">
                  {meta ? plural(meta.total_items, 'question') : '—'}
                  {filters.documentId && ` · ${questions.length} on this page in document`}
                </span>
                {listQ.isFetching && !listQ.isLoading && <RotateCw className="size-3 animate-spin text-fg-muted" aria-label="Refreshing" />}
                <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-fg-muted md:flex">
                  <Kbd>/</Kbd> search · <Kbd>g</Kbd> generate · <Kbd>shift</Kbd>+click range · <Kbd>del</Kbd> delete
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <Search className="size-5 text-fg-subtle" strokeWidth={1.5} />
                  <p className="font-display text-sm font-bold">No matching questions</p>
                  <p className="text-sm text-fg-secondary">Try a different search or clear the filters.</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <VirtualList
                  items={questions}
                  getKey={(q) => q.id}
                  estimateSize={76}
                  label="Questions"
                  className="max-h-[calc(100vh-320px)] min-h-[240px]"
                  renderItem={(q, i) => {
                    const l = labels(q)
                    return (
                      <QuestionRow
                        q={q}
                        index={(page - 1) * pageSize + i}
                        selected={selected.has(q.id)}
                        editing={editingId === q.id}
                        saving={update.isPending && update.variables?.questionId === q.id}
                        chunkLabel={l.chunkLabel}
                        lensLabel={l.lensLabel}
                        onToggle={toggleOne}
                        onEdit={setEditingId}
                        onSave={onSave}
                        onDelete={onDeleteOne}
                      />
                    )
                  }}
                />
              )}

              <PaginationControls
                meta={meta}
                page={page}
                pageSize={pageSize}
                sizes={[25, 50, 100]}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s)
                  setPage(1)
                }}
              />
            </section>
          )}
        </>
      )}

      <SelectionBar count={selected.size} onClear={clearSelection}>
        <Button variant="outline" size="xs" onClick={answerSelected} loading={genAnswers.isPending}>
          <ListChecks /> Generate answers
        </Button>
        <Button variant="outline" size="xs" onClick={() => deleteIds([...selected])}>
          <Trash2 /> Delete
        </Button>
      </SelectionBar>
    </div>
  )
}

