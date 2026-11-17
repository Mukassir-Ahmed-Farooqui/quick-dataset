import { useState } from 'react'
import { Check, X } from 'lucide-react'
import FormField from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import type { GAPairUpdate } from '@/types/api'

export interface GAPairValues {
  genre_title: string
  genre_description: string
  audience_title: string
  audience_description: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const toUpdate = (v: GAPairValues): GAPairUpdate => ({
  genre_title: v.genre_title.trim(),
  genre_description: v.genre_description.trim() || undefined,
  audience_title: v.audience_title.trim(),
  audience_description: v.audience_description.trim() || undefined,
})

/** Four-field editor. ⌘/Ctrl+Enter saves, Esc cancels. */
export default function GAPairEditor({
  initial,
  onSave,
  onCancel,
  saving,
  submitLabel = 'Save',
  idPrefix,
}: {
  initial: GAPairValues
  onSave: (v: GAPairValues) => void
  onCancel: () => void
  saving?: boolean
  submitLabel?: string
  idPrefix: string
}) {
  const [v, setV] = useState(initial)
  const valid = v.genre_title.trim() !== '' && v.audience_title.trim() !== ''
  const set = (k: keyof GAPairValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && valid) {
          e.preventDefault()
          onSave(v)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <FormField label="Genre" htmlFor={`${idPrefix}-gt`} required>
            <Input id={`${idPrefix}-gt`} value={v.genre_title} onChange={set('genre_title')} autoFocus placeholder="e.g. Technical tutorial" />
          </FormField>
          <Textarea aria-label="Genre description" value={v.genre_description} onChange={set('genre_description')} rows={2} placeholder="Description (optional)" className="min-h-[60px]" />
        </div>
        <div className="space-y-2">
          <FormField label="Audience" htmlFor={`${idPrefix}-at`} required>
            <Input id={`${idPrefix}-at`} value={v.audience_title} onChange={set('audience_title')} placeholder="e.g. New engineers" />
          </FormField>
          <Textarea aria-label="Audience description" value={v.audience_description} onChange={set('audience_description')} rows={2} placeholder="Description (optional)" className="min-h-[60px]" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
          <X /> Cancel
        </Button>
        <Button type="submit" size="xs" loading={saving} disabled={!valid}>
          <Check /> {submitLabel}
        </Button>
      </div>
    </form>
  )
}
