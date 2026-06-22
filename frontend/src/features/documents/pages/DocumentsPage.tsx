import { useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, ArrowLeft, Upload, Trash2, Loader2, File } from 'lucide-react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useDocuments, useUploadDocuments, useDeleteDocument } from '@/hooks/useDocuments'
import { toast } from '@/lib/toast'
import { stagger, fadeUp } from '@/lib/animations'
import type { DocumentOut, ProcessingStatus } from '@/types/api'

const statusConfig: Record<ProcessingStatus, { label: string; variant: 'outline' | 'secondary' | 'success' | 'destructive' }> = {
  queued: { label: 'Queued', variant: 'outline' },
  parsing: { label: 'Parsing\u2026', variant: 'secondary' },
  parsed: { label: 'Parsed', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
}

const fileTypeColors: Record<string, string> = {
  pdf: 'text-error',
  docx: 'text-action',
  md: 'text-warning',
  txt: 'text-muted',
}

export default function DocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useDocuments(projectId!)
  const uploadDocs = useUploadDocuments(projectId!)
  const deleteDoc = useDeleteDocument(projectId!)
  const [isDragOver, setIsDragOver] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentOut | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docs = data?.items ?? []

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    try {
      await uploadDocs.mutateAsync(Array.from(files))
      toast({ title: 'Uploaded', description: `${files.length} file${files.length !== 1 ? 's' : ''} uploaded successfully.` })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }, [uploadDocs])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }, [handleFiles])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteDoc.mutateAsync(deleteTarget.id)
      toast({ title: 'Deleted', description: `${deleteTarget.filename} removed.` })
      setDeleteTarget(null)
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Documents"
          description={`Project: ${projectId?.slice(0, 8)}\u2026`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Drop zone */}
      <motion.div variants={fadeUp}>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-action bg-action/5 scale-[1.01]'
              : 'border-hairline hover:border-action/50 hover:bg-stone/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.md,.txt"
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
          <Upload className={`h-8 w-8 mx-auto mb-3 transition-colors ${isDragOver ? 'text-action' : 'text-muted'}`} />
          <p className="text-sm font-medium text-ink">
            {isDragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
          </p>
          <p className="text-xs text-muted mt-1">PDF, DOCX, Markdown, TXT</p>
        </div>
      </motion.div>

      {/* Upload loading */}
      {uploadDocs.isPending && (
        <motion.div variants={fadeUp} className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading and parsing\u2026
        </motion.div>
      )}

      {/* Document list */}
      {isError ? (
        <motion.div variants={fadeUp}>
          <ErrorState message="Failed to load documents" onRetry={refetch} />
        </motion.div>
      ) : docs.length === 0 && !isLoading ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload PDF, DOCX, Markdown, or TXT files to get started."
            action={
              <Button onClick={() => fileInputRef.current?.click()}>Upload Documents</Button>
            }
          />
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-3">
          {docs.map((doc) => (
            <motion.div key={doc.id} variants={fadeUp}>
              <Card className="border border-hairline rounded-lg bg-canvas hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`${fileTypeColors[doc.file_type] || 'text-muted'}`}>
                    <File className="h-8 w-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink truncate">{doc.filename}</span>
                      <Badge variant={statusConfig[doc.processing_status].variant} className="text-[10px]">
                        {statusConfig[doc.processing_status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                      <span className="uppercase">{doc.file_type}</span>
                      <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    {doc.processing_status === 'failed' && doc.parse_error && (
                      <p className="text-xs text-error mt-1">{doc.parse_error}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(doc)}
                    className="text-muted hover:text-error flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete document"
        message={`Remove "${deleteTarget?.filename}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </motion.div>
  )
}
