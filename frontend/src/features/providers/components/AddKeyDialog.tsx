import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import FormField from '@/components/forms/FormField'
import { useCreateProvider } from '@/hooks/useProviders'
import { toast } from '@/lib/toast'
import { fadeUp } from '@/lib/animations'
import type { LLMProvider } from '@/types/api'

const providers: { value: LLMProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'groq', label: 'Groq' },
  { value: 'gemini', label: 'Gemini' },
]

const addKeySchema = z.object({
  provider: z.string().min(1, 'Select a provider'),
  name: z.string().min(1, 'Name is required').max(128),
  api_key: z.string().min(10, 'API key must be at least 10 characters'),
  is_default: z.boolean().optional(),
})

type AddKeyForm = z.infer<typeof addKeySchema>

interface AddKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AddKeyDialog({ open, onOpenChange }: AddKeyDialogProps) {
  const createProvider = useCreateProvider()
  const [showKey, setShowKey] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddKeyForm>({
    resolver: zodResolver(addKeySchema),
    defaultValues: { is_default: false },
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (data: AddKeyForm) => {
    setIsSubmitting(true)
    try {
      await createProvider.mutateAsync({
        provider: data.provider as LLMProvider,
        name: data.name,
        api_key: data.api_key,
        is_default: data.is_default,
      })
      toast({ title: 'API key added', description: `${data.name} has been saved.` })
      reset()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Failed to add key',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md bg-white rounded-xl border border-hairline shadow-xl p-6">
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <Dialog.Title className="text-lg font-semibold text-ink tracking-tight">
              Add API Key
            </Dialog.Title>
            <Dialog.Description className="text-sm text-body-muted mt-1 mb-6">
              Your key is encrypted at rest and never exposed.
            </Dialog.Description>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField label="Provider" error={errors.provider?.message} required>
                <select
                  {...register('provider')}
                  className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                    transition-colors bg-white"
                >
                  <option value="">Select provider</option>
                  {providers.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Name" error={errors.name?.message} required>
                <input
                  type="text"
                  placeholder="My OpenAI Key"
                  {...register('name')}
                  className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink placeholder:text-muted
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                    transition-colors"
                />
              </FormField>

              <FormField label="API Key" error={errors.api_key?.message} required>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    {...register('api_key')}
                    className="w-full border border-hairline rounded-md px-4 py-2.5 pr-10 text-sm text-ink placeholder:text-muted
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                      transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  {...register('is_default')}
                  className="rounded border-hairline text-action focus:ring-action"
                />
                Set as default key
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-ink text-white rounded-pill px-6 py-2.5 text-sm font-medium
                    hover:bg-ink/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Adding\u2026' : 'Add Key'}
                </button>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="border border-hairline text-ink rounded-pill px-6 py-2.5 text-sm font-medium
                      hover:bg-stone transition-colors"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
              </div>
            </form>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
