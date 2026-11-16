import { Skeleton } from '@/components/ui/skeleton'

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line-hair border border-line" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-4" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 bg-bg p-5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      ))}
    </div>
  )
}

export default function LoadingState({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading">
      <div className="space-y-3 border-b border-line pb-5">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </div>
      <GridSkeleton count={count} />
      <ListSkeleton rows={4} />
    </div>
  )
}
