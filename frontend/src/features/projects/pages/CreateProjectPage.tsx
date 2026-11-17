import { Link, useNavigate } from 'react-router-dom'
import { m } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Plug } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import FormField from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateProject } from '@/hooks/useProjects'
import { useProviders } from '@/hooks/useProviders'
import { toast, toastError } from '@/lib/toast'
import { fadeUp } from '@/lib/animations'
import { STEPS } from '@/lib/pipeline'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(255),
  description: z.string().optional(),
  default_llm_key_id: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>

const providerLabel: Record<string, string> = { openai: 'OpenAI', openrouter: 'OpenRouter', groq: 'Groq', gemini: 'Gemini' }

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const createProject = useCreateProject()
  const providers = useProviders()
  const keys = providers.data?.items ?? []
  const defaultKey = keys.find((k) => k.is_default)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    values: { name: '', description: '', default_llm_key_id: defaultKey?.id ?? '' },
    resetOptions: { keepDirtyValues: true },
  })

  const onSubmit = async (data: CreateForm) => {
    try {
      const project = await createProject.mutateAsync({
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        default_llm_key_id: data.default_llm_key_id || undefined,
      })
      toast({ title: 'Project created', description: `${project.name} is ready for documents.` })
      navigate(`/projects/${project.id}/documents`, { replace: true })
    } catch (err) {
      toastError('Could not create project', err, () => void handleSubmit(onSubmit)())
    }
  }

  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        eyebrow="Projects / New"
        title="New project"
        description="Name it, optionally pick the LLM key it should use, and you'll go straight to uploading documents."
        action={
          <Button asChild variant="outline">
            <Link to="/projects">
              <ArrowLeft /> Back
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Card>
            <CardHeader>
              <CardTitle>Project details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField label="Name" htmlFor="name" error={errors.name?.message} required>
                <Input id="name" autoFocus placeholder="Support docs QA" aria-invalid={!!errors.name} {...register('name')} />
              </FormField>

              <FormField label="Description" htmlFor="description" hint="Optional. What is this dataset for?">
                <Textarea id="description" rows={3} placeholder="Grounded Q&A pairs from the 2026 support handbook…" {...register('description')} />
              </FormField>

              <FormField
                label="Default LLM key"
                htmlFor="default_llm_key_id"
                hint={
                  keys.length === 0 && !providers.isLoading ? (
                    <>
                      No keys yet.{' '}
                      <Link to="/providers" className="text-fg underline underline-offset-4">
                        Add one
                      </Link>{' '}
                      now or set it later.
                    </>
                  ) : (
                    'Used for questions and answers unless you pick another at generation time.'
                  )
                }
              >
                <Select id="default_llm_key_id" disabled={providers.isLoading} {...register('default_llm_key_id')}>
                  <option value="">None (set later)</option>
                  {keys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {providerLabel[k.provider] ?? k.provider} · {k.name} ({k.masked_key}){k.is_default ? ' · default' : ''}
                    </option>
                  ))}
                </Select>
              </FormField>
            </CardContent>
            <CardFooter className="justify-end bg-bg-subtle">
              <Button type="button" variant="ghost" onClick={() => navigate('/projects')}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create project'}
                {!isSubmitting && <ArrowRight />}
              </Button>
            </CardFooter>
          </Card>
        </form>

        <aside className="space-y-4">
          <Card className="bg-paper">
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <ol className="divide-y divide-line-hair">
              {STEPS.map((s, i) => (
                <li key={s.key} className="flex gap-3 px-4 py-2.5">
                  <span className="num pt-0.5 text-[11px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="font-display text-xs font-bold">
                      {s.label}
                      {s.optional && <span className="ml-1 font-sans font-normal text-fg-subtle">opt.</span>}
                    </p>
                    <p className="text-xs text-fg-secondary">{s.blurb}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          {keys.length === 0 && !providers.isLoading && (
            <div className="flex items-start gap-3 border border-dashed border-line-strong p-4 text-xs text-fg-secondary">
              <Plug className="mt-0.5 size-4 shrink-0 text-fg-muted" strokeWidth={1.5} />
              <p>Uploading and chunking work without a key. You'll need one from step 3 onwards.</p>
            </div>
          )}
        </aside>
      </div>
    </m.div>
  )
}
