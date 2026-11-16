import { cn } from '@/lib/utils'
import { scoreTone } from './payload'

const bar = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', none: 'bg-line' }
const text = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', none: 'text-fg-subtle' }

/** Quality score 0–1 as a hairline meter + number. */
export default function ScoreMeter({ score, compact, className }: { score: number | null; compact?: boolean; className?: string }) {
  const tone = scoreTone(score)
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={score == null ? 'Not scored' : `Quality score ${score.toFixed(2)}`}>
      {!compact && (
        <span className="relative h-1 w-12 bg-bg-muted" aria-hidden>
          <span className={cn('absolute inset-y-0 left-0', bar[tone])} style={{ width: `${Math.round((score ?? 0) * 100)}%` }} />
        </span>
      )}
      <span className={cn('num text-[11px]', text[tone])}>{score == null ? '—' : score.toFixed(2)}</span>
    </span>
  )
}
