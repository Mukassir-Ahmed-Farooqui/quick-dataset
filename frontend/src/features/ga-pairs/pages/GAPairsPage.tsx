import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layers, ArrowLeft, Loader2, Play, Eye, Trash2, Edit3, Check, X } from 'lucide-react'
import { motion } from 'framer-motion'
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
import { useGAPairs, useGenerateGAPairs, useEstimateGAPairs, useUpdateGAPair, useDeleteGAPair } from '@/hooks/useGAPairs'
import { toast } from '@/lib/toast'
import { stagger, fadeUp } from '@/lib/animations'
import type { GAPairOut } from '@/types/api'

export default function GAPairsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data: docsData, isError: docsIsError, error: docsError } = useDocuments(projectId!)
  const docs = docsData?.items?.filter(d => d.processing_status === 'parsed') ?? []

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [pairsPerDoc, setPairsPerDoc] = useState(3)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const activeDocId = selectedDocIds.length === 1 ? selectedDocIds[0] : undefined
  const { data, isLoading, isError: pairsIsError, error: pairsError, refetch } = useGAPairs(projectId!, { documentId: activeDocId, page, pageSize })
  const generateMutation = useGenerateGAPairs(projectId!)
  const estimateMutation = useEstimateGAPairs(projectId!)
  const updateMutation = useUpdateGAPair(projectId!)
  const deleteMutation = useDeleteGAPair(projectId!)
  const pairs = data?.items ?? []

  const anyError = docsIsError || pairsIsError
  const firstError = docsError || pairsError

  const [estimateResult, setEstimateResult] = useState<{ cost: number; items: number; warning?: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ genre_title: string; genre_description: string; audience_title: string; audience_description: string }>({
    genre_title: '', genre_description: '', audience_title: '', audience_description: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<GAPairOut | null>(null)

  // const selectedDocs = selectedDocIds.length > 0 ? docs.filter(d => selectedDocIds.includes(d.id)) : []

  // Reset page when document filter changes
  useEffect(() => setPage(1), [activeDocId])

  const toggleDoc = (id: string) => {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const handleEstimate = async () => {
    if (selectedDocIds.length === 0) { toast({ title: 'Select documents', variant: 'destructive' }); return }
    try {
      const result = await estimateMutation.mutateAsync({
        document_ids: selectedDocIds,
        pairs_per_document: pairsPerDoc,
      })
      setEstimateResult({
        cost: result.estimated_cost_usd,
        items: result.estimated_item_count,
        warning: result.warning ?? undefined,
      })
      toast({ title: 'Estimate ready', description: `~${result.estimated_item_count} pairs, ~$${result.estimated_cost_usd.toFixed(4)}` })
    } catch (err) {
      toast({ title: 'Estimate failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleGenerate = async () => {
    if (selectedDocIds.length === 0) { toast({ title: 'Select documents', variant: 'destructive' }); return }
    try {
      await generateMutation.mutateAsync({
        document_ids: selectedDocIds,
        pairs_per_document: pairsPerDoc,
      })
      toast({ title: 'Generation started', description: 'Processing in background. Refresh to see results.' })
      setEstimateResult(null)
    } catch (err) {
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleEdit = (pair: GAPairOut) => {
    setEditingId(pair.id)
    setEditValues({
      genre_title: pair.genre_title,
      genre_description: pair.genre_description ?? '',
      audience_title: pair.audience_title,
      audience_description: pair.audience_description ?? '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    try {
      await updateMutation.mutateAsync({
        pairId: editingId,
        data: {
          genre_title: editValues.genre_title,
          genre_description: editValues.genre_description || undefined,
          audience_title: editValues.audience_title,
          audience_description: editValues.audience_description || undefined,
        },
      })
      toast({ title: 'Updated' })
      setEditingId(null)
    } catch (err) {
      toast({ title: 'Update failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast({ title: 'Deleted' })
      setDeleteTarget(null)
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Genre/Audience Pairs"
          description="Generate diverse genre/audience combinations for question generation."
          action={
            <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          }
        />
      </motion.div>

      {/* Config: document selector + pairs per doc + actions */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="rounded border-hairline text-action focus:ring-action h-4 w-4"
                    />
                    <span className="text-sm text-ink truncate">{doc.filename}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedDocIds.length > 0 && (
              <p className="text-xs text-muted">{selectedDocIds.length} selected</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-hairline rounded-lg">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-ink">Configuration</h3>
            <div>
              <label className="text-xs text-muted block mb-1">Pairs per document</label>
              <input
                type="number"
                value={pairsPerDoc}
                onChange={e => setPairsPerDoc(Math.max(1, Math.min(10, Number(e.target.value))))}
                min={1}
                max={10}
                className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm text-ink"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEstimate}
                disabled={estimateMutation.isPending || selectedDocIds.length === 0}
                className="flex-1"
              >
                {estimateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                Estimate
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generateMutation.isPending || selectedDocIds.length === 0}
                className="flex-1"
              >
                {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-hairline rounded-lg">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium text-ink">Estimate</h3>
            {estimateResult ? (
              <div className="space-y-1">
                <p className="text-sm text-ink">{estimateResult.items} pairs estimated</p>
                <p className="text-sm text-ink">Cost: ${estimateResult.cost.toFixed(4)}</p>
                {estimateResult.warning && (
                  <p className="text-xs text-warning">{estimateResult.warning}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">Select documents and click Estimate.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pair list */}
      {isLoading ? (
        <LoadingState />
      ) : anyError ? (
        <ErrorState error={firstError} onRetry={refetch} />
      ) : pairs.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={Layers}
            title="No GA pairs generated"
            description="Select documents above, then click Generate to create Genre/Audience pairs."
          />
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">
              {data?.pagination.total_items ?? 0} pair{(data?.pagination.total_items ?? 0) !== 1 ? 's' : ''}
              {data && data.pagination.total_items > pageSize && (
                <span className="text-xs text-muted ml-2">(page {page} of {data.pagination.total_pages})</span>
              )}
            </h3>
          </div>
          {pairs.map((pair) => (
            <motion.div key={pair.id} variants={fadeUp}>
              <Card className="border border-hairline rounded-lg">
                <CardContent className="p-4">
                  {editingId === pair.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Genre Title</label>
                          <input
                            value={editValues.genre_title}
                            onChange={e => setEditValues(v => ({ ...v, genre_title: e.target.value }))}
                            className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Audience Title</label>
                          <input
                            value={editValues.audience_title}
                            onChange={e => setEditValues(v => ({ ...v, audience_title: e.target.value }))}
                            className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Genre Description</label>
                          <textarea
                            value={editValues.genre_description}
                            onChange={e => setEditValues(v => ({ ...v, genre_description: e.target.value }))}
                            className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm resize-y min-h-[60px]"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Audience Description</label>
                          <textarea
                            value={editValues.audience_description}
                            onChange={e => setEditValues(v => ({ ...v, audience_description: e.target.value }))}
                            className="w-full border border-hairline rounded-md px-3 py-1.5 text-sm resize-y min-h-[60px]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
                        <Button size="sm" onClick={handleSaveEdit}><Check className="h-3.5 w-3.5 mr-1" />Save</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">Genre</Badge>
                            <span className="text-sm font-medium text-ink">{pair.genre_title}</span>
                          </div>
                          {pair.genre_description && (
                            <p className="text-xs text-muted ml-1">{pair.genre_description}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">Audience</Badge>
                            <span className="text-sm font-medium text-ink">{pair.audience_title}</span>
                          </div>
                          {pair.audience_description && (
                            <p className="text-xs text-muted ml-1">{pair.audience_description}</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(pair)} className="h-7 w-7 text-muted hover:text-ink">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(pair)} className="h-7 w-7 text-muted hover:text-error">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted">
                        Created {new Date(pair.created_at).toLocaleDateString()}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
          <PaginationControls
            meta={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
        </motion.div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete GA Pair"
        message={`Remove "${deleteTarget?.genre_title}" / "${deleteTarget?.audience_title}"?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </motion.div>
  )
}
