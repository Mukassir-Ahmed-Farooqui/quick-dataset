import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import FormField from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Select } from '@/components/ui/input'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PasswordInput from '@/features/auth/components/PasswordInput'
import { useCreateProvider } from '@/hooks/useProviders'
import { toast, toastError } from '@/lib/toast'
import type { LLMProvider } from '@/types/api'
import { PROVIDERS } from './providerMeta'

const addKeySchema = z.object({
  provider: z.string().min(1, 'Select a provider'),
  name: z.string().trim().min(1, 'Name is required').max(128),
  api_key: z.string().trim().min(10, 'API key must be at least 10 characters'),
  is_default: z.boolean().optional(),
})

type AddKeyForm = z.infer<typeof addKeySchema>

interface AddKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AddKeyDialog({ open, onOpenChange }: AddKeyDialogProps) {
  const createProvider = useCreateProvider()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddKeyForm>({
    resolver: zodResolver(addKeySchema),
    defaultValues: { provider: '', name: '', api_key: '', is_default: false },
  })
  const provider = useWatch({ control, name: 'provider' })
  const placeholder = PROVIDERS.find((p) => p.value === provider)?.placeholder ?? 'Paste your API key'

  const close = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const onSubmit = async (data: AddKeyForm) => {
    try {
      await createProvider.mutateAsync({
        provider: data.provider as LLMProvider,
        name: data.name.trim(),
        api_key: data.api_key.trim(),
        is_default: data.is_default,
      })
      toast({ title: 'API key added', description: `${data.name} is saved. Test it to confirm it works.` })
      close(false)
    } catch (err) {
      toastError('Could not add key', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Add API key</DialogTitle>
            <DialogDescription>Encrypted at rest. Only the last characters are ever shown.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FormField label="Provider" htmlFor="add-provider" error={errors.provider?.message} required>
              <Select id="add-provider" aria-invalid={!!errors.provider} {...register('provider')}>
                <option value="">Select provider</option>
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Name" htmlFor="add-name" error={errors.name?.message} required>
              <Input id="add-name" placeholder="Personal OpenAI" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField label="API key" htmlFor="add-key" error={errors.api_key?.message} required>
              <PasswordInput id="add-key" autoComplete="off" placeholder={placeholder} aria-invalid={!!errors.api_key} {...register('api_key')} />
            </FormField>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox {...register('is_default')} />
              Use as default key
            </label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
