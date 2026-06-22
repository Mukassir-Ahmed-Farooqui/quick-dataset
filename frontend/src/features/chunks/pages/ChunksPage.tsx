import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layers, ArrowLeft, Loader2, Play, Eye, Trash2, Check, X, Edit3 } from 'lucide-react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useDocuments } from '@/hooks/useDocuments'
import { useChunks, useChunkPreview, useGenerateChunks, useUpdateChunk, useDeleteChunk } from '@/hooks/useChunks'
import { toast } from '@/lib/toast'
import { stagger, fadeUp } from '@/lib/animations'
import type { ChunkOut, ChunkStrategy } from '@/types/api'

const strategies: { value: ChunkStrategy; label: string; desc: string }[] = [
  { value: 'recursive', label: 'Recursive', desc: 'Split by paragraphs, then sentences, then characters' },
  { value: 'markdown', label: 'Markdown', desc: 'Split by markdown headings and sections' },
  { value: 'token', label: 'Token', desc: 'Split by token count with configurable overlap' },
]

export default function ChunksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data: docsData } = useDocuments(projectId!)
  const docs = docsData?.items?.filter(d => d.processing_status === 'parsed') ?? []

  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [strategy, setStrategy] = useState<ChunkStrategy>('recursive')
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(100)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [previewResult, setPreviewResult] = useState<{ samples: string[]; estimated: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChunkOut | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Filter chunks by first selected document so the list matches what was generated
  const activeDocId = selectedDocs.length === 1 ? selectedDocs[0] : undefined
  const { data: chunksData, isLoading, isError, error, refetch } = useChunks(projectId!, { documentId: activeDocId, page, pageSize })

  // Reset to page 1 when switching documents
  useEffect(() => {
    setPage(1)
  }, [activeDocId])
  const previewMutation = useChunkPreview(projectId!)
  const generateMutation = useGenerateChunks(projectId!)
  const updateMutation = useUpdateChunk(projectId!)
  const deleteMutation = useDeleteChunk(projectId!)
  const chunks = chunksData?.items ?? []

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const handlePreview = async () => {
    if (selectedDocs.length === 0) {
      toast({ title: 'Select documents', description: 'Choose at least one parsed document.', variant: 'destructive' })
      return
    }
    try {
      const result = await previewMutation.mutateAsync({
        document_id: selectedDocs[0],
        strategy,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
      })
      setPreviewResult({ samples: result.sample_chunks, estimated: result.estimated_total_chunks })
      toast({ title: 'Preview ready', description: `Estimated ${result.estimated_total_chunks} chunks.` })
    } catch (err) {
      toast({ title: 'Preview failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    }
  }

  const handleGenerate = async () => {
    if (selectedDocs.length === 0) {
      toast({ title: 'Select documents', description: 'Choose at least one parsed document.', variant: 'destructive' })
      return
    }
    try {
      const result = await generateMutation.mutateAsync({
        document_ids: selectedDocs,
        strategy,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
      })
      toast({ title: 'Generation started', description: `Task: ${result.task_id.slice(0, 8)}\u2026` })
      setPreviewResult(null)
      refetch()
    } catch (err) {
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    }
  }

  const handleEdit = (chunk: ChunkOut) => {
    setEditingId(chunk.id)
    setEditContent(chunk.content)
  }

  const handleSaveEdit = async (chunkId: string) => {
    try {
      await updateMutation.mutateAsync({ chunkId, content: editContent })
      toast({ title: 'Updated', description: 'Chunk content saved.' })
      setEditingId(null)
    } catch (err) {
      toast({ title: 'Update failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    }
  }

  const handleDeleteChunk = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast({ title: 'Deleted', description: 'Chunk removed.' })
      setDeleteTarget(null)
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Chunks"
          description={`Project: ${projectId?.slice(0, 8)}\u2026`}
          action={
            <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          }
        />
      </motion.div>

      {/* Strategy + document selector */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document selector */}
        <Card className="border border-hairline rounded-lg">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-ink">Documents</h3>
            {docs.length === 0 ? (
              <p className="text-xs text-muted">No parsed documents. Upload and wait for parsing first.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {docs.map(doc => (
                  <label key={doc.id} className="flex items-center gap-2.5 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="rounded border-hairline text-action focus:ring-action h-4 w-4"
                    />
                    <span className="text-sm text-ink truncate">{doc.filename}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedDocs.length > 0 && (
              <p className="text-xs text-muted">{selectedDocs.length} selected</p>
            )}
          </CardContent>
        </Card>

        {/* Strategy */}
        <Card className="border border-hairline rounded-lg">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-ink">Strategy</h3>
            <div className="space-y-2">
              {strategies.map(s => (
                <label key={s.value} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === s.value}
                    onChange={() => setStrategy(s.value)}
                    className="mt-0.5 border-hairline text-action focus:ring-action h-4 w-4"
                  />
                  <div>
                    <span className="text-sm text-ink">{s.label}</span>
                    <p className="text-xs text-muted">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Size + overlap */}
        <Card className="border border-hairline rounded-lg">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-ink">Chunk Size</label>
              <input
                type="number"
                value={chunkSize}
                onChange={e => setChunkSize(Number(e.target.value))}
                min={100}
                max={4000}
                step={50}
                className="w-full mt-1 border border-hairline rounded-md px-3 py-1.5 text-sm text-ink
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink">Chunk Overlap</label>
              <input
                type="number"
                value={chunkOverlap}
                onChange={e => setChunkOverlap(Number(e.target.value))}
                min={0}
                max={1000}
                step={10}
                className="w-full mt-1 border border-hairline rounded-md px-3 py-1.5 text-sm text-ink
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={previewMutation.isPending || selectedDocs.length === 0}
                className="flex-1"
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                )}
                Preview
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generateMutation.isPending || selectedDocs.length === 0}
                className="flex-1"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Preview result */}
      {previewResult && (
        <motion.div variants={fadeUp} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">
              Preview &mdash; ~{previewResult.estimated} chunks estimated
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setPreviewResult(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {previewResult.samples.map((sample, i) => (
              <Card key={i} className="border border-hairline">
                <CardContent className="p-3">
                  <p className="text-xs text-muted mb-1">Sample {i + 1}</p>
                  <p className="text-sm text-ink line-clamp-4 leading-relaxed">{sample}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Chunk list */}
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={error instanceof Error ? error.message : 'Failed to load chunks'} onRetry={refetch} />
      ) : chunks.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={Layers}
            title="No chunks generated"
            description="Select documents and a strategy above, then click Generate."
          />
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">
              {chunksData?.pagination.total_items ?? 0} chunk{(chunksData?.pagination.total_items ?? 0) !== 1 ? 's' : ''}
              {chunksData && chunksData.pagination.total_items > pageSize && (
                <span className="text-xs text-muted ml-2">(page {page} of {chunksData.pagination.total_pages})</span>
              )}
            </h3>
          </div>
          {chunks.map((chunk) => (
            <motion.div key={chunk.id} variants={fadeUp}>
              <Card className="border border-hairline rounded-lg">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted mb-2">
                      <Badge variant="outline" className="text-[10px]">#{chunk.chunk_index}</Badge>
                      <span>{chunk.token_count} tokens</span>
                      <span>{new Date(chunk.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {editingId === chunk.id ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleSaveEdit(chunk.id)} className="h-7 w-7 text-success">
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="h-7 w-7 text-muted">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(chunk)} className="h-7 w-7 text-muted hover:text-ink">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(chunk)} className="h-7 w-7 text-muted hover:text-error">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === chunk.id ? (
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full text-sm text-ink border border-hairline rounded-md p-2 resize-y min-h-[100px]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action font-sans"
                    />
                  ) : (
                    <p className="text-sm text-ink leading-relaxed line-clamp-6 whitespace-pre-wrap">{chunk.content}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={chunksData?.pagination.total_items ?? 0}
            onPageChange={setPage}
          />
        </motion.div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete chunk"
        message={`Remove chunk #${deleteTarget?.chunk_index}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteChunk}
      />
    </motion.div>
  )
}
