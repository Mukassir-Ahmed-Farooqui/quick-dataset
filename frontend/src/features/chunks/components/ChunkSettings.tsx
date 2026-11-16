import Collapsible from '@/components/common/Collapsible'
import FormField from '@/components/common/FormField'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { STRATEGIES, type ChunkConfig } from './chunkConfig'

/** Strategy / size / overlap, tucked away behind "Advanced options" since defaults suit most documents. */
export default function ChunkSettings({ value, onChange, error }: { value: ChunkConfig; onChange: (c: ChunkConfig) => void; error: string | null }) {
  const strategyLabel = STRATEGIES.find((s) => s.value === value.strategy)?.label ?? value.strategy
  return (
    <Collapsible hint={`${strategyLabel} · ${value.chunkSize} size · ${value.chunkOverlap} overlap`} defaultOpen={!!error}>
      <div className="space-y-4">
        <fieldset>
          <legend className="eyebrow mb-1.5 text-fg-secondary">Strategy</legend>
          <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
            {STRATEGIES.map((s) => (
              <label
                key={s.value}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 bg-bg p-3 transition-colors hover:bg-bg-subtle has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-fg',
                  value.strategy === s.value && 'bg-paper hover:bg-paper',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="chunk-strategy"
                    className="qd-radio"
                    checked={value.strategy === s.value}
                    onChange={() => onChange({ ...value, strategy: s.value })}
                  />
                  <span className="font-display text-xs font-bold">{s.label}</span>
                </span>
                <span className="text-xs leading-relaxed text-fg-muted">{s.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Chunk size" htmlFor="chunk-size" hint={value.strategy === 'token' ? 'Tokens per chunk' : 'Characters per chunk'}>
            <Input
              id="chunk-size"
              type="number"
              inputMode="numeric"
              min={50}
              max={8000}
              step={50}
              value={Number.isFinite(value.chunkSize) ? value.chunkSize : ''}
              onChange={(e) => onChange({ ...value, chunkSize: e.target.valueAsNumber })}
              aria-invalid={!!error}
              className="font-mono"
            />
          </FormField>
          <FormField label="Overlap" htmlFor="chunk-overlap" hint="Shared between neighbours">
            <Input
              id="chunk-overlap"
              type="number"
              inputMode="numeric"
              min={0}
              max={2000}
              step={10}
              value={Number.isFinite(value.chunkOverlap) ? value.chunkOverlap : ''}
              onChange={(e) => onChange({ ...value, chunkOverlap: e.target.valueAsNumber })}
              aria-invalid={!!error}
              className="font-mono"
            />
          </FormField>
        </div>
        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Collapsible>
  )
}
