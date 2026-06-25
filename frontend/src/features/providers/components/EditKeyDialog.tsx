import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import FormField from '@/components/forms/FormField'
import { useUpdateProvider } from '@/hooks/useProviders'
import { toast } from '@/lib/toast'
import { fadeUp } from '@/lib/animations'
import type { LLMKeyOut } from '@/types/api'

const editKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  api_key: z.string().optional().refine(val => !val || val.length >= 10, {
    message: 'API key must be at least 10 characters',
  }),
  is_default: z.boolean().optional(),
})

type EditKeyForm = z.infer<typeof editKeySchema>

interface EditKeyDialogProps {
  keyData: LLMKeyOut | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EditKeyDialog({ keyData, open, onOpenChange }: EditKeyDialogProps) {
  const updateProvider = useUpdateProvider()
  const [showKey, setShowKey] = useState(false)
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditKeyForm>({
    resolver: zodResolver(editKeySchema),
    defaultValues: {
      name: '',
      api_key: '',
      is_default: false,
    },
  })

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (keyData && open) {
      reset({
        name: keyData.name,
        api_key: '', // Always start blank
        is_default: keyData.is_default,
      })
      setShowKey(false)
    }
  }, [keyData, open, reset])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (data: EditKeyForm) => {
    if (!keyData) return
    setIsSubmitting(true)
    try {
      const payload: any = {
        name: data.name,
        is_default: data.is_default,
      }
      if (data.api_key && data.api_key.trim() !== '') {
        payload.api_key = data.api_key.trim()
      }
      
      await updateProvider.mutateAsync({
        id: keyData.id,
        data: payload,
      })
      toast({ title: 'API key updated', description: `${data.name} has been updated.` })
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Failed to update key',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!keyData) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md bg-white rounded-xl border border-hairline shadow-xl p-6">
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <Dialog.Title className="text-lg font-semibold text-ink tracking-tight">
              Edit API Key
            </Dialog.Title>
            <Dialog.Description className="text-sm text-body-muted mt-1 mb-6">
              Update name, default status, or replace the key value.
            </Dialog.Description>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField label="Provider" required>
                <input
                  type="text"
                  value={keyData.provider}
                  disabled
                  className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-muted bg-stone/50 cursor-not-allowed"
                />
                <p className="text-xs text-muted mt-1">Provider cannot be changed. Create a new key instead.</p>
              </FormField>

              <FormField label="Name" error={errors.name?.message} required>
                <input
                  type="text"
                  {...register('name')}
                  className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink placeholder:text-muted
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                    transition-colors"
                />
              </FormField>

              <FormField label="API Key (Optional)" error={errors.api_key?.message}>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="Leave blank to keep current key"
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
                <p className="text-xs text-muted mt-1">Providing a new key will require testing it again.</p>
              </FormField>

              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer pt-2">
                <input
                  type="checkbox"
                  {...register('is_default')}
                  className="rounded border-hairline text-action focus:ring-action"
                />
                Set as default key
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-ink text-white rounded-pill px-6 py-2.5 text-sm font-medium
                    hover:bg-ink/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Saving\u2026' : 'Save Changes'}
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
