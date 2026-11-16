import { FileText } from 'lucide-react'
import { Checkbox } from '@/components/ui/input'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DocumentOut } from '@/types/api'

interface DocumentPickerProps {
  docs: DocumentOut[]
  selected: string[]
  onChange: (ids: string[]) => void
  /** Optional per-document note, e.g. "12 chunks". */
  note?: (doc: DocumentOut) => string | undefined
  className?: string
}

/** Checkbox list of parsed documents with a select-all header. */
export default function DocumentPicker({ docs, selected, onChange, note, className }: DocumentPickerProps) {
  const set = new Set(selected)
  const all = docs.length > 0 && docs.every((d) => set.has(d.id))
  const some = !all && docs.some((d) => set.has(d.id))

  const toggle = (id: string) => onChange(set.has(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className={cn('border border-line', className)}>
      <label className="flex cursor-pointer items-center gap-2.5 border-b border-line bg-bg-subtle px-3 py-2">
        <Checkbox
          checked={all}
          indeterminate={some}
          onChange={() => onChange(all ? [] : docs.map((d) => d.id))}
          aria-label="Select all documents"
        />
        <span className="eyebrow text-fg-secondary">Documents</span>
        <span className="num ml-auto text-[11px] text-fg-muted">
          {selected.length}/{docs.length}
        </span>
      </label>
      <ul className="max-h-56 divide-y divide-line-hair overflow-y-auto">
        {docs.map((d) => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-bg-subtle">
              <Checkbox checked={set.has(d.id)} onChange={() => toggle(d.id)} aria-label={`Select ${d.filename}`} />
              <FileText className="size-3.5 shrink-0 text-fg-muted" strokeWidth={1.5} />
              <span className="min-w-0 flex-1 truncate text-sm">{d.filename}</span>
              <span className="shrink-0 font-mono text-[11px] text-fg-muted">{note?.(d) ?? formatBytes(d.file_size)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
