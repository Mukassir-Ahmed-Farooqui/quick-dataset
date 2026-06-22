import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PaginationMeta } from '@/types/api'

interface PaginationProps {
  meta?: PaginationMeta
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ meta, page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = meta?.total_pages ?? Math.max(1, Math.ceil(total / pageSize))

  if (totalPages <= 1) return null

  const pages: (number | 'ellipsis')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={!meta?.has_previous && page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-1 text-xs text-muted">
            &hellip;
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(p)}
            className={cn('h-8 w-8 p-0', p === page && 'pointer-events-none')}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={!meta?.has_next && page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
