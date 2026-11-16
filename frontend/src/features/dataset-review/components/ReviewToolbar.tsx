import { X } from 'lucide-react'
import { Input, Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { EMPTY_REVIEW_FILTERS, type ReviewFilters, type ReviewStatus } from './payload'

const STATUSES: Array<{ value: ReviewStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
]

export default function ReviewToolbar({ value, onChange }: { value: ReviewFilters; onChange: (f: ReviewFilters) => void }) {
  const active = value.status || value.type || value.minScore
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex border border-line" role="radiogroup" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s.value || 'all'}
            type="button"
            role="radio"
            aria-checked={value.status === s.value}
            onClick={() => onChange({ ...value, status: s.value })}
            className={cn(
              'h-8 border-r border-line px-3 font-display text-[11px] font-bold uppercase tracking-wider last:border-r-0 transition-colors',
              value.status === s.value ? 'bg-primary text-primary-foreground' : 'bg-bg text-fg-secondary hover:bg-bg-subtle',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as ReviewFilters['type'] })} aria-label="Dataset type" className="h-8 w-36 text-xs">
        <option value="">All types</option>
        <option value="qa">QA</option>
        <option value="mcq">MCQ</option>
        <option value="classification">Classification</option>
        <option value="conversation">Conversation</option>
      </Select>
      <label className="flex h-8 items-center gap-2 border border-line pl-3 text-xs">
        <span className="eyebrow text-[9.5px]">Min score</span>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.05}
          placeholder="0.00"
          value={value.minScore}
          onChange={(e) => onChange({ ...value, minScore: e.target.value })}
          className="h-[30px] w-20 border-0 border-l border-line font-mono text-xs"
        />
      </label>
      {active && (
        <button type="button" onClick={() => onChange(EMPTY_REVIEW_FILTERS)} className="inline-flex items-center gap-1 font-display text-[11px] text-fg-muted hover:text-fg">
          <X className="size-3" /> Clear
        </button>
      )}
    </div>
  )
}
