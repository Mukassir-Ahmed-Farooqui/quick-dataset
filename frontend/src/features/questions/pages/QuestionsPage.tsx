import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Loader2, Trash2, Edit3, Check, X,
  MessageSquare, Filter, Layers, Tags, FileText, Settings2,
  HelpCircle, Plus,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PaginationControls from '@/components/common/PaginationControls'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useDocuments } from '@/hooks/useDocuments'
import { useChunks } from '@/hooks/useChunks'
import { useGAPairs } from '@/hooks/useGAPairs'
import {
  useQuestions, useGenerateQuestions, useEstimateQuestions,
  useUpdateQuestion, useDeleteQuestion, useBulkDeleteQuestions,
  useTaskPoll,
} from '@/hooks/useQuestions'
import { toast } from '@/lib/toast'
import { stagger, fadeUp } from '@/lib/animations'
import type { QuestionOut, ChunkOut } from '@/types/api'

type SortField = 'created_at' | 'question'
type SortDir = 'asc' | 'desc'

// ── Helpers ─────────────────────────────────────────────────────────

function chunkLabel(chunk: ChunkOut | undefined, docName?: string): string {
  if (!chunk) return 'Unknown chunk'
  const doc = docName ? `${docName} ` : ''
  return `${doc}— Chunk ${chunk.chunk_index + 1} (${chunk.token_count} tokens)`
}

// ── Component ────────────────────────────────────────────────────────

export default function QuestionsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  // ── Data ──
  const { data: docsData, isError: docsIsError, error: docsError } = useDocuments(projectId!)
  const docs = docsData?.items ?? []
  const parsedDocs = docs.filter(d => d.processing_status === 'parsed')

  const { data: allChunksData, isError: chunksIsError, error: chunksError } = useChunks(projectId!, { pageSize: 1000 })
  const allChunks = allChunksData?.items ?? []

  const { data: gaPairsData, isError: gaPairsIsError, error: gaPairsError } = useGAPairs(projectId!, { pageSize: 500 })
  const gaPairs = gaPairsData?.items ?? []

  // Build a map: docId -> doc name
  const docNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const d of docs) m[d.id] = d.filename
    return m
  }, [docs])

  // Build a map: chunkId -> chunk
  const chunkMap = useMemo(() => {
    const m: Record<string, ChunkOut> = {}
    for (const c of allChunks) m[c.id] = c
    return m
  }, [allChunks])

  // ── Generation State: Document-Driven ──
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [selectedGaPairIds, setSelectedGaPairIds] = useState<string[]>([])
  const [questionsPerDocCombo, setQuestionsPerDocCombo] = useState(3)
  const [showGeneratePanel, setShowGeneratePanel] = useState(false)
  const [showAdvancedChunkSelect, setShowAdvancedChunkSelect] = useState(false)
  const [manualChunkIds, setManualChunkIds] = useState<string[]>([])
  const [estimateResult, setEstimateResult] = useState<{
    cost: number; items: number; warning?: string
  } | null>(null)

  // Resolve chunks from selected documents
  const resolvedChunkIds = useMemo(() => {
    if (showAdvancedChunkSelect) return manualChunkIds
    if (selectedDocIds.length === 0) return []
    return allChunks
      .filter(c => selectedDocIds.includes(c.document_id))
      .map(c => c.id)
  }, [selectedDocIds, allChunks, showAdvancedChunkSelect, manualChunkIds])

  const resolvedChunkCount = resolvedChunkIds.length
  const resolvedGaPairCount = selectedGaPairIds.length || 1 // at minimum 1 combo
  const estimatedTotalQuestions = resolvedChunkCount * resolvedGaPairCount * questionsPerDocCombo

  // ── Filters ──
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [chunkFilter, setChunkFilter] = useState('')
  const [gaPairFilter, setGaPairFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── Pagination ──
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectAllOnPage, setSelectAllOnPage] = useState(false)

  // ── Inline edit ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // ── Generation progress tracking ──
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const { data: activeTask } = useTaskPoll(
    activeTaskId,
    showProgress && !!activeTaskId,
  )

  // Track elapsed time
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!taskStartedAt || !showProgress) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - taskStartedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [taskStartedAt, showProgress])



  // ── Dialogs ──
  const [deleteTarget, setDeleteTarget] = useState<QuestionOut | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // ── Mutations ──
  const generateMutation = useGenerateQuestions(projectId!)
  const estimateMutation = useEstimateQuestions(projectId!)
  const updateMutation = useUpdateQuestion(projectId!)
  const deleteMutation = useDeleteQuestion(projectId!)
  const bulkDeleteMutation = useBulkDeleteQuestions(projectId!)

  // ── Query ──
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const { data, isLoading, isError, error, refetch } = useQuestions(projectId!, {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    chunkId: chunkFilter || undefined,
    gaPairId: gaPairFilter || undefined,
    page,
    pageSize,
  })
  const questions = data?.items ?? []
  const meta = data?.pagination

  const anyError = docsIsError || chunksIsError || gaPairsIsError || isError
  const firstError = docsError || chunksError || gaPairsError || error

  // Cancel progress when task completes
  useEffect(() => {
    if (activeTask?.status === 'done' || activeTask?.status === 'failed') {
      if (activeTask.status === 'done') {
        refetch()
      }
      setTimeout(() => { setShowProgress(false); setActiveTaskId(null) }, 5000)
    }
  }, [activeTask?.status, refetch])

  useEffect(() => setPage(1), [statusFilter, chunkFilter, gaPairFilter, debouncedSearch])

  // Select/deselect all on page
  useEffect(() => {
    if (selectAllOnPage) {
      const ids = new Set(selectedIds)
      questions.forEach(q => ids.add(q.id))
      setSelectedIds(ids)
    }
  }, [selectAllOnPage, questions])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setSelectAllOnPage(false)
  }

  const toggleSelectAll = () => {
    if (selectAllOnPage) {
      setSelectAllOnPage(false)
      setSelectedIds(new Set())
    } else {
      setSelectAllOnPage(true)
      const ids = new Set(selectedIds)
      questions.forEach(q => ids.add(q.id))
      setSelectedIds(ids)
    }
  }

  const clearSelection = () => { setSelectedIds(new Set()); setSelectAllOnPage(false) }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') { setEditingId(null); setDeleteTarget(null) }
      if (e.key === 'Delete' && selectedIds.size > 0) setBulkDeleteConfirm(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds])

  // ── Generation handlers ──
  const handleEstimate = async () => {
    if (resolvedChunkIds.length === 0) {
      toast({ title: 'Select documents first', variant: 'destructive' }); return
    }
    try {
      const result = await estimateMutation.mutateAsync({
        chunk_ids: resolvedChunkIds,
        ga_pair_ids: selectedGaPairIds.length > 0 ? selectedGaPairIds : undefined,
        questions_per_combination: questionsPerDocCombo,
      })
      setEstimateResult({
        cost: result.estimated_cost_usd,
        items: result.estimated_item_count,
        warning: result.warning ?? undefined,
      })
      toast({
        title: 'Estimate ready',
        description: `~${result.estimated_item_count} questions, ~$${result.estimated_cost_usd.toFixed(4)}`,
      })
    } catch (err) {
      toast({
        title: 'Estimate failed',
        description: err instanceof Error ? err.message : 'Unknown',
        variant: 'destructive',
      })
    }
  }

  const handleGenerate = async () => {
    if (resolvedChunkIds.length === 0) {
      toast({ title: 'Select documents first', variant: 'destructive' }); return
    }
    try {
      const result = await generateMutation.mutateAsync({
        chunk_ids: resolvedChunkIds,
        ga_pair_ids: selectedGaPairIds.length > 0 ? selectedGaPairIds : undefined,
        questions_per_combination: questionsPerDocCombo,
      })
      toast({
        title: 'Generation started',
        description: `${estimatedTotalQuestions} questions queued. Processing in background.`,
      })
      setEstimateResult(null)
      // Start progress tracking with real task_id
      if (result.task_id && result.task_id !== 'pending') {
        setActiveTaskId(result.task_id)
        setTaskStartedAt(Date.now())
        setShowProgress(true)
      }
      // Poll for results
      setTimeout(() => refetch(), 2000)
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Unknown',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (q: QuestionOut) => {
    setEditingId(q.id)
    setEditValue(q.question)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    try {
      await updateMutation.mutateAsync({ questionId: editingId, data: { question: editValue } })
      toast({ title: 'Updated' })
      setEditingId(null)
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unknown',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast({ title: 'Deleted' })
      setDeleteTarget(null)
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown',
        variant: 'destructive',
      })
    }
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedIds))
      toast({ title: `Deleted ${selectedIds.size} questions` })
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
    } catch (err) {
      toast({
        title: 'Bulk delete failed',
        description: err instanceof Error ? err.message : 'Unknown',
        variant: 'destructive',
      })
    }
  }

  const toggleDoc = (id: string) => {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const toggleGaPair = (id: string) => {
    setSelectedGaPairIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Questions"
          description="Generate and manage questions for your dataset."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setShowGeneratePanel(true)} disabled={parsedDocs.length === 0}>
                <Plus className="h-4 w-4 mr-1.5" />
                Generate Questions
              </Button>
              <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Project
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* ── Generation Panel ── */}
      <AnimatePresence>
        {showGeneratePanel && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
          >
            <Card className="border-hairline">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink">Generate Questions</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowGeneratePanel(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Step 1: Choose Documents */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-deep-green text-white text-xs font-bold flex items-center justify-center">1</div>
                    <span className="text-sm font-medium text-ink">Choose source documents</span>
                    <span className="text-xs text-muted">{selectedDocIds.length} selected</span>
                  </div>
                  {parsedDocs.length === 0 ? (
                    <p className="text-xs text-muted pl-8">No parsed documents. Upload documents and wait for parsing first.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-8">
                      {parsedDocs.map(doc => {
                        const chunkCount = allChunks.filter(c => c.document_id === doc.id).length
                        return (
                          <label
                            key={doc.id}
                            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedDocIds.includes(doc.id)
                                ? 'border-action/40 bg-action/5'
                                : 'border-hairline hover:border-action/20 hover:bg-stone/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedDocIds.includes(doc.id)}
                              onChange={() => toggleDoc(doc.id)}
                              className="mt-0.5 rounded h-4 w-4"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{doc.filename}</p>
                              <p className="text-xs text-muted">{chunkCount} chunk{chunkCount !== 1 ? 's' : ''}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {/* Advanced: show chunk details */}
                  {selectedDocIds.length > 0 && (
                    <button
                      onClick={() => setShowAdvancedChunkSelect(!showAdvancedChunkSelect)}
                      className="flex items-center gap-1.5 text-xs text-muted hover:text-ink mt-2 pl-8"
                    >
                      <Settings2 className="h-3 w-3" />
                      {showAdvancedChunkSelect ? 'Use all chunks from selected documents' : 'Advanced: choose specific chunks'}
                    </button>
                  )}

                  {showAdvancedChunkSelect && (
                    <div className="pl-8 mt-2">
                      <div className="border border-hairline rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                        {allChunks
                          .filter(c => selectedDocIds.includes(c.document_id))
                          .map(c => (
                            <label key={c.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                              <input
                                type="checkbox"
                                checked={manualChunkIds.includes(c.id)}
                                onChange={() => setManualChunkIds(prev =>
                                  prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id],
                                )}
                                className="rounded h-3.5 w-3.5 flex-shrink-0"
                              />
                              <span className="text-xs text-ink truncate">
                                {docNameMap[c.document_id] || 'Doc'} — Chunk {c.chunk_index + 1} ({c.token_count} tokens)
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Choose GA Pairs */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-deep-green text-white text-xs font-bold flex items-center justify-center">2</div>
                    <span className="text-sm font-medium text-ink">Choose Genre/Audience pairs</span>
                    <span className="text-xs text-muted">{selectedGaPairIds.length} selected</span>
                  </div>
                  <div className="pl-8">
                    {gaPairs.length === 0 ? (
                      <p className="text-xs text-muted">No GA pairs yet. Generate GA pairs from the project page first.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {gaPairs.map(g => (
                          <label
                            key={g.id}
                            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedGaPairIds.includes(g.id)
                                ? 'border-action/40 bg-action/5'
                                : 'border-hairline hover:border-action/20 hover:bg-stone/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedGaPairIds.includes(g.id)}
                              onChange={() => toggleGaPair(g.id)}
                              className="mt-0.5 rounded h-4 w-4"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{g.genre_title}</p>
                              <p className="text-xs text-muted truncate">{g.audience_title}</p>
                            </div>
                          </label>
                        ))}
                        {gaPairs.length > 0 && selectedGaPairIds.length === 0 && (
                          <p className="text-xs text-muted col-span-full italic">Select at least one, or leave empty to use a default lens.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Configure count */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-deep-green text-white text-xs font-bold flex items-center justify-center">3</div>
                    <span className="text-sm font-medium text-ink">Set question count</span>
                  </div>
                  <div className="pl-8">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-ink">Questions per (chunk × genre/audience):</label>
                      <input
                        type="number"
                        value={questionsPerDocCombo}
                        onChange={e => setQuestionsPerDocCombo(Math.max(1, Math.min(10, Number(e.target.value))))}
                        min={1} max={10}
                        className="w-20 border border-hairline rounded-md px-3 py-1.5 text-sm text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Live formula display */}
                {resolvedChunkCount > 0 && (
                  <div className="bg-stone/40 rounded-xl p-4 border border-hairline">
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="font-medium text-ink">{resolvedChunkCount}</span>
                      <span className="text-muted">chunk{resolvedChunkCount !== 1 ? 's' : ''}</span>
                      <span className="text-muted text-lg">×</span>
                      <span className="font-medium text-ink">{resolvedGaPairCount}</span>
                      <span className="text-muted">genre/audience pair{resolvedGaPairCount !== 1 ? 's' : ''}</span>
                      <span className="text-muted text-lg">×</span>
                      <span className="font-medium text-ink">{questionsPerDocCombo}</span>
                      <span className="text-muted">question{questionsPerDocCombo !== 1 ? 's' : ''} each</span>
                      <span className="text-muted text-lg">=</span>
                      <span className="text-lg font-bold text-deep-green">{estimatedTotalQuestions.toLocaleString()}</span>
                      <span className="text-muted">question{estimatedTotalQuestions !== 1 ? 's' : ''}</span>
                    </div>
                    {estimatedTotalQuestions > 0 && (
                      <div className="mt-2 text-xs text-muted">
                        {resolvedChunkCount > 0 && selectedDocIds.length > 0 && (
                          <span>
                            From {selectedDocIds.length} document{selectedDocIds.length !== 1 ? 's' : ''}:
                            {selectedDocIds.map(did => {
                              const doc = docs.find(d => d.id === did)
                              return doc ? ` "${doc.filename}"` : ''
                            }).join(',')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={handleEstimate}
                    disabled={estimateMutation.isPending || resolvedChunkIds.length === 0}
                  >
                    {estimateMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      : <HelpCircle className="h-4 w-4 mr-1.5" />}
                    Estimate Cost
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending || resolvedChunkIds.length === 0}
                    size="lg"
                  >
                    {generateMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      : <Plus className="h-4 w-4 mr-1.5" />}
                    Generate {estimatedTotalQuestions > 0 ? `${estimatedTotalQuestions.toLocaleString()} Questions` : ''}
                  </Button>
                </div>

                {estimateResult && (
                  <div className="text-sm space-y-1 p-3 bg-stone/30 rounded-lg">
                    <p><span className="text-ink font-medium">{estimateResult.items.toLocaleString()} questions</span> estimated</p>
                    <p>Estimated cost: <span className="font-medium text-ink">${estimateResult.cost.toFixed(6)}</span></p>
                    {estimateResult.warning && (
                      <p className="text-warning text-xs">{estimateResult.warning}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Generation Progress Monitor ── */}
      {showProgress && activeTask && (
        <motion.div variants={fadeUp}>
          <Card className={`border-2 ${
            activeTask.status === 'done' ? 'border-success/40 bg-success/5' :
            activeTask.status === 'failed' ? 'border-error/40 bg-error/5' :
            'border-action/40 bg-action/5'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {activeTask.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-action" />}
                  <span className="text-sm font-medium text-ink">
                    {activeTask.status === 'done' ? 'Generation complete' :
                     activeTask.status === 'failed' ? 'Generation failed' :
                     'Generating questions…'}
                  </span>
                </div>
                <Badge variant={
                  activeTask.status === 'done' ? 'success' :
                  activeTask.status === 'failed' ? 'destructive' :
                  'default'
                } className="text-[10px] uppercase">
                  {activeTask.status}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-stone rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    activeTask.status === 'done' ? 'bg-success' :
                    activeTask.status === 'failed' ? 'bg-error' :
                    'bg-action'
                  }`}
                  style={{
                    width: `${activeTask.total_count > 0
                      ? Math.round((activeTask.completed_count / activeTask.total_count) * 100)
                      : 0}%`
                  }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted">Processed</span>
                  <p className="text-ink font-medium">
                    {activeTask.completed_count} / {activeTask.total_count} combos
                  </p>
                </div>
                <div>
                  <span className="text-muted">Errors</span>
                  <p className={`font-medium ${activeTask.error_count > 0 ? 'text-error' : 'text-ink'}`}>
                    {activeTask.error_count}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Elapsed</span>
                  <p className="text-ink font-medium">
                    {Math.floor(elapsed / 60)}m {elapsed % 60}s
                  </p>
                </div>
                <div className="flex items-end justify-end">
                  {activeTask.status === 'failed' && (
                    <span className="text-error text-[10px]">
                      {activeTask.error_log?.[0]?.message?.slice(0, 80) || 'Unknown error'}
                    </span>
                  )}
                  {activeTask.status === 'done' && (
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      Refresh questions
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Search + Filters bar ── */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full border border-hairline rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action"
            />
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-stone' : ''}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {(statusFilter || chunkFilter || gaPairFilter) && (
              <span className="ml-1.5 w-2 h-2 rounded-full bg-action" />
            )}
          </Button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {selectedIds.size} selected
              </Badge>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                <X className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
              </Button>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="unanswered">Unanswered</option>
                <option value="answered">Answered</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Document</label>
              <select
                value={chunkFilter}
                onChange={e => setChunkFilter(e.target.value)}
                className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm truncate"
              >
                <option value="">All documents</option>
                {docs.map(d => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">GA Pair</label>
              <select
                value={gaPairFilter}
                onChange={e => setGaPairFilter(e.target.value)}
                className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm truncate"
              >
                <option value="">All pairs</option>
                {gaPairs.map(g => (
                  <option key={g.id} value={g.id}>{g.genre_title}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Questions list ── */}
      {isLoading ? (
        <LoadingState count={3} />
      ) : anyError ? (
        <ErrorState error={firstError} onRetry={refetch} />
      ) : questions.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={MessageSquare}
            title="No questions yet"
            description="Select documents and GA pairs above, then click Generate to create questions."
            action={
              <Button onClick={() => setShowGeneratePanel(true)} disabled={parsedDocs.length === 0}>
                <Plus className="h-4 w-4 mr-1.5" />
                Generate Questions
              </Button>
            }
          />
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {meta && (
                <span className="text-sm font-medium text-ink">
                  {meta.total_items.toLocaleString()} question{meta.total_items !== 1 ? 's' : ''}
                </span>
              )}
              <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAllOnPage && questions.every(q => selectedIds.has(q.id))}
                  onChange={toggleSelectAll}
                  className="rounded h-3.5 w-3.5"
                />
                Select all on page
              </label>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>

          {questions.map(q => {
            const chunk = chunkMap[q.chunk_id]
            const docId = chunk?.document_id
            const docName = docId ? docNameMap[docId] : undefined
            const gaPair = q.ga_pair_id ? gaPairs.find(g => g.id === q.ga_pair_id) : undefined

            return (
              <motion.div key={q.id} variants={fadeUp}>
                <Card className={`border-hairline transition-colors ${
                  selectedIds.has(q.id) ? 'border-action/40 bg-action/5' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(q.id)}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-1 rounded h-4 w-4 flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        {editingId === q.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              className="w-full border border-hairline rounded-md px-3 py-2 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-action"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                <X className="h-3.5 w-3.5 mr-1" />Cancel
                              </Button>
                              <Button size="sm" onClick={handleSaveEdit}>
                                <Check className="h-3.5 w-3.5 mr-1" />Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-ink leading-relaxed">{q.question}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <Badge
                                variant={q.answered ? 'success' : 'outline'}
                                className="text-[10px]"
                              >
                                {q.answered ? 'Answered' : 'Unanswered'}
                              </Badge>

                              {/* Chunk label with document name */}
                              {chunk && (
                                <span className="text-[10px] text-muted flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {docName || 'Doc'} — Chunk {chunk.chunk_index + 1}
                                </span>
                              )}

                              {/* GA pair label */}
                              {gaPair && (
                                <span className="text-[10px] text-muted flex items-center gap-1">
                                  <Tags className="h-3 w-3" />
                                  {gaPair.genre_title} / {gaPair.audience_title}
                                </span>
                              )}

                              <span className="text-[10px] text-muted">
                                {new Date(q.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {editingId !== q.id && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEdit(q)}
                            className="p-1.5 text-muted hover:text-ink hover:bg-stone rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(q)}
                            className="p-1.5 text-muted hover:text-error hover:bg-stone rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}

          <PaginationControls
            meta={meta}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={s => { setPageSize(s); setPage(1) }}
          />
        </motion.div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Question"
        message="Remove this question?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        title="Bulk Delete"
        message={`Delete ${selectedIds.size} question${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />
    </motion.div>
  )
}
