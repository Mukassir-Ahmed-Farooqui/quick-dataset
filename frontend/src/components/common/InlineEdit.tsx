import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'

/** Textarea editor: ⌘/Ctrl+Enter saves, Esc cancels. */
export default function InlineEdit({
  value,
  onSave,
  onCancel,
  saving,
  rows = 3,
  label,
}: {
  value: string
  onSave: (v: string) => void
  onCancel: () => void
  saving?: boolean
  rows?: number
  label?: string
}) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const save = () => {
    const v = draft.trim()
    if (!v || v === value) return onCancel()
    onSave(v)
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Textarea
        ref={ref}
        aria-label={label ?? 'Edit text'}
        value={draft}
        rows={rows}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            save()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onCancel()
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto hidden items-center gap-1 text-[11px] text-fg-muted sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd> save · <Kbd>esc</Kbd> cancel
        </span>
        <Button variant="ghost" size="xs" onClick={onCancel}>
          <X /> Cancel
        </Button>
        <Button size="xs" onClick={save} loading={saving}>
          <Check /> Save
        </Button>
      </div>
    </div>
  )
}
