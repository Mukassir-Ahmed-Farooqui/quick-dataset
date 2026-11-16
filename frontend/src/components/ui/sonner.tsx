import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/lib/theme'

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster(props: ToasterProps) {
  const { resolved } = useTheme()
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      gap={8}
      offset={16}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'group flex w-[356px] items-start gap-3 border border-line bg-bg p-3 pr-8 text-sm text-fg shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]',
          title: 'font-display text-xs font-bold tracking-tight',
          description: 'mt-0.5 text-xs text-fg-secondary',
          icon: 'mt-0.5 [&_svg]:size-4',
          success: '[&_[data-icon]]:text-success',
          error: 'border-l-2 border-l-danger [&_[data-icon]]:text-danger',
          info: '[&_[data-icon]]:text-accent',
          actionButton:
            'ml-auto shrink-0 self-center border border-primary bg-primary px-2.5 py-1 font-display text-[11px] font-bold text-primary-foreground hover:bg-primary/85',
          cancelButton: 'ml-auto shrink-0 self-center border border-line px-2.5 py-1 font-display text-[11px]',
          closeButton: 'absolute right-1.5 top-1.5 border-0 bg-transparent text-fg-muted hover:text-fg',
        },
      }}
      closeButton
      {...props}
    />
  )
}
