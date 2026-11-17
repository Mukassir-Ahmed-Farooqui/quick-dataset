import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import FormField from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/input'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PasswordInput from '@/features/auth/components/PasswordInput'
import { useUpdateProvider } from '@/hooks/useProviders'
import { toast, toastError } from '@/lib/toast'
import type { LLMKeyOut, LLMKeyUpdate } from '@/types/api'
import { providerLabel } from './providerMeta'

const editKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(128),
  api_key: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length >= 10, { message: 'API key must be at least 10 characters' }),
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditKeyForm>({
    resolver: zodResolver(editKeySchema),
    defaultValues: { name: '', api_key: '', is_default: false },
  })

  // Load the key's current values each time the dialog opens; the key field always starts blank.
  useEffect(() => {
    if (keyData && open) reset({ name: keyData.name, api_key: '', is_default: keyData.is_default })
  }, [keyData, open, reset])

  const onSubmit = async (data: EditKeyForm) => {
    if (!keyData) return
    const payload: LLMKeyUpdate = { name: data.name.trim(), is_default: data.is_default }
    if (data.api_key?.trim()) payload.api_key = data.api_key.trim()
    try {
      await updateProvider.mutateAsync({ id: keyData.id, data: payload })
      toast({ title: 'API key updated', description: payload.api_key ? 'Test it again to confirm the new key works.' : `${payload.name} saved.` })
      onOpenChange(false)
    } catch (err) {
      toastError('Could not update key', err)
    }
  }

  if (!keyData) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Edit API key</DialogTitle>
            <DialogDescription>Rename it, change the default, or replace the key value.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FormField label="Provider" hint="The provider can't be changed. Add a new key instead.">
              <Input value={providerLabel(keyData.provider)} disabled readOnly />
            </FormField>
            <FormField label="Name" htmlFor="edit-name" error={errors.name?.message} required>
              <Input id="edit-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField
              label="Replace key"
              htmlFor="edit-key"
              error={errors.api_key?.message}
              hint={
                <>
                  Current: <span className="font-mono">{keyData.masked_key}</span>. Leave blank to keep it.
                </>
              }
            >
              <PasswordInput id="edit-key" autoComplete="off" placeholder="Leave blank to keep current key" aria-invalid={!!errors.api_key} {...register('api_key')} />
            </FormField>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox {...register('is_default')} />
              Use as default key
            </label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
