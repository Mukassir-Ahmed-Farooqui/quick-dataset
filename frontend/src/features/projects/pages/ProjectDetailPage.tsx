import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Trash2, Upload, Eye, Play, Edit3, Check, X, File, Loader2, Layers, ChevronDown, ChevronRight,
  Tags, ExternalLink, MessageSquare, Download,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PaginationControls from '@/components/common/PaginationControls'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useProject, useDeleteProject } from '@/hooks/useProjects'
import { useDocuments, useUploadDocuments, useDeleteDocument } from '@/hooks/useDocuments'
import { useChunks, useChunkPreview, useGenerateChunks, useUpdateChunk, useDeleteChunk } from '@/hooks/useChunks'
import { useGAPairs } from '@/hooks/useGAPairs'
import { useQuestions } from '@/hooks/useQuestions'
import { useDatasetItems } from '@/hooks/useDatasetItems'
import { toast } from '@/lib/toast'
import { stagger, fadeUp } from '@/lib/animations'
import type { DocumentOut, ChunkOut, ChunkStrategy, ProcessingStatus } from '@/types/api'

const statusConfig: Record<ProcessingStatus, { label: string; variant: 'outline' | 'secondary' | 'success' | 'destructive' }> = {
  queued: { label: 'Queued', variant: 'outline' },
  parsing: { label: 'Parsing…', variant: 'secondary' },
  parsed: { label: 'Parsed', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
}
const fileTypeColors: Record<string, string> = { pdf: 'text-error', docx: 'text-action', md: 'text-warning', txt: 'text-muted' }
const strategies: { value: ChunkStrategy; label: string; desc: string }[] = [
  { value: 'recursive', label: 'Recursive', desc: 'Paragraphs → sentences → characters' },
  { value: 'markdown', label: 'Markdown', desc: 'Respects headings & structure' },
  { value: 'token', label: 'Token', desc: 'Token count with overlap' },
]

// ── Per-document chunk section component ──

interface DocumentChunkSectionProps {
  projectId: string
  document: DocumentOut | undefined
  docId: string
  page: number
  pageSize: number
  collapsed: boolean
  editingChunkId: string | null
  editContent: string
  fileTypeColors: Record<string, string>
  onToggleExpand: (id: string) => void
  onEditStart: (id: string, content: string) => void
  onEditCancel: () => void
  onEditSave: (id: string) => Promise<void>
  onDeleteTarget: (chunk: ChunkOut | null) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function DocumentChunkSection({
  projectId, document, docId, page, pageSize, collapsed,
  editingChunkId, editContent, fileTypeColors,
  onToggleExpand, onEditStart, onEditCancel, onEditSave, onDeleteTarget,
  onPageChange, onPageSizeChange,
}: DocumentChunkSectionProps) {
  const { data, isLoading } = useChunks(projectId, { documentId: docId, page, pageSize })
  const meta = data?.pagination
  const chunks = data?.items ?? []
  const filename = document?.filename ?? 'Unknown document'

  return (
    <motion.div variants={fadeUp} className="border border-hairline rounded-xl overflow-hidden">
      {/* Document header */}
      <button onClick={() => onToggleExpand(docId)} className="w-full px-4 py-3 flex items-center gap-3 bg-stone/30 hover:bg-stone/50 transition-colors text-left">
        {!collapsed ? <ChevronDown className="h-4 w-4 text-muted flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted flex-shrink-0" />}
        <File className={`h-5 w-5 flex-shrink-0 ${fileTypeColors[document?.file_type || 'txt']}`} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-ink truncate">{filename}</span>
          {meta && (
            <span className="text-xs text-muted ml-2">
              {meta.total_items > 0 ? `(${meta.total_items} chunk${meta.total_items !== 1 ? 's' : ''})` : '(no chunks)'}
            </span>
          )}
        </div>
      </button>

      {/* Chunk list */}
      {!collapsed && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          ) : chunks.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">No chunks generated yet. Select this document and click Generate above.</p>
          ) : (
            <div className="divide-y divide-hairline">
              {chunks.map(chunk => (
                <div key={chunk.id} className="p-3 sm:p-4 hover:bg-stone/20 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Badge variant="outline" className="text-[10px]">#{chunk.chunk_index}</Badge>
                      <span>{chunk.token_count} tokens</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {editingChunkId === chunk.id ? (
                        <>
                          <button onClick={() => onEditSave(chunk.id)} className="p-1 text-success hover:bg-success/10 rounded"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={onEditCancel} className="p-1 text-muted hover:bg-stone rounded"><X className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onEditStart(chunk.id, chunk.content)} className="p-1 text-muted hover:text-ink hover:bg-stone rounded"><Edit3 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => onDeleteTarget(chunk)} className="p-1 text-muted hover:text-error hover:bg-stone rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingChunkId === chunk.id ? (
                    <textarea value={editContent} onChange={e => onEditStart(chunk.id, e.target.value)} className="w-full text-sm border border-hairline rounded-md p-2 resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-action" />
                  ) : (
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{chunk.content.slice(0, 400)}{chunk.content.length > 400 ? '…' : ''}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {meta && meta.total_pages > 1 && (
            <div className="px-3 py-2 border-t border-hairline">
              <div className="flex justify-end">
                <PaginationControls
                  meta={meta}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const { data: project, isLoading: projLoading, isError: projError, error: projErrorObj, refetch: refetchProject } = useProject(projectId!)
  const deleteProject = useDeleteProject()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: docsData, isError: docsIsError, error: docsError, refetch: refetchDocs } = useDocuments(projectId!)
  const uploadDocs = useUploadDocuments(projectId!)
  const deleteDoc = useDeleteDocument(projectId!)
  const [isDragOver, setIsDragOver] = useState(false)
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentOut | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docs = docsData?.items ?? []

  // Auto-refresh while docs are still parsing
  const hasQueuedOrParsing = docs.some(d => d.processing_status === 'queued' || d.processing_status === 'parsing')
  useEffect(() => {
    if (!hasQueuedOrParsing) return
    const interval = setInterval(() => { refetchDocs(); refetchProject() }, 2000)
    return () => clearInterval(interval)
  }, [hasQueuedOrParsing, refetchDocs, refetchProject])

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    try {
      await uploadDocs.mutateAsync(Array.from(files))
      toast({ title: `${files.length} file${files.length !== 1 ? 's' : ''} uploaded`, description: 'Parsing in background.' })
      refetchProject()
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    }
  }, [uploadDocs, refetchProject])

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); handleFiles(Array.from(e.dataTransfer.files)) }, [handleFiles])

  // ── Chunks state ──
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [strategy, setStrategy] = useState<ChunkStrategy>('recursive')
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(50)
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [previewResult, setPreviewResult] = useState<{ samples: string[]; estimated: number } | null>(null)
  const [deleteChunkTarget, setDeleteChunkTarget] = useState<ChunkOut | null>(null)
  const [showChunkConfig, setShowChunkConfig] = useState(false)
  // Per-document pagination state: doc_id -> { page, pageSize }
  const [chunkPages, setChunkPages] = useState<Record<string, { page: number; pageSize: number }>>({})
  // Expanded/collapsed per document
  const [collapsedDocs, setCollapsedDocs] = useState<Set<string>>(new Set())

  const previewMutation = useChunkPreview(projectId!)
  const generateMutation = useGenerateChunks(projectId!)
  const updateChunk = useUpdateChunk(projectId!)
  const deleteChunk = useDeleteChunk(projectId!)
  const parsedDocs = docs.filter(d => d.processing_status === 'parsed')

  // GA Pairs data
  const { data: gaPairsData, isError: gaIsError, error: gaError } = useGAPairs(projectId!, { page: 1, pageSize: 1 })
  const gaPairsCount = gaPairsData?.pagination.total_items ?? 0
  // Questions data
  const { data: questionsData, isError: qIsError, error: qError } = useQuestions(projectId!, { page: 1, pageSize: 1 })
  const questionsCount = questionsData?.pagination.total_items ?? 0
  // Dataset items data
  const { data: datasetData, isError: dsIsError, error: dsError } = useDatasetItems(projectId!, { page: 1, pageSize: 1 })
  const datasetCount = datasetData?.pagination.total_items ?? 0

  const anyError = docsIsError || gaIsError || qIsError || dsIsError
  const firstError = docsError || gaError || qError || dsError

  const toggleDocSelect = (id: string) => setSelectedDocIds(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id])
  const toggleExpandDoc = (docId: string) => setCollapsedDocs(p => { const n = new Set(p); n.has(docId) ? n.delete(docId) : n.add(docId); return n })

  const handleSaveEdit = async (chunkId: string) => {
    try { await updateChunk.mutateAsync({ chunkId, content: editContent }); toast({ title: 'Saved' }); setEditingChunkId(null) }
    catch (err) { toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' }) }
  }

  const handlePreview = async () => {
    if (selectedDocIds.length === 0) { toast({ title: 'Select a document', variant: 'destructive' }); return }
    const doc = docs.find(d => d.id === selectedDocIds[0])
    if (doc && doc.processing_status !== 'parsed') {
      toast({ title: 'Document not ready', description: `"${doc.filename}" is still ${doc.processing_status}. Wait for parsing to finish.`, variant: 'destructive' })
      return
    }
    try {
      const r = await previewMutation.mutateAsync({ document_id: selectedDocIds[0], strategy, chunk_size: chunkSize, chunk_overlap: chunkOverlap })
      setPreviewResult({ samples: r.sample_chunks, estimated: r.estimated_total_chunks })
      toast({ title: 'Preview ready', description: `~${r.estimated_total_chunks} chunks estimated` })
    } catch (err) {
      toast({ title: 'Preview failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    }
  }

  const handleGenerate = async () => {
    if (selectedDocIds.length === 0) { toast({ title: 'Select documents first', variant: 'destructive' }); return }
    const validIds = selectedDocIds.filter(id => parsedDocs.some(d => d.id === id))
    if (validIds.length === 0) { toast({ title: 'No parsed documents selected', description: 'Wait for parsing to complete.', variant: 'destructive' }); return }
    try {
      const r = await generateMutation.mutateAsync({ document_ids: validIds, strategy, chunk_size: chunkSize, chunk_overlap: chunkOverlap })
      toast({
        title: `Generating chunks for ${validIds.length} doc${validIds.length !== 1 ? 's' : ''}`,
        description: `Task: ${r.task_id.slice(0, 8)}… When complete, generate GA Pairs from the section below.`,
      })
      setPreviewResult(null)
      // Initialize pagination state for each doc
      const pages: Record<string, { page: number; pageSize: number }> = {}
      for (const id of validIds) { pages[id] = { page: 1, pageSize: 25 } }
      setChunkPages(pages)
      setCollapsedDocs(new Set())
      refetchProject()
    } catch (err) {
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    }
  }

  const setDocChunkPage = (docId: string, page: number) => {
    setChunkPages(p => ({ ...p, [docId]: { ...p[docId], page } }))
  }
  const setDocChunkPageSize = (docId: string, pageSize: number) => {
    setChunkPages(p => ({ ...p, [docId]: { page: 1, pageSize } }))
  }

  const handleDeleteProject = async () => {
    setDeleting(true)
    try { await deleteProject.mutateAsync(projectId!); toast({ title: 'Deleted' }); navigate('/projects', { replace: true }) }
    catch (err) { toast({ title: 'Delete failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' }) }
    finally { setDeleting(false); setShowDelete(false) }
  }

  if (projLoading) return <LoadingState />
  if (projError || !project) return <ErrorState error={projErrorObj} message={!projErrorObj ? "Project not found" : undefined} onRetry={refetchProject} />
  if (anyError) return <ErrorState error={firstError} onRetry={refetchProject} />

  const progress = project.pipeline_progress
  const progressSteps = [
    { label: 'Upload', key: 'documents' as const },
    { label: 'Chunk', key: 'chunks' as const },
    { label: 'GA Pairs', key: 'ga_pairs' as const },
    { label: 'Questions', key: 'questions' as const },
    { label: 'Dataset', key: 'dataset_items' as const },
  ]

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6 max-w-5xl mx-auto">
      <motion.div variants={fadeUp} className="space-y-4">
        <PageHeader
          title={project.name}
          description={project.description || undefined}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/projects')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
              <Button variant="outline" onClick={() => setShowDelete(true)} className="text-error hover:text-error"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
            </div>
          }
        />
        <Card className="border-hairline bg-stone/30">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto">
              {progressSteps.map((step, i) => {
                const val = progress[step.key]
                const active = val > 0
                return (
                  <div key={step.key} className="flex items-center gap-1 sm:gap-3 flex-1 min-w-0">
                    <div className={`flex flex-col items-center gap-1 flex-shrink-0 ${active ? 'text-deep-green' : 'text-muted'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-deep-green text-white' : 'bg-stone text-muted border border-hairline'}`}>
                        {i + 1}
                      </div>
                      <span className="text-[10px] font-medium text-center leading-tight">{step.label}</span>
                    </div>
                    {i < progressSteps.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded-full ${active ? 'bg-deep-green' : 'bg-hairline'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Step 1: Upload */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-deep-green text-white text-xs font-bold flex items-center justify-center">1</div>
          <h3 className="text-base font-semibold text-ink">Upload Documents</h3>
          <span className="text-xs text-muted ml-2">{docs.length} total</span>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
            isDragOver ? 'border-action bg-action/5 scale-[1.01]' : 'border-hairline hover:border-action/40 hover:bg-stone/30'
          }`}
        >
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.md,.txt" className="hidden" onChange={e => handleFiles(Array.from(e.target.files || []))} />
          <Upload className={`h-10 w-10 mx-auto mb-3 transition-colors ${isDragOver ? 'text-action' : 'text-muted'}`} />
          <p className="text-sm font-medium text-ink">{isDragOver ? 'Drop to upload' : 'Drag & drop files or click to browse'}</p>
          <p className="text-xs text-muted mt-1">PDF, DOCX, MD, TXT — any size</p>
        </div>

        {uploadDocs.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-body-muted py-4"><Loader2 className="h-4 w-4 animate-spin" />Uploading and parsing…</div>
        )}

        {docs.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-stone/50 transition-colors group">
            <File className={`h-6 w-6 flex-shrink-0 ${fileTypeColors[doc.file_type]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink truncate">{doc.filename}</span>
                <Badge variant={statusConfig[doc.processing_status].variant} className="text-[10px]">{statusConfig[doc.processing_status].label}</Badge>
              </div>
              <div className="flex gap-3 mt-0.5 text-xs text-muted">
                <span className="uppercase">{doc.file_type}</span>
                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                {doc.processing_status === 'failed' && doc.parse_error && <span className="text-error truncate">{doc.parse_error}</span>}
              </div>
            </div>
            <button onClick={() => setDeleteDocTarget(doc)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-error p-1 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </motion.div>

      {/* Step 2: Generate Chunks */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center">2</div>
          <h3 className="text-base font-semibold text-ink">Generate Chunks</h3>
          <span className="text-xs text-muted ml-2">{progress.chunks} total</span>
        </div>

        {!showChunkConfig && progress.chunks === 0 && parsedDocs.length > 0 && (
          <button onClick={() => setShowChunkConfig(true)} className="w-full border-2 border-dashed border-hairline rounded-xl p-6 text-center hover:border-action/40 hover:bg-stone/30 transition-all">
            <Layers className="h-8 w-8 text-muted mx-auto mb-2" />
            <p className="text-sm font-medium text-ink">Configure chunking</p>
            <p className="text-xs text-muted mt-1">{parsedDocs.length} parsed document{parsedDocs.length !== 1 ? 's' : ''} ready</p>
          </button>
        )}

        {(showChunkConfig || progress.chunks > 0) && (
          <Card className="border-hairline">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-ink block mb-2">Documents</label>
                  {parsedDocs.length === 0 ? (
                    <p className="text-xs text-muted py-2">Upload and wait for parsing first.</p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto border border-hairline rounded-md p-2">
                      {parsedDocs.map(d => (
                        <label key={d.id} className="flex items-center gap-2 cursor-pointer py-1">
                          <input type="checkbox" checked={selectedDocIds.includes(d.id)} onChange={() => toggleDocSelect(d.id)} className="rounded h-4 w-4" />
                          <span className="text-sm text-ink truncate">{d.filename}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-ink block mb-1.5">Strategy</label>
                    <div className="space-y-1">
                      {strategies.map(s => (
                        <label key={s.value} className="flex items-start gap-2 cursor-pointer">
                          <input type="radio" name="strategy" checked={strategy === s.value} onChange={() => setStrategy(s.value)} className="mt-0.5 h-4 w-4" />
                          <div><span className="text-sm text-ink">{s.label}</span><p className="text-xs text-muted">{s.desc}</p></div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-ink block mb-1">Chunk size</label>
                      <input type="number" value={chunkSize} onChange={e => setChunkSize(Number(e.target.value))} min={10} max={8000} step={50} className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-action" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-ink block mb-1">Overlap</label>
                      <input type="number" value={chunkOverlap} onChange={e => setChunkOverlap(Number(e.target.value))} min={0} max={1000} step={10} className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-action" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={handlePreview} disabled={previewMutation.isPending || selectedDocIds.length === 0}>
                  {previewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}Preview
                </Button>
                <Button onClick={handleGenerate} disabled={generateMutation.isPending || selectedDocIds.length === 0}>
                  {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <AnimatePresence>
          {previewResult && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0, height: 0 }} className="border border-deep-green/20 rounded-xl p-4 bg-deep-green/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-ink">Preview ~{previewResult.estimated} chunks</span>
                <button onClick={() => setPreviewResult(null)} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {previewResult.samples.map((s, i) => (
                  <Card key={i} className="border-hairline"><CardContent className="p-3"><p className="text-xs text-muted mb-1">Sample {i + 1}</p><p className="text-sm text-ink whitespace-pre-wrap">{s}</p></CardContent></Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chunks — per-document paginated sections */}
        {parsedDocs.map(doc => {
          const docId = doc.id
          const cp = chunkPages[docId] || { page: 1, pageSize: 25 }
          return <DocumentChunkSection
            key={doc.id}
            projectId={projectId!}
            document={doc}
            docId={doc.id}
            page={cp.page}
            pageSize={cp.pageSize}
            collapsed={collapsedDocs.has(docId)}
            editingChunkId={editingChunkId}
            editContent={editContent}
            fileTypeColors={fileTypeColors}
            onToggleExpand={toggleExpandDoc}
            onEditStart={(id, content) => { setEditingChunkId(id); setEditContent(content) }}
            onEditCancel={() => setEditingChunkId(null)}
            onEditSave={handleSaveEdit}
            onDeleteTarget={setDeleteChunkTarget}
            onPageChange={(p) => setDocChunkPage(docId, p)}
            onPageSizeChange={(s) => setDocChunkPageSize(docId, s)}
          />
        })}
      </motion.div>

      {/* Step 3: GA Pairs */}
      {progress.chunks > 0 && (
        <motion.div variants={fadeUp} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center">3</div>
              <h3 className="text-base font-semibold text-ink">GA Pairs</h3>
              <span className="text-xs text-muted ml-2">{gaPairsCount} total</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/ga-pairs`)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View All
            </Button>
          </div>

          {gaPairsCount === 0 ? (
            <Card className="border-hairline">
              <CardContent className="p-6 text-center">
                <Tags className="h-8 w-8 text-muted mx-auto mb-2" />
                <p className="text-sm font-medium text-ink">Generate Genre/Audience Pairs</p>
                <p className="text-xs text-muted mt-1 mb-4">Create diverse genre/audience combinations based on your chunks for better question generation.</p>
                <Button onClick={() => navigate(`/projects/${projectId}/ga-pairs`)}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Generate GA Pairs
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-hairline">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-deep-green/10 flex items-center justify-center">
                    <Tags className="h-5 w-5 text-deep-green" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{gaPairsCount} GA Pair{gaPairsCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted">Ready for question generation</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/ga-pairs`)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    View
                  </Button>
                  <Button size="sm" onClick={() => navigate(`/projects/${projectId}/ga-pairs?generate=true`)}>
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Generate More
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Separator />
        </motion.div>
      )}

      {/* Step 4: Questions */}
      {progress.ga_pairs > 0 && (
        <motion.div variants={fadeUp} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center">4</div>
              <h3 className="text-base font-semibold text-ink">Questions</h3>
              <span className="text-xs text-muted ml-2">{questionsCount} total</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/questions`)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View All
            </Button>
          </div>

          {questionsCount === 0 ? (
            <Card className="border-hairline">
              <CardContent className="p-6 text-center">
                <MessageSquare className="h-8 w-8 text-muted mx-auto mb-2" />
                <p className="text-sm font-medium text-ink">Generate Questions</p>
                <p className="text-xs text-muted mt-1 mb-4">
                  Create questions from your chunks and GA pairs for your dataset.
                </p>
                <Button onClick={() => navigate(`/projects/${projectId}/questions`)}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Generate Questions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-hairline">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-action/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-action" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{questionsCount} Question{questionsCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted">Ready for review and answer generation</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/questions`)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    View
                  </Button>
                  <Button size="sm" onClick={() => navigate(`/projects/${projectId}/questions`)}>
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Generate Questions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Separator />
        </motion.div>
      )}

      {/* Step 5: Dataset Review */}
      {progress.questions > 0 && (
        <motion.div variants={fadeUp} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center">5</div>
              <h3 className="text-base font-semibold text-ink">Dataset</h3>
              <span className="text-xs text-muted ml-2">{datasetCount} items</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/dataset-review`)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Review & Export
            </Button>
          </div>

          {datasetCount === 0 ? (
            <Card className="border-hairline">
              <CardContent className="p-6 text-center">
                <Download className="h-8 w-8 text-muted mx-auto mb-2" />
                <p className="text-sm font-medium text-ink">Generate Answers</p>
                <p className="text-xs text-muted mt-1 mb-4">
                  Generate answers for your questions to create dataset items.
                </p>
                <Button onClick={() => navigate(`/projects/${projectId}/dataset-review`)}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Generate Answers
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-hairline">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-deep-green/10 flex items-center justify-center">
                    <Download className="h-5 w-5 text-deep-green" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{datasetCount} Item{datasetCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted">Ready for review and export</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate(`/projects/${projectId}/dataset-review`)}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Review
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      <ConfirmDialog open={showDelete} onOpenChange={setShowDelete} title="Delete project" message={`Remove "${project.name}"?`} confirmLabel={deleting ? 'Deleting…' : 'Delete'} variant="destructive" onConfirm={handleDeleteProject} />
      <ConfirmDialog open={!!deleteDocTarget} onOpenChange={o => !o && setDeleteDocTarget(null)} title="Delete document" message={`Remove "${deleteDocTarget?.filename}"?`} confirmLabel="Delete" variant="destructive" onConfirm={async () => { if (!deleteDocTarget) return; try { await deleteDoc.mutateAsync(deleteDocTarget.id); toast({ title: 'Deleted' }); setDeleteDocTarget(null) } catch (err) { toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' }) } }} />
      <ConfirmDialog open={!!deleteChunkTarget} onOpenChange={o => !o && setDeleteChunkTarget(null)} title="Delete chunk" message={`Remove chunk #${deleteChunkTarget?.chunk_index}?`} confirmLabel="Delete" variant="destructive" onConfirm={async () => { if (!deleteChunkTarget) return; try { await deleteChunk.mutateAsync(deleteChunkTarget.id); toast({ title: 'Deleted' }); setDeleteChunkTarget(null) } catch (err) { toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' }) } }} />
    </motion.div>
  )
}
