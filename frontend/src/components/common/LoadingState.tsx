import { Skeleton } from '@/components/ui/skeleton'

interface LoadingStateProps {
  count?: number
}

export default function LoadingState({ count = 3 }: LoadingStateProps) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Cards */}
      <div className="grid grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border border-card-border rounded-lg p-6 space-y-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}
