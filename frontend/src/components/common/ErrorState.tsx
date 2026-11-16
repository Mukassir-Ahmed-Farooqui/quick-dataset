import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { friendlyError } from '@/lib/errors'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  message?: string
  error?: unknown
  onRetry?: () => void
  compact?: boolean
  className?: string
}

export default function ErrorState({ message, error, onRetry, compact, className }: ErrorStateProps) {
  const f = friendlyError(error ?? new Error(message))
  return (
    <div
      role="alert"
      className={cn(
        'flex border border-danger/30 bg-danger/[0.04]',
        compact ? 'items-center gap-3 px-4 py-3' : 'flex-col items-center px-6 py-12 text-center',
        className,
      )}
    >
      <AlertTriangle className={cn('shrink-0 text-danger', compact ? 'size-4' : 'mb-4 size-6')} strokeWidth={1.5} />
      <div className={cn('min-w-0', compact && 'flex-1')}>
        <p className="font-display text-sm font-bold text-fg">{f.title}</p>
        <p className="mt-1 text-sm text-fg-secondary">{message || f.message}</p>
        {f.detail && f.detail !== f.message && !compact && (
          <p className="mt-2 max-w-md truncate font-mono text-[11px] text-fg-muted" title={f.detail}>
            {f.detail}
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size={compact ? 'sm' : 'default'} onClick={onRetry} className={compact ? '' : 'mt-5'}>
          <RotateCw /> Retry
        </Button>
      )}
    </div>
  )
}
