import { memo } from 'react'
import { Checkbox } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { DatasetItemOut } from '@/types/api'
import ScoreMeter from './ScoreMeter'
import { promptOf } from './payload'

interface ReviewRowProps {
  item: DatasetItemOut
  index: number
  active: boolean
  selected: boolean
  onActivate: (id: string) => void
  onToggle: (id: string, shiftKey: boolean) => void
}

function ReviewRow({ item, index, active, selected, onActivate, onToggle }: ReviewRowProps) {
  return (
    <div
      onClick={() => onActivate(item.id)}
      aria-current={active || undefined}
      className={cn(
        'relative flex cursor-pointer items-start gap-2.5 border-b border-line-hair py-2.5 pl-3 pr-3 transition-colors',
        active ? 'bg-paper' : selected ? 'bg-paper/50' : 'hover:bg-bg-subtle',
      )}
    >
      {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-fg" aria-hidden />}
      <Checkbox
        className="mt-0.5"
        checked={selected}
        aria-label={`Select item ${index + 1}`}
        onChange={() => undefined}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(item.id, e.shiftKey)
        }}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('line-clamp-2 text-[13px] leading-snug', active ? 'text-fg' : 'text-fg-secondary')}>{promptOf(item) || '—'}</p>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-fg-muted">
          <span className={cn('inline-flex items-center gap-1', item.confirmed ? 'text-success' : 'text-fg-muted')}>
            <span className={cn('size-1.5 rounded-full', item.confirmed ? 'bg-success' : 'border border-line-strong')} />
            {item.confirmed ? 'approved' : 'pending'}
          </span>
          <span className="uppercase">{item.dataset_type}</span>
          {item.source_document_filename && <span className="min-w-0 truncate">{item.source_document_filename}</span>}
        </div>
      </div>
      <ScoreMeter score={item.score} compact className="mt-0.5 shrink-0" />
    </div>
  )
}

export default memo(ReviewRow)
