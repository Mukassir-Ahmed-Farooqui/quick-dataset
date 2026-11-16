import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { m } from 'framer-motion'
import { Layers, Play } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import { TaskTray } from '@/components/common/TaskProgress'
import { Button } from '@/components/ui/button'
import { useDocuments } from '@/hooks/useDocuments'
import { useGenerateChunks } from '@/hooks/useChunks'
import { useProject } from '@/hooks/useProjects'
import { fadeUp } from '@/lib/animations'
import { plural } from '@/lib/format'
import { trackTask, useTrackedTasks } from '@/lib/tasks'
import { sonnerToast, toastError } from '@/lib/toast'
import DocumentPicker from '@/features/documents/components/DocumentPicker'
import NextStepBar from '@/features/projects/components/NextStepBar'
import ChunkSettings from '../components/ChunkSettings'
import ChunkPreview from '../components/ChunkPreview'
import ChunkList from '../components/ChunkList'
import { DEFAULT_CHUNK_CONFIG, validateChunkConfig, type ChunkConfig } from '../components/chunkConfig'

export default function ChunksPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { data: docsData, isLoading, isError, error, refetch } = useDocuments(projectId)
  const { data: project } = useProject(projectId)
  const generate = useGenerateChunks(projectId)
  const tasks = useTrackedTasks(projectId).filter((t) => t.kind === 'chunks')

  const allDocs = docsData?.items ?? []
  const parsedDocs = allDocs.filter((d) => d.processing_status === 'parsed')
  const parsing = allDocs.filter((d) => d.processing_status === 'queued' || d.processing_status === 'parsing').length

  // null = "all parsed documents" so newly parsed files are included automatically.
  const [picked, setPicked] = useState<string[] | null>(null)
  const selected = (picked ?? parsedDocs.map((d) => d.id)).filter((id) => parsedDocs.some((d) => d.id === id))
  const [config, setConfig] = useState<ChunkConfig>(DEFAULT_CHUNK_CONFIG)
  const [previewDoc, setPreviewDoc] = useState<string | null>(null)
  const configError = validateChunkConfig(config)
  const previewDocId = previewDoc && parsedDocs.some((d) => d.id === previewDoc) ? previewDoc : (selected[0] ?? parsedDocs[0]?.id)

  const running = tasks.length > 0 && generate.isPending === false
  const chunkCount = project?.pipeline_progress.chunks ?? 0

  const onGenerate = () => {
    const payload = { document_ids: selected, strategy: config.strategy, chunk_size: config.chunkSize, chunk_overlap: config.chunkOverlap }
    generate.mutate(payload, {
      onSuccess: (r) => {
        trackTask({ id: r.task_id, projectId, kind: 'chunks', label: `Chunking ${plural(selected.length, 'document')}` })
        sonnerToast('Chunking started', { description: 'Progress shows below. You can keep working meanwhile.' })
      },
      onError: (err) => toastError('Could not start chunking', err, onGenerate),
    })
  }

  if (isLoading) return <LoadingState count={2} />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  if (parsedDocs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Step 2 · Chunks" title="Chunks" />
        <EmptyState
          icon={Layers}
          step="Step 2 · Chunks"
          title={parsing > 0 ? 'Waiting for documents to finish parsing' : 'Upload documents first'}
          description={
            parsing > 0
              ? `${plural(parsing, 'document')} still parsing. This page unlocks as soon as one is ready.`
              : 'Chunking splits each parsed document into passages short enough for a model to read in one go.'
          }
          action={
            <Button asChild variant={parsing > 0 ? 'outline' : 'default'}>
              <Link to={`/projects/${projectId}/documents`}>{parsing > 0 ? 'View documents' : 'Upload documents'}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        eyebrow="Step 2 · Chunks"
        title="Chunks"
        description="Split documents into passages. Check the live preview, then generate — defaults work well for most files."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4 border border-line p-4">
          <DocumentPicker docs={parsedDocs} selected={selected} onChange={setPicked} />
          <ChunkSettings value={config} onChange={setConfig} error={configError} />
          <div className="mt-auto space-y-2">
            <Button size="lg" className="w-full" onClick={onGenerate} loading={generate.isPending} disabled={selected.length === 0 || !!configError}>
              <Play /> Generate chunks
            </Button>
            <p className="text-center text-xs text-fg-muted">
              {selected.length === 0 ? 'Select at least one document.' : `Runs in the background for ${plural(selected.length, 'document')}.`}
            </p>
          </div>
        </div>
        <ChunkPreview projectId={projectId} docs={parsedDocs} docId={previewDocId} onDocChange={setPreviewDoc} config={config} valid={!configError} />
      </div>

      <TaskTray tasks={tasks} />

      <ChunkList projectId={projectId} docs={allDocs} />

      {chunkCount > 0 && !running && (
        <NextStepBar
          to={`/projects/${projectId}/ga-pairs`}
          label="Generate GA pairs"
          hint={`${plural(chunkCount, 'chunk')} ready. Genre × audience lenses are optional but make questions more varied.`}
        />
      )}
    </m.div>
  )
}
