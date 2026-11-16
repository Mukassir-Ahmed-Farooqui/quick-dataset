import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PaginationMeta } from '@/types/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PaginationControlsProps {
  meta?: PaginationMeta
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  sizes?: number[]
  className?: string
}

export default function PaginationControls({ meta, page, pageSize, onPageChange, onPageSizeChange, sizes = [50, 100, 200], className }: PaginationControlsProps) {
  const total = meta?.total_items ?? 0
  const totalPages = meta?.total_pages ?? 1
  if (total === 0) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-fg-muted', className)}>
      <span className="num">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 border border-line bg-bg px-1.5 font-display text-[11px] text-fg focus:border-fg focus:outline-none"
              aria-label="Rows per page"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="num min-w-14 text-center text-fg">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
