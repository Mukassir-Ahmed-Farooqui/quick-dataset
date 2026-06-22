import type { PaginationMeta } from '@/types/api'
import { Pagination } from '@/components/ui/pagination'
import PageSizeSelector from '@/components/common/PageSizeSelector'

interface PaginationControlsProps {
  meta?: PaginationMeta
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function PaginationControls({
  meta,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalItems = meta?.total_items ?? 0
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <div className="text-xs text-muted whitespace-nowrap">
        {totalItems > 0
          ? `Showing ${startItem}–${endItem} of ${totalItems}`
          : 'No results'}
      </div>
      <Pagination
        meta={meta}
        page={page}
        pageSize={pageSize}
        total={totalItems}
        onPageChange={onPageChange}
      />
      <PageSizeSelector pageSize={pageSize} onPageSizeChange={onPageSizeChange} />
    </div>
  )
}
