import { toast as sonnerToast } from 'sonner'
import { friendlyError } from '@/lib/errors'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function toast({ title, description, variant }: ToastOptions) {
  if (variant === 'destructive') sonnerToast.error(title, { description })
  else sonnerToast.success(title, { description })
}

/** Error toast with a friendly explanation and an optional Retry action. */
export function toastError(title: string, err: unknown, retry?: () => void) {
  const f = friendlyError(err)
  sonnerToast.error(title, {
    description: f.message,
    action: retry ? { label: 'Retry', onClick: retry } : undefined,
  })
}

export { sonnerToast }
