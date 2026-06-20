import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center py-12">
      <div className="bg-coral-soft/10 rounded-xl p-4 mb-4">
        <AlertTriangle className="h-6 w-6 text-coral" />
      </div>
      <h3 className="text-base font-medium text-ink mb-1">Error</h3>
      <p className="text-sm text-body-muted max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
