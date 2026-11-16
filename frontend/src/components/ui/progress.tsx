import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number | null // 0..100, null = indeterminate
  tone?: 'accent' | 'success' | 'danger' | 'fg'
  className?: string
  label?: string
}

const tones = { accent: 'bg-accent', success: 'bg-success', danger: 'bg-danger', fg: 'bg-fg' }

export function Progress({ value, tone = 'accent', className, label }: ProgressProps) {
  const indeterminate = value === null
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      className={cn('relative h-1.5 w-full overflow-hidden bg-bg-muted', className)}
    >
      <div
        className={cn(
          'h-full transition-[width] duration-500 ease-out',
          tones[tone],
          indeterminate && 'w-1/3 animate-progress-stripe bg-[length:24px_100%] bg-[linear-gradient(45deg,rgb(255_255_255/0.25)_25%,transparent_25%,transparent_50%,rgb(255_255_255/0.25)_50%,rgb(255_255_255/0.25)_75%,transparent_75%)]',
        )}
        style={indeterminate ? undefined : { width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  )
}
