import { forwardRef } from 'react'
import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import type { DocumentOut, GAPairOut } from '@/types/api'
import { EMPTY_FILTERS, type QuestionFilters } from './filters'


interface Props {
  value: QuestionFilters
  onChange: (next: QuestionFilters) => void
  docs: DocumentOut[]
  gaPairs: GAPairOut[]
}

const QuestionToolbar = forwardRef<HTMLInputElement, Props>(function QuestionToolbar({ value, onChange, docs, gaPairs }, searchRef) {
  const set = <K extends keyof QuestionFilters>(k: K, v: QuestionFilters[K]) => onChange({ ...value, [k]: v })
  const active = value.status || value.documentId || value.gaPairId || value.search

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
        <Input
          ref={searchRef}
          type="search"
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Search questions"
          aria-label="Search questions"
          className="pl-8 pr-10"
        />
        <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:flex">
        <Select value={value.status} onChange={(e) => set('status', e.target.value as QuestionFilters['status'])} aria-label="Status" className="lg:w-36">
          <option value="">All status</option>
          <option value="unanswered">Unanswered</option>
          <option value="answered">Answered</option>
        </Select>
        <Select value={value.documentId} onChange={(e) => set('documentId', e.target.value)} aria-label="Document" className="lg:w-44">
          <option value="">All documents</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </Select>
        <Select value={value.gaPairId} onChange={(e) => set('gaPairId', e.target.value)} aria-label="GA pair" className="lg:w-44">
          <option value="">All lenses</option>
          {gaPairs.map((g) => (
            <option key={g.id} value={g.id}>
              {g.genre_title} · {g.audience_title}
            </option>
          ))}
        </Select>
      </div>
      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1 self-start font-display text-[11px] text-fg-muted hover:text-fg lg:self-center"
        >
          <X className="size-3" /> Clear
        </button>
      )}
    </div>
  )
})

export default QuestionToolbar
