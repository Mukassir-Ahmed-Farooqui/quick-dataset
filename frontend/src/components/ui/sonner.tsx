import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-ink group-[.toaster]:border-hairline group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-body-muted text-sm',
          actionButton: 'group-[.toast]:bg-action group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-stone group-[.toast]:text-body-muted',
          success: 'group-[.toaster]:border-l-4 group-[.toaster]:border-l-success',
          error: 'group-[.toaster]:border-l-4 group-[.toaster]:border-l-error',
        },
      }}
      position="bottom-right"
      richColors
      closeButton
      {...props}
    />
  )
}
