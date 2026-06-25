import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Check, X, Trash2, Filter, Loader2,
  HelpCircle, ListChecks, Star, ChevronDown, ChevronUp, Download,
  FileText
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PaginationControls from '@/components/common/PaginationControls'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useQuestionStats, useTaskPoll } from '@/hooks/useQuestions'
import {
  useDatasetItems, useUpdateDatasetItem,
  useBulkConfirmItems, useBulkDeleteItems,
  useGenerateAnswers, useEstimateAnswers,
} from '@/hooks/useDatasetItems'
import { useExports, useCreateExport } from '@/hooks/useExports'
import { exportsApi } from '@/api/exports'
import { toast } from '@/lib/toast'
import { stagger, fadeUp } from '@/lib/animations'
import type { DatasetItemOut } from '@/types/api'

export default function DatasetReviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── Filters ──
  const [datasetTypeFilter, setDatasetTypeFilter] = useState('')
  const [confirmedFilter, setConfirmedFilter] = useState<string>('')
  const [minScoreFilter, setMinScoreFilter] = useState('')

  // ── Pagination ──
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectAllOnPage, setSelectAllOnPage] = useState(false)

  // ── Expanded items ──
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // ── Confirm/Delete ──
  const [bulkConfirmTarget, setBulkConfirmTarget] = useState(false)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(false)
  const [confirmValue, setConfirmValue] = useState(true)

  // ── Generate panel ──
  const [showGeneratePanel, setShowGeneratePanel] = useState(false)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [answerDatasetType, setAnswerDatasetType] = useState('qa')
  const [estimateResult, setEstimateResult] = useState<{ cost: number; items: number } | null>(null)

  // ── Progress Polling ──
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const { data: activeTask } = useTaskPoll(
    activeTaskId,
    showProgress && !!activeTaskId
  )

  useEffect(() => {
    if (!taskStartedAt || !showProgress) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - taskStartedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [taskStartedAt, showProgress])

  useEffect(() => {
    if (activeTask && activeTask.status === 'done') {
      toast({ title: 'Generation Complete', description: `Successfully generated ${activeTask.completed_count} items.` })
      setShowProgress(false)
      setShowGeneratePanel(false)
      setActiveTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['datasetItems'] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    } else if (activeTask && activeTask.status === 'failed') {
      toast({ title: 'Generation Failed', description: 'Task failed. See logs.', variant: 'destructive' })
      setShowProgress(false)
      setActiveTaskId(null)
    }
  }, [activeTask, queryClient])

  // ── Export panel ──
  const [showExportPanel, setShowExportPanel] = useState(false)
  const [exportType, setExportType] = useState<'json' | 'jsonl' | 'alpaca' | 'sharegpt'>('json')
  const [exportConfirmed, setExportConfirmed] = useState(true)
  const [exportMinScore, setExportMinScore] = useState('')

  // ── Data ──
  const { data: questionsData, isError: questionsIsError, error: questionsError } = useQuestionStats(projectId!)
  const totalUnanswered = questionsData?.unanswered ?? 0
  const groupedQuestions = questionsData?.documents ?? []

  // Auto-select all questions & group by document when Generate Panel is opened
  useEffect(() => {
    if (showGeneratePanel && groupedQuestions.length > 0) {
      const allIds = groupedQuestions.flatMap(g => g.unanswered_question_ids)
      setSelectedQuestionIds(allIds)
    }
  }, [showGeneratePanel, groupedQuestions])

  const { data, isLoading, isError, error, refetch } = useDatasetItems(projectId!, {
    datasetType: datasetTypeFilter || undefined,
    confirmed: confirmedFilter === '' ? undefined : confirmedFilter === 'true',
    minScore: minScoreFilter ? parseFloat(minScoreFilter) : undefined,
    page,
    pageSize,
  })
  const items = data?.items ?? []
  const meta = data?.pagination

  const anyError = isError || questionsIsError
  const firstError = error || questionsError

  const updateMutation = useUpdateDatasetItem(projectId!)
  const bulkConfirmMutation = useBulkConfirmItems(projectId!)
  const bulkDeleteMutation = useBulkDeleteItems(projectId!)
  const generateMutation = useGenerateAnswers(projectId!)
  const estimateMutation = useEstimateAnswers(projectId!)
  const { data: exportsData } = useExports(projectId!)
  const createExportMutation = useCreateExport(projectId!)

  // Reset page on filter change
  useEffect(() => setPage(1), [datasetTypeFilter, confirmedFilter, minScoreFilter])

  // Select/deselect all
  useEffect(() => {
    if (selectAllOnPage) {
      const ids = new Set(selectedIds)
      items.forEach(i => ids.add(i.id))
      setSelectedIds(ids)
    }
  }, [selectAllOnPage, items])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setSelectAllOnPage(false)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const clearSelection = () => { setSelectedIds(new Set()); setSelectAllOnPage(false) }

  const handleBulkConfirm = async () => {
    try {
      await bulkConfirmMutation.mutateAsync({ ids: Array.from(selectedIds), confirmed: confirmValue })
      toast({ title: `Marked ${selectedIds.size} items as ${confirmValue ? 'confirmed' : 'unconfirmed'}` })
      setSelectedIds(new Set())
      setBulkConfirmTarget(false)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedIds))
      toast({ title: `Deleted ${selectedIds.size} items` })
      setSelectedIds(new Set())
      setBulkDeleteTarget(false)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleToggleConfirm = async (item: DatasetItemOut) => {
    try {
      await updateMutation.mutateAsync({ itemId: item.id, data: { confirmed: !item.confirmed } })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleEstimate = async () => {
    if (selectedQuestionIds.length === 0) {
      toast({ title: 'Select questions', variant: 'destructive' }); return
    }
    try {
      const r = await estimateMutation.mutateAsync({
        question_ids: selectedQuestionIds,
        dataset_type: answerDatasetType as 'qa' | 'mcq' | 'classification',
      })
      setEstimateResult({ cost: r.estimated_cost_usd, items: r.estimated_item_count })
      toast({ title: 'Estimate ready', description: `~${r.estimated_item_count} items, ~$${r.estimated_cost_usd.toFixed(4)}` })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleGenerate = async () => {
    if (selectedQuestionIds.length === 0) {
      toast({ title: 'Select questions', variant: 'destructive' }); return
    }
    try {
      const res = await generateMutation.mutateAsync({
        question_ids: selectedQuestionIds,
        dataset_type: answerDatasetType as 'qa' | 'mcq' | 'classification',
      })
      toast({ title: 'Answer generation started', description: 'Processing in background.' })
      setEstimateResult(null)
      if (res.task_id) {
        setActiveTaskId(res.task_id)
        setTaskStartedAt(Date.now())
        setShowProgress(true)
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleExport = async () => {
    try {
      await createExportMutation.mutateAsync({
        export_type: exportType,
        filter: {
          confirmed: exportConfirmed || undefined,
          min_score: exportMinScore ? parseFloat(exportMinScore) : undefined,
        },
      })
      toast({ title: 'Export started', description: 'Processing in background.' })
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleDownloadExport = async (ex: any) => {
    try {
      toast({ title: 'Downloading', description: 'Your file is being downloaded...' })
      const blob = await exportsApi.download(projectId!, ex.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Use the correct extension for the export type
      const ext = ex.export_type === 'jsonl' ? 'jsonl' : 'json'
      a.download = `dataset-export-${ex.export_type}.${ext}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      toast({ title: 'Download failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const renderPayload = (item: DatasetItemOut) => {
    const p = item.payload as Record<string, unknown>
    if (item.dataset_type === 'qa') {
      return (
        <div className="space-y-2">
          <div className="text-xs space-y-1">
            <span className="font-medium text-ink">Question:</span>
            <p className="text-sm text-ink">{p.question as string}</p>
          </div>
          <div className="text-xs space-y-1">
            <span className="font-medium text-ink">Answer:</span>
            <p className="text-sm text-ink whitespace-pre-wrap">{p.answer as string}</p>
          </div>
        </div>
      )
    }
    if (item.dataset_type === 'mcq') {
      const options = p.options as string[] || []
      const correctAnswer = p.correct_answer as string
      return (
        <div className="space-y-2">
          <div className="text-xs space-y-1">
            <span className="font-medium text-ink">Question:</span>
            <p className="text-sm text-ink">{p.question as string}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-ink">Options:</span>
            {options.map((opt: string, i: number) => (
              <div key={i} className={`flex items-center gap-2 p-1.5 rounded text-xs ${opt === correctAnswer ? 'bg-success/10 text-success font-medium' : 'text-ink'}`}>
                {opt === correctAnswer && <Check className="h-3 w-3" />}
                {opt !== correctAnswer && <div className="h-3 w-3" />}
                <span>{opt}</span>
                {opt === correctAnswer && <Badge variant="success" className="text-[8px] ml-auto">Correct</Badge>}
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (item.dataset_type === 'classification') {
      return (
        <div className="space-y-2">
          <div className="text-xs space-y-1">
            <span className="font-medium text-ink">Text:</span>
            <p className="text-sm text-ink">{p.text as string}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink">Label:</span>
            <Badge variant="secondary">{p.label as string}</Badge>
          </div>
        </div>
      )
    }
    return <pre className="text-xs text-muted">{JSON.stringify(p, null, 2)}</pre>
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Dataset Review"
          description="Review, confirm, and manage your generated dataset items."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowGeneratePanel(true)}>
                <ListChecks className="h-4 w-4 mr-1.5" />
                Generate Answers
              </Button>
              <Button variant="outline" onClick={() => setShowExportPanel(true)}>
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
              <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Project
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Progress Polling UI */}
      {showProgress && activeTask && (
        <motion.div variants={fadeUp}>
          <Card className="border-action/30 bg-action/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-action" />
                <div>
                  <h3 className="text-sm font-medium text-ink">Generating Answers...</h3>
                  <p className="text-xs text-muted">
                    {activeTask.completed_count} / {activeTask.total_count} completed • {elapsed}s elapsed
                  </p>
                </div>
              </div>
              {activeTask.error_count > 0 && (
                <Badge variant="destructive">{activeTask.error_count} Errors</Badge>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Generate Answers Panel */}
      {showGeneratePanel && (
        <motion.div variants={fadeUp}>
          <Card className="border-hairline">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink">Generate Answers</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowGeneratePanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-ink block mb-1.5">
                    Unanswered Questions ({totalUnanswered})
                  </label>
                  <div className="border border-hairline rounded-md p-3 max-h-60 overflow-y-auto space-y-4">
                    {totalUnanswered === 0 ? (
                      <p className="text-xs text-muted">All questions answered.</p>
                    ) : (
                      groupedQuestions.map((doc) => {
                        const docName = doc.document_filename || 'Unknown Document'
                        const allSelected = doc.unanswered_question_ids.every(id => selectedQuestionIds.includes(id))
                        return (
                          <div key={doc.document_id || 'unknown'} className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer bg-stone/50 p-1.5 rounded-md">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => {
                                  if (allSelected) {
                                    setSelectedQuestionIds(prev => prev.filter(id => !doc.unanswered_question_ids.includes(id)))
                                  } else {
                                    setSelectedQuestionIds(prev => {
                                      const next = new Set(prev)
                                      doc.unanswered_question_ids.forEach(id => next.add(id))
                                      return Array.from(next)
                                    })
                                  }
                                }}
                                className="rounded h-4 w-4"
                              />
                              <FileText className="h-4 w-4 text-muted" />
                              <span className="text-xs font-medium text-ink">{docName}</span>
                              <Badge variant="secondary" className="ml-auto text-[10px]">{doc.unanswered_count} unanswered</Badge>
                            </label>
                          </div>
                        )
                      })
                    )}
                  </div>
                  {selectedQuestionIds.length > 0 && (
                    <p className="text-xs text-muted mt-2 font-medium">{selectedQuestionIds.length} items selected</p>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-ink block mb-1">Dataset Type</label>
                    <select
                      value={answerDatasetType}
                      onChange={e => setAnswerDatasetType(e.target.value)}
                      className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm"
                    >
                      <option value="qa">Question & Answer</option>
                      <option value="mcq">Multiple Choice</option>
                      <option value="classification">Classification</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleEstimate} disabled={estimateMutation.isPending || selectedQuestionIds.length === 0}>
                      {estimateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Filter className="h-3.5 w-3.5 mr-1" />}
                      Estimate
                    </Button>
                    <Button size="sm" className="flex-1" onClick={handleGenerate} disabled={generateMutation.isPending || selectedQuestionIds.length === 0 || showProgress}>
                      {generateMutation.isPending || showProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ListChecks className="h-3.5 w-3.5 mr-1" />}
                      Generate
                    </Button>
                  </div>
                  {estimateResult && (
                    <div className="text-xs space-y-0.5 p-2 bg-stone/30 rounded-md">
                      <p className="text-ink">{estimateResult.items} estimated</p>
                      <p className="text-ink">Cost: ${estimateResult.cost.toFixed(4)}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Export Panel */}
      {showExportPanel && (
        <motion.div variants={fadeUp}>
          <Card className="border-hairline">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink">Export Dataset</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowExportPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-ink block mb-1.5">Format</label>
                  <div className="space-y-1.5">
                    {(['json', 'jsonl', 'alpaca', 'sharegpt'] as const).map(f => (
                      <label key={f} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="exportType" checked={exportType === f} onChange={() => setExportType(f)} className="h-3.5 w-3.5" />
                        <span className="text-sm text-ink uppercase">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink block mb-1.5">Filters</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={exportConfirmed} onChange={e => setExportConfirmed(e.target.checked)} className="rounded h-3.5 w-3.5" />
                      <span className="text-xs text-ink">Confirmed only</span>
                    </label>
                    <div>
                      <label className="text-xs text-muted block mb-1">Min score</label>
                      <input type="number" value={exportMinScore} onChange={e => setExportMinScore(e.target.value)} min={0} max={1} step={0.1} className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm" placeholder="0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <Button onClick={handleExport} disabled={createExportMutation.isPending}>
                    {createExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Start Export
                  </Button>
                </div>
              </div>
              {/* Export history */}
              {exportsData?.items && exportsData.items.length > 0 && (
                <div className="pt-2 border-t border-hairline">
                  <span className="text-xs font-medium text-ink">Export history</span>
                  <div className="mt-2 space-y-1">
                    {exportsData.items.map(ex => (
                      <div 
                        key={ex.id} 
                        className={`flex items-center justify-between text-xs p-2 rounded-md transition-colors ${ex.status === 'ready' ? 'bg-surface hover:bg-surface-hover cursor-pointer' : 'text-muted'}`}
                        onClick={() => ex.status === 'ready' && handleDownloadExport(ex)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="uppercase font-medium text-ink">{ex.export_type}</span>
                          {ex.row_count && <span className="text-muted">{ex.row_count} rows</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={ex.status === 'ready' ? 'text-success font-medium' : ex.status === 'failed' ? 'text-error' : ''}>
                            {ex.status}
                          </span>
                          {ex.status === 'ready' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 ml-2" 
                              onClick={(e) => { e.stopPropagation(); handleDownloadExport(ex); }}
                              title="Download export"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters bar */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            <select value={datasetTypeFilter} onChange={e => setDatasetTypeFilter(e.target.value)} className="border border-hairline rounded-md px-3 py-1.5 text-sm">
              <option value="">All types</option>
              <option value="qa">QA</option>
              <option value="mcq">MCQ</option>
              <option value="classification">Classification</option>
            </select>
            <select value={confirmedFilter} onChange={e => setConfirmedFilter(e.target.value)} className="border border-hairline rounded-md px-3 py-1.5 text-sm">
              <option value="">All status</option>
              <option value="true">Confirmed</option>
              <option value="false">Unconfirmed</option>
            </select>
            <input type="number" value={minScoreFilter} onChange={e => setMinScoreFilter(e.target.value)} placeholder="Min score" min={0} max={1} step={0.1} className="border border-hairline rounded-md px-3 py-1.5 text-sm w-24" />
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
              <Button variant="outline" size="sm" onClick={clearSelection}><X className="h-3.5 w-3.5 mr-1" />Clear</Button>
              <Button variant="outline" size="sm" onClick={() => { setConfirmValue(true); setBulkConfirmTarget(true) }} className="text-success hover:bg-success hover:text-white">
                <Check className="h-3.5 w-3.5 mr-1" />Confirm
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setConfirmValue(false); setBulkConfirmTarget(true) }}>
                Unconfirm
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteTarget(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Items list */}
      {isLoading ? (
        <LoadingState count={3} />
      ) : anyError ? (
        <ErrorState error={firstError} onRetry={refetch} />
      ) : items.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={HelpCircle}
            title={totalUnanswered > 0 ? "You have unanswered questions!" : "No dataset items yet"}
            description={totalUnanswered > 0 ? `You have ${totalUnanswered} questions ready to be answered. Generate answers to create your dataset.` : "Generate answers for your questions to create dataset items."}
            action={
              <Button onClick={() => setShowGeneratePanel(true)}>
                <ListChecks className="h-4 w-4 mr-1.5" />
                Generate Answers
              </Button>
            }
          />
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {meta && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {meta.total_items} items total
                  </span>
                </div>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer bg-stone/30 px-2 py-1 rounded-md">
              <input type="checkbox" checked={selectAllOnPage && items.every(i => selectedIds.has(i.id))} onChange={() => {
                if (selectAllOnPage) { setSelectAllOnPage(false); setSelectedIds(new Set()) }
                else { setSelectAllOnPage(true); const ids = new Set(selectedIds); items.forEach(i => ids.add(i.id)); setSelectedIds(ids) }
              }} className="rounded h-3.5 w-3.5" />
              Select all on page
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map(item => (
              <motion.div key={item.id} variants={fadeUp} className="h-full">
                <Card className={`border-hairline transition-all h-full flex flex-col ${selectedIds.has(item.id) ? 'border-action/40 bg-action/5 shadow-sm' : 'hover:border-stone'} ${item.confirmed ? 'border-l-success border-l-[3px]' : ''}`}>
                  <CardContent className="p-4 flex flex-col flex-1">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="mt-1 rounded h-4 w-4 flex-shrink-0 cursor-pointer" />

                      <div className="flex-1 min-w-0">
                        {/* Header badges & Document Info */}
                        <div className="flex items-center flex-wrap gap-2 mb-3 pb-2 border-b border-hairline/50">
                          <Badge variant={item.dataset_type === 'qa' ? 'default' : item.dataset_type === 'mcq' ? 'secondary' : 'outline'} className="text-[10px] uppercase">
                            {item.dataset_type}
                          </Badge>
                          {item.confirmed ? (
                            <Badge variant="success" className="text-[10px]">Confirmed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Pending</Badge>
                          )}
                          {item.source_document_filename && (
                            <span className="flex items-center gap-1 text-[10px] text-muted bg-stone/30 px-1.5 py-0.5 rounded">
                              <FileText className="h-3 w-3" />
                              {item.source_document_filename}
                            </span>
                          )}
                          {item.score !== null && (
                            <span className="flex items-center gap-1 text-xs text-muted ml-auto">
                              <Star className={`h-3 w-3 ${item.score >= 0.7 ? 'text-warning fill-warning' : 'text-muted'}`} />
                              {item.score.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Payload */}
                        <div className="mb-4">
                          {expandedIds.has(item.id) ? (
                            renderPayload(item)
                          ) : (
                            <div className="text-sm text-ink line-clamp-3">
                              {item.dataset_type === 'qa' && (
                                <><span className="font-medium mr-1">Q:</span>{(item.payload as Record<string, unknown>).question as string}</>
                              )}
                              {item.dataset_type === 'mcq' && (
                                <><span className="font-medium mr-1">Q:</span>{(item.payload as Record<string, unknown>).question as string}</>
                              )}
                              {item.dataset_type === 'classification' && (item.payload as Record<string, unknown>).text as string}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Bottom Actions Row */}
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-hairline/30">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleExpand(item.id)} className="text-[11px] font-medium text-action hover:text-action/80 flex items-center gap-1">
                          {expandedIds.has(item.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expandedIds.has(item.id) ? 'Show less' : 'Show details'}
                        </button>
                        <span className="text-[10px] text-muted">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={item.confirmed ? 'default' : 'outline'}
                          size="sm"
                          className={`h-7 px-2 text-xs ${item.confirmed ? 'bg-success hover:bg-success/90' : ''}`}
                          onClick={() => handleToggleConfirm(item)}
                        >
                          <Check className={`h-3 w-3 mr-1 ${item.confirmed ? 'text-white' : 'text-success'}`} />
                          {item.confirmed ? 'Confirmed' : 'Approve'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="pt-4">
            <PaginationControls
              meta={meta}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={s => { setPageSize(s); setPage(1) }}
            />
          </div>
        </motion.div>
      )}

      <ConfirmDialog
        open={bulkConfirmTarget}
        onOpenChange={setBulkConfirmTarget}
        title={confirmValue ? 'Confirm Items' : 'Unconfirm Items'}
        message={`Mark ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} as ${confirmValue ? 'confirmed' : 'unconfirmed'}?`}
        confirmLabel={confirmValue ? 'Confirm' : 'Unconfirm'}
        onConfirm={handleBulkConfirm}
      />
      <ConfirmDialog
        open={bulkDeleteTarget}
        onOpenChange={setBulkDeleteTarget}
        title="Delete Items"
        message={`Delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />
    </motion.div>
  )
}
