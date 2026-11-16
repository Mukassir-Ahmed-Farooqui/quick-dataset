import type React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="truncate font-display text-2xl font-bold tracking-tight text-fg sm:text-[28px] sm:leading-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-secondary">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  )
}
