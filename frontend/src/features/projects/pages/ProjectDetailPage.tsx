import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { m } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Trash2 } from 'lucide-react'
import FormField from '@/components/common/FormField'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { GridSkeleton } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectPipeline } from '@/components/layout/useProjectPipeline'
import { useDeleteProject, useUpdateProject } from '@/hooks/useProjects'
import { useProviders } from '@/hooks/useProviders'
import { providerLabel } from '@/features/providers/components/providerMeta'
import { fadeUp, stagger } from '@/lib/animations'
import { timeAgo } from '@/lib/format'
import { STEPS } from '@/lib/pipeline'
import { toast, toastError } from '@/lib/toast'
import { prefetchPage, stepPageKey } from '@/routes/pages'
import type { ProjectDetailOut } from '@/types/api'

const settingsSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(255),
  description: z.string().optional(),
  default_llm_key_id: z.string().optional(),
})
type SettingsForm = z.infer<typeof settingsSchema>

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-bg p-4">
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 text-2xl font-bold leading-none">{value.toLocaleString()}</p>
      {hint && <p className="mt-1.5 font-mono text-[11px] text-fg-muted">{hint}</p>}
    </div>
  )
}

function SettingsCard({ project }: { project: ProjectDetailOut }) {
  const update = useUpdateProject(project.id)
  const providers = useProviders()
  const keys = providers.data?.items ?? []
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    values: {
      name: project.name,
      description: project.description ?? '',
      default_llm_key_id: project.default_llm_key?.id ?? '',
    },
  })

  const onSubmit = async (data: SettingsForm) => {
    try {
      await update.mutateAsync({
        name: data.name.trim(),
        description: data.description?.trim() ?? '',
        ...(data.default_llm_key_id ? { default_llm_key_id: data.default_llm_key_id } : {}),
      })
      toast({ title: 'Project saved' })
    } catch (err) {
      toastError('Could not save project', err)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <span className="font-mono text-[11px] text-fg-muted">Updated {timeAgo(project.updated_at)}</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Name" htmlFor="project-name" error={errors.name?.message} required>
            <Input id="project-name" aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Description" htmlFor="project-description">
            <Textarea id="project-description" rows={2} placeholder="What is this dataset for?" {...register('description')} />
          </FormField>
          <FormField
            label="Default LLM key"
            htmlFor="project-key"
            hint={
              keys.length === 0 && !providers.isLoading ? (
                <>
                  No keys yet.{' '}
                  <Link to="/providers" className="text-fg underline underline-offset-4">
                    Add one
                  </Link>
                  .
                </>
              ) : (
                'Used by GA pairs, questions and answers unless overridden.'
              )
            }
          >
            <Select id="project-key" disabled={providers.isLoading} {...register('default_llm_key_id')}>
              <option value="" disabled={!!project.default_llm_key}>
                {project.default_llm_key ? 'Select a key' : 'None'}
              </option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>
                  {providerLabel(k.provider)} · {k.name} ({k.masked_key})
                </option>
              ))}
            </Select>
          </FormField>
        </CardContent>
        <CardFooter className="justify-end bg-bg-subtle">
          <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
            Discard
          </Button>
          <Button type="submit" disabled={!isDirty} loading={isSubmitting}>
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

/**
 * Project overview. The header and pipeline stepper come from ProjectLayout, so this page
 * only adds what the stepper doesn't: the next action, dataset totals, settings and deletion.
 */
export default function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { project, next, exportsCount } = useProjectPipeline(projectId)
  const deleteProject = useDeleteProject()
  const [showDelete, setShowDelete] = useState(false)

  const p = project.data
  if (!p) return <GridSkeleton count={3} />

  const pr = p.pipeline_progress
  const nextDef = STEPS.find((s) => s.key === next.step)!
  const approvalRate = pr.dataset_items > 0 ? Math.round((pr.dataset_items_confirmed / pr.dataset_items) * 100) : 0

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync(projectId)
      toast({ title: 'Project deleted', description: `${p.name} and its data were removed.` })
      navigate('/projects', { replace: true })
    } catch (err) {
      toastError('Could not delete project', err)
    } finally {
      setShowDelete(false)
    }
  }

  return (
    <m.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <m.section variants={fadeUp} className="grid-lines-light flex flex-col gap-5 border border-line bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="grid size-10 shrink-0 place-items-center border border-line bg-bg">
            <nextDef.icon className="size-5 text-fg-secondary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-accent">Up next · {nextDef.label}</p>
            <p className="mt-1 font-display text-lg font-bold tracking-tight">{next.label}</p>
            <p className="mt-0.5 text-sm text-fg-secondary">
              {next.hint} <span className="text-fg-muted">{nextDef.blurb}</span>
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link to={`/projects/${projectId}/${next.step}`} onMouseEnter={() => prefetchPage(stepPageKey[next.step])}>
            {next.label} <ArrowRight />
          </Link>
        </Button>
      </m.section>

      <m.section variants={fadeUp} aria-labelledby="dataset-totals">
        <h2 id="dataset-totals" className="eyebrow mb-3 text-fg">
          Dataset
        </h2>
        <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
          <Metric label="Questions" value={pr.questions} hint={pr.ga_pairs ? `${pr.ga_pairs.toLocaleString()} GA lenses` : 'No GA lenses'} />
          <Metric label="Answers" value={pr.dataset_items} hint={pr.questions ? `${Math.max(0, pr.questions - pr.dataset_items).toLocaleString()} unanswered` : undefined} />
          <Metric label="Approved" value={pr.dataset_items_confirmed} hint={pr.dataset_items ? `${approvalRate}% of answers` : undefined} />
          <Metric label="Exports" value={exportsCount} hint={`Created ${timeAgo(p.created_at)}`} />
        </div>
      </m.section>

      <m.div variants={fadeUp} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SettingsCard project={p} />
        <Card className="h-fit border-danger/30">
          <CardHeader className="border-danger/20">
            <CardTitle className="text-danger">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-fg-secondary">
              Deleting removes every document, chunk, question, answer and export in this project. This can't be undone.
            </p>
            <Button variant="danger-outline" onClick={() => setShowDelete(true)}>
              <Trash2 /> Delete project
            </Button>
          </CardContent>
        </Card>
      </m.div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete project"
        message={`Delete "${p.name}" and all of its data? This can't be undone.`}
        confirmLabel="Delete project"
        variant="destructive"
        loading={deleteProject.isPending}
        onConfirm={() => void handleDelete()}
      />
    </m.div>
  )
}
