import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowRight, Play, Tags } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import Collapsible from '@/components/common/Collapsible'
import FormField from '@/components/common/FormField'
import { TaskTray } from '@/components/common/TaskProgress'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useDocuments } from '@/hooks/useDocuments'
import { useGenerateGAPairs } from '@/hooks/useGAPairs'
import { useProject } from '@/hooks/useProjects'
import { useProviders } from '@/hooks/useProviders'
import { fadeUp } from '@/lib/animations'
import { plural } from '@/lib/format'
import { trackTask, useTrackedTasks } from '@/lib/tasks'
import { sonnerToast, toastError } from '@/lib/toast'
import type { GAGeneratePayload } from '@/types/api'
import DocumentPicker from '@/features/documents/components/DocumentPicker'
import NextStepBar from '@/features/projects/components/NextStepBar'
import GAEstimate from '../components/GAEstimate'
import GAPairList from '../components/GAPairList'

const clampPairs = (n: number) => (Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : 3)

export default function GAPairsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { data: docsData, isLoading, isError, error, refetch } = useDocuments(projectId)
  const { data: project } = useProject(projectId)
  const { data: providers } = useProviders()
  const generate = useGenerateGAPairs(projectId)
  const tasks = useTrackedTasks(projectId).filter((t) => t.kind === 'ga-pairs')

  const allDocs = docsData?.items ?? []
  const parsedDocs = allDocs.filter((d) => d.processing_status === 'parsed')
  const [picked, setPicked] = useState<string[] | null>(null)
  const selected = (picked ?? parsedDocs.map((d) => d.id)).filter((id) => parsedDocs.some((d) => d.id === id))
  const [pairsPerDoc, setPairsPerDoc] = useState(3)
  const [keyId, setKeyId] = useState('')

  const progress = project?.pipeline_progress
  const pairCount = progress?.ga_pairs ?? 0
  const keys = providers?.items ?? []
  const defaultKeyName = project?.default_llm_key?.name ?? keys.find((k) => k.is_default)?.name

  const payload: GAGeneratePayload | null =
    selected.length > 0 ? { document_ids: selected, pairs_per_document: pairsPerDoc, llm_key_id: keyId || undefined } : null

  const onGenerate = () => {
    if (!payload) return
    generate.mutate(payload, {
      onSuccess: (r) => {
        trackTask({ id: r.task_id, projectId, kind: 'ga-pairs', label: `GA pairs for ${plural(selected.length, 'document')}` })
        sonnerToast('Generating GA pairs', { description: 'Progress shows below. New pairs appear as they arrive.' })
      },
      onError: (err) => toastError('Could not start generation', err, onGenerate),
    })
  }

  if (isLoading) return <LoadingState count={2} />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const questionsLink = `/projects/${projectId}/questions`

  if (parsedDocs.length === 0 || (progress && progress.chunks === 0)) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Step 3 · GA pairs · optional" title="Genre × audience pairs" />
        <EmptyState
          icon={Tags}
          step="Step 3 · Optional"
          title={parsedDocs.length === 0 ? 'Upload documents first' : 'Create chunks first'}
          description="GA pairs describe who a question is for and in what style. Each pair becomes a lens, so the same passage yields more varied questions."
          action={
            <Button asChild>
              <Link to={`/projects/${projectId}/${parsedDocs.length === 0 ? 'documents' : 'chunks'}`}>{parsedDocs.length === 0 ? 'Upload documents' : 'Create chunks'}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · GA pairs · optional"
        title="Genre × audience pairs"
        description="Lenses like “FAQ for beginners” or “Exam question for experts” make generated questions more diverse."
        action={
          pairCount === 0 && (
            <Button asChild variant="ghost">
              <Link to={questionsLink}>
                Skip to questions <ArrowRight />
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-4 border border-line p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DocumentPicker docs={parsedDocs} selected={selected} onChange={setPicked} />
        <div className="flex flex-col gap-4">
          <FormField label="Pairs per document" htmlFor="ga-per-doc" hint="3 is a good balance of variety and cost.">
            <Input
              id="ga-per-doc"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              value={pairsPerDoc}
              onChange={(e) => setPairsPerDoc(clampPairs(e.target.valueAsNumber))}
              className="w-28 font-mono"
            />
          </FormField>
          <Collapsible hint={keyId ? keys.find((k) => k.id === keyId)?.name : `default key${defaultKeyName ? ` · ${defaultKeyName}` : ''}`}>
            <FormField label="LLM key" htmlFor="ga-key" hint={keys.length === 0 ? <Link to="/providers" className="underline underline-offset-2">Add a provider key</Link> : undefined}>
              <Select id="ga-key" value={keyId} onChange={(e) => setKeyId(e.target.value)}>
                <option value="">Project default{defaultKeyName ? ` (${defaultKeyName})` : ''}</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} · {k.provider}
                  </option>
                ))}
              </Select>
            </FormField>
          </Collapsible>
          <div className="mt-auto space-y-2">
            <GAEstimate projectId={projectId} payload={payload} />
            <Button size="lg" className="w-full" onClick={onGenerate} loading={generate.isPending} disabled={!payload}>
              <Play /> Generate {payload ? `≈${(selected.length * pairsPerDoc).toLocaleString()} ` : ''}pairs
            </Button>
          </div>
        </div>
      </div>

      <TaskTray tasks={tasks} />

      <GAPairList projectId={projectId} docs={parsedDocs} />

      {pairCount > 0 && tasks.length === 0 && (
        <NextStepBar to={questionsLink} label="Generate questions" hint={`${plural(pairCount, 'pair')} ready to combine with your chunks.`} />
      )}
    </m.div>
  )
}
