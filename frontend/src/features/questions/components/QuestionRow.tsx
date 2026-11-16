import { memo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import InlineEdit from '@/components/common/InlineEdit'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { QuestionOut } from '@/types/api'

interface QuestionRowProps {
  q: QuestionOut
  index: number
  selected: boolean
  editing: boolean
  saving?: boolean
  chunkLabel?: string
  lensLabel?: string
  onToggle: (id: string, shiftKey: boolean) => void
  onEdit: (id: string | null) => void
  onSave: (id: string, text: string) => void
  onDelete: (q: QuestionOut) => void
}

function QuestionRow({ q, index, selected, editing, saving, chunkLabel, lensLabel, onToggle, onEdit, onSave, onDelete }: QuestionRowProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 border-b border-line-hair px-4 py-3 transition-colors',
        selected ? 'bg-paper/60' : 'hover:bg-bg-subtle',
      )}
    >
      <Checkbox
        className="mt-0.5"
        checked={selected}
        aria-label={`Select question ${index + 1}`}
        onChange={() => undefined}
        onClick={(e) => onToggle(q.id, e.shiftKey)}
      />
      <span className="num mt-px w-8 shrink-0 text-right text-[11px] text-fg-subtle">{index + 1}</span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <InlineEdit
            value={q.question}
            label="Edit question"
            saving={saving}
            onCancel={() => onEdit(null)}
            onSave={(v) => onSave(q.id, v)}
          />
        ) : (
          <>
            <p className="cursor-text text-sm leading-relaxed text-fg" onDoubleClick={() => onEdit(q.id)} title="Double-click to edit">
              {q.question}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-muted">
              <span className={cn('inline-flex items-center gap-1.5', q.answered ? 'text-success' : 'text-fg-muted')}>
                <span className={cn('size-1.5 rounded-full', q.answered ? 'bg-success' : 'border border-line-strong')} />
                {q.answered ? 'answered' : 'unanswered'}
              </span>
              {chunkLabel && <span className="max-w-[40ch] truncate">{chunkLabel}</span>}
              {lensLabel && <span className="max-w-[40ch] truncate">{lensLabel}</span>}
              <span>{timeAgo(q.created_at)}</span>
            </div>
          </>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(q.id)} aria-label="Edit question">
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(q)} aria-label="Delete question" className="hover:text-danger">
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  )
}

export default memo(QuestionRow)
