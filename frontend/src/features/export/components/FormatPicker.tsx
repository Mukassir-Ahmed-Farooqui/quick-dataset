import { cn } from '@/lib/utils'
import { FORMATS, type ExportType } from './formats'

export default function FormatPicker({ value, onChange }: { value: ExportType; onChange: (t: ExportType) => void }) {
  return (
    <div role="radiogroup" aria-label="Export format" className="grid grid-cols-2 gap-px border border-line bg-line">
      {FORMATS.map((f) => {
        const on = f.value === value
        return (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(f.value)}
            className={cn('relative flex flex-col items-start gap-1 p-3 text-left transition-colors', on ? 'bg-paper' : 'bg-bg hover:bg-bg-subtle')}
          >
            {on && <span className="absolute inset-x-0 top-0 h-0.5 bg-fg" aria-hidden />}
            <span className="flex w-full items-center justify-between">
              <span className="font-display text-sm font-bold text-fg">{f.label}</span>
              <span className="font-mono text-[10.5px] text-fg-muted">.{f.ext}</span>
            </span>
            <span className="text-xs leading-snug text-fg-secondary">{f.blurb}</span>
            <span className="mt-1 font-mono text-[10.5px] text-fg-subtle">{f.shape}</span>
          </button>
        )
      })}
    </div>
  )
}
