import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { m } from 'framer-motion'
import { Trash2, Upload } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import ErrorState from '@/components/common/ErrorState'
import SelectionBar from '@/components/common/SelectionBar'
import { ListSkeleton } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { documentsApi } from '@/api/documents'
import { useDocuments } from '@/hooks/useDocuments'
import { fadeUp } from '@/lib/animations'
import { plural } from '@/lib/format'
import type { DocumentOut } from '@/types/api'
import UploadDropzone, { type UploadDropzoneHandle } from '../components/UploadDropzone'
import UploadQueue from '../components/UploadQueue'
import DocumentsTable from '../components/DocumentsTable'
import { useUploadQueue } from '../components/useUploadQueue'
import { undoDelete } from '@/features/projects/components/undoDelete'
import NextStepBar from '@/features/projects/components/NextStepBar'

export default function DocumentsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useDocuments(projectId)
  const uploads = useUploadQueue(projectId)
  const dropzone = useRef<UploadDropzoneHandle>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const docs = data?.items ?? []
  const parsed = docs.filter((d) => d.processing_status === 'parsed').length
  const pending = docs.filter((d) => d.processing_status === 'queued' || d.processing_status === 'parsing').length
  const failed = docs.filter((d) => d.processing_status === 'failed').length
  const visibleSelected = new Set(docs.filter((d) => selected.has(d.id)).map((d) => d.id))

  const remove = (ids: string[], label: string) =>
    undoDelete<DocumentOut>(qc, {
      listKey: ['documents', projectId],
      ids,
      message: `${label} deleted`,
      remove: (id) => documentsApi.delete(projectId, id),
      invalidate: [['project', projectId], ['chunks', projectId]],
      onApplied: () => setSelected((s) => new Set([...s].filter((id) => !ids.includes(id)))),
    })

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () => setSelected(visibleSelected.size === docs.length ? new Set() : new Set(docs.map((d) => d.id)))

  const hasDocs = docs.length > 0
  const summary = hasDocs
    ? [plural(docs.length, 'document'), parsed && `${parsed} ready`, pending && `${pending} parsing`, failed && `${failed} failed`].filter(Boolean).join(' · ')
    : 'Upload the source files your dataset will be built from.'

  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        eyebrow="Step 1 · Documents"
        title="Documents"
        description={summary}
        action={
          hasDocs && (
            <Button variant={parsed > 0 ? 'outline' : 'default'} onClick={() => dropzone.current?.open()} loading={uploads.busy}>
              <Upload /> Upload files
            </Button>
          )
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <UploadDropzone ref={dropzone} onFiles={uploads.add} compact={hasDocs} />
          <UploadQueue items={uploads.items} onRetry={uploads.retry} onDismiss={uploads.dismiss} />

          {!hasDocs && uploads.items.length === 0 && (
            <ol className="grid gap-px border border-line bg-line sm:grid-cols-3">
              {[
                ['01', 'Upload', 'Drop one or many files. Each uploads in parallel with its own progress.'],
                ['02', 'Parse', 'Text is extracted automatically in the background — no need to wait here.'],
                ['03', 'Chunk', 'Once a file shows Ready, split it into passages on the next step.'],
              ].map(([n, t, d]) => (
                <li key={n} className="bg-bg p-4">
                  <p className="num text-xs text-accent">{n}</p>
                  <p className="mt-1 font-display text-sm font-bold">{t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{d}</p>
                </li>
              ))}
            </ol>
          )}

          {hasDocs && <DocumentsTable docs={docs} selected={visibleSelected} onToggle={toggle} onToggleAll={toggleAll} onDelete={(d) => remove([d.id], `"${d.filename}"`)} />}

          {parsed > 0 && (
            <NextStepBar
              to={`/projects/${projectId}/chunks`}
              label="Create chunks"
              hint={`${plural(parsed, 'document')} parsed and ready to split into passages.`}
            />
          )}
        </>
      )}

      <SelectionBar count={visibleSelected.size} onClear={() => setSelected(new Set())}>
        <Button variant="outline" size="xs" onClick={() => remove([...visibleSelected], plural(visibleSelected.size, 'document'))}>
          <Trash2 /> Delete
        </Button>
      </SelectionBar>
    </m.div>
  )
}
