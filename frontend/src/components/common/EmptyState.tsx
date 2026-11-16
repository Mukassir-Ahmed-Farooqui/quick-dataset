import type { LucideIcon } from 'lucide-react'
import type React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  step?: string // e.g. "Step 2 · Chunks"
  title: string
  description: React.ReactNode
  bullets?: string[]
  action?: React.ReactNode
  secondary?: React.ReactNode
  className?: string
}

/** Explains what this step does and offers the one action that moves the user forward. */
export default function EmptyState({ icon: Icon, step, title, description, bullets, action, secondary, className }: EmptyStateProps) {
  return (
    <div className={cn('grid-lines-light flex flex-col items-center justify-center border border-dashed border-line-strong px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-5 grid size-11 place-items-center border border-line bg-bg">
          <Icon className="size-5 text-fg-secondary" strokeWidth={1.5} />
        </div>
      )}
      {step && <p className="eyebrow mb-2 text-accent">{step}</p>}
      <h3 className="font-display text-lg font-bold tracking-tight text-fg">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-secondary">{description}</p>
      {bullets && bullets.length > 0 && (
        <ul className="mt-4 space-y-1 text-left text-xs text-fg-muted">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="text-accent">→</span>
              {b}
            </li>
          ))}
        </ul>
      )}
      {(action || secondary) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  )
}
