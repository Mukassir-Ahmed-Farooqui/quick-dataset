import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'

interface ErrorStateProps {
  message?: string
  error?: Error | ApiError | null
  onRetry?: () => void
}

export default function ErrorState({
  message,
  error,
  onRetry,
}: ErrorStateProps) {
  const displayMessage = message || error?.message || 'Something went wrong. Please try again.'
  const status = error instanceof ApiError ? error.status : (error as any)?.status
  const endpoint = error instanceof ApiError ? error.endpoint : (error as any)?.endpoint

  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center py-12 px-4">
      <div className="bg-coral-soft/10 rounded-xl p-4 mb-4">
        <AlertTriangle className="h-6 w-6 text-coral" />
      </div>
      <h3 className="text-base font-medium text-ink mb-1">
        Error {status ? `(${status})` : ''}
      </h3>
      <p className="text-sm text-body-muted max-w-md mb-2">{displayMessage}</p>
      {endpoint && (
        <p className="text-xs text-muted mb-6 font-mono truncate max-w-sm" title={endpoint}>
          {endpoint}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
