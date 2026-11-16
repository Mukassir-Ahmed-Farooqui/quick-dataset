import { useId, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { collapse } from '@/lib/animations'
import { cn } from '@/lib/utils'

/** "Advanced options" disclosure: collapsed by default so smart defaults stay out of the way. */
export default function Collapsible({
  label = 'Advanced options',
  hint,
  defaultOpen = false,
  children,
  className,
}: {
  label?: string
  hint?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={cn('border-t border-line-hair', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-2.5 text-left text-xs text-fg-secondary transition-colors hover:text-fg"
      >
        <ChevronRight className={cn('size-3.5 transition-transform duration-150', open && 'rotate-90')} />
        <span className="eyebrow text-inherit">{label}</span>
        {hint && !open && <span className="truncate text-fg-muted">· {hint}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div id={id} variants={collapse} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
            <div className="pb-3 pt-1">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
