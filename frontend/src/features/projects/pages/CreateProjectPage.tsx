import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import FormField from '@/components/forms/FormField'
import { useCreateProject } from '@/hooks/useProjects'
import { useProviders } from '@/hooks/useProviders'
import { toast } from '@/lib/toast'
import { fadeUp } from '@/lib/animations'

const createSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  description: z.string().optional(),
  default_llm_key_id: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const createProject = useCreateProject()
  const { data: providersData } = useProviders()
  const keys = providersData?.items ?? []

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (data: CreateForm) => {
    setIsSubmitting(true)
    try {
      const project = await createProject.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        default_llm_key_id: data.default_llm_key_id || undefined,
      })
      toast({ title: 'Project created', description: `${project.name} is ready.` })
      navigate(`/projects/${project.id}`, { replace: true })
    } catch (err) {
      toast({
        title: 'Failed to create project',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        title="New Project"
        description="Create a new dataset project."
        action={
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <div className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField label="Project name" error={errors.name?.message} required>
            <input
              type="text"
              placeholder="My RAG Dataset"
              {...register('name')}
              className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink placeholder:text-muted
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                transition-colors"
            />
          </FormField>

          <FormField label="Description" error={errors.description?.message} hint="Optional. What is this project for?">
            <textarea
              placeholder="Brief description of your dataset project..."
              rows={3}
              {...register('description')}
              className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink placeholder:text-muted resize-none
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                transition-colors"
            />
          </FormField>

          <FormField label="Default LLM Key" error={errors.default_llm_key_id?.message} hint="Optional. Select a provider key for generation.">
            <select
              {...register('default_llm_key_id')}
              className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                transition-colors bg-white"
            >
              <option value="">None (set later)</option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.provider} — {k.name} ({k.masked_key})
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? 'Creating\u2026' : 'Create Project'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  )
}
