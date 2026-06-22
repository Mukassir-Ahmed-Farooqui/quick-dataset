import { Button } from '@/components/ui/button'

interface PageSizeSelectorProps {
  pageSize: number
  onPageSizeChange: (size: number) => void
}

const SIZES = [10, 25, 50, 100]

export default function PageSizeSelector({ pageSize, onPageSizeChange }: PageSizeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted">Rows per page:</span>
      <div className="flex gap-1">
        {SIZES.map((size) => (
          <Button
            key={size}
            variant={pageSize === size ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageSizeChange(size)}
            className="h-7 min-w-[2.5rem] px-1.5 text-xs"
          >
            {size}
          </Button>
        ))}
      </div>
    </div>
  )
}
