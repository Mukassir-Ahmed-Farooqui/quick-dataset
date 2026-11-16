import { memo, useState } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import InlineEdit from '@/components/common/InlineEdit'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ChunkOut } from '@/types/api'

interface ChunkRowProps {
  chunk: ChunkOut
  filename?: string
  selected: boolean
  editing: boolean
  saving: boolean
  onToggle: (id: string) => void
  onEdit: (id: string | null) => void
  onSave: (id: string, content: string) => void
  onDelete: (chunk: ChunkOut) => void
}

function ChunkRow({ chunk, filename, selected, editing, saving, onToggle, onEdit, onSave, onDelete }: ChunkRowProps) {
  const [expanded, setExpanded] = useState(false)
  const long = chunk.content.length > 360

  return (
    <li className={cn('group flex gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle', selected && 'bg-accent/5 hover:bg-accent/5')}>
      <Checkbox checked={selected} onChange={() => onToggle(chunk.id)} aria-label={`Select chunk ${chunk.chunk_index}`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-muted">
          <span className="text-fg">#{chunk.chunk_index}</span>
          <span>{chunk.token_count.toLocaleString()} tokens</span>
          {filename && <span className="truncate">{filename}</span>}
        </div>
        {editing ? (
          <InlineEdit value={chunk.content} rows={8} label={`Edit chunk ${chunk.chunk_index}`} saving={saving} onCancel={() => onEdit(null)} onSave={(v) => onSave(chunk.id, v)} />
        ) : (
          <>
            <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', !expanded && 'line-clamp-4')}>{chunk.content}</p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 inline-flex items-center gap-1 font-display text-[11px] text-fg-muted hover:text-fg"
                aria-expanded={expanded}
              >
                <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
                {expanded ? 'Show less' : 'Show all'}
              </button>
            )}
          </>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
          <Tooltip content="Edit">
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(chunk.id)} aria-label={`Edit chunk ${chunk.chunk_index}`}>
              <Pencil />
            </Button>
          </Tooltip>
          <Tooltip content="Delete">
            <Button variant="ghost" size="icon-sm" onClick={() => onDelete(chunk)} aria-label={`Delete chunk ${chunk.chunk_index}`} className="hover:text-danger">
              <Trash2 />
            </Button>
          </Tooltip>
        </div>
      )}
    </li>
  )
}

export default memo(ChunkRow)
