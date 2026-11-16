import { memo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { GAPairOut } from '@/types/api'
import GAPairEditor, { type GAPairValues } from './GAPairEditor'

interface GAPairRowProps {
  pair: GAPairOut
  filename?: string
  selected: boolean
  editing: boolean
  onToggle: (id: string) => void
  onEdit: (id: string | null) => void
  onSave: (id: string, v: GAPairValues) => void
  onDelete: (pair: GAPairOut) => void
}

function Lens({ label, title, desc }: { label: string; title: string; desc: string | null }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-[10px]">{label}</p>
      <p className="mt-0.5 font-medium">{title}</p>
      {desc && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-fg-secondary">{desc}</p>}
    </div>
  )
}

function GAPairRow({ pair, filename, selected, editing, onToggle, onEdit, onSave, onDelete }: GAPairRowProps) {
  return (
    <li className={cn('group flex gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle', selected && 'bg-accent/5 hover:bg-accent/5')}>
      <Checkbox checked={selected} onChange={() => onToggle(pair.id)} aria-label={`Select ${pair.genre_title} × ${pair.audience_title}`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <GAPairEditor
            idPrefix={pair.id}
            initial={{
              genre_title: pair.genre_title,
              genre_description: pair.genre_description ?? '',
              audience_title: pair.audience_title,
              audience_description: pair.audience_description ?? '',
            }}
            onCancel={() => onEdit(null)}
            onSave={(v) => onSave(pair.id, v)}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
              <Lens label="Genre" title={pair.genre_title} desc={pair.genre_description} />
              <span className="hidden pt-4 font-display text-xs text-fg-subtle sm:block" aria-hidden>
                ×
              </span>
              <Lens label="Audience" title={pair.audience_title} desc={pair.audience_description} />
            </div>
            {filename && <p className="mt-2 truncate font-mono text-[11px] text-fg-muted">{filename}</p>}
          </>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
          <Tooltip content="Edit">
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(pair.id)} aria-label="Edit pair">
              <Pencil />
            </Button>
          </Tooltip>
          <Tooltip content="Delete">
            <Button variant="ghost" size="icon-sm" onClick={() => onDelete(pair)} aria-label="Delete pair" className="hover:text-danger">
              <Trash2 />
            </Button>
          </Tooltip>
        </div>
      )}
    </li>
  )
}

export default memo(GAPairRow)
