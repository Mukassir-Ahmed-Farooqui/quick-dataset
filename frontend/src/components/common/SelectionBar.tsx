import { AnimatePresence, m } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Floating bulk-action bar shown while rows are selected. */
export default function SelectionBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 border border-ink-3 bg-ink px-3 py-2 text-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.45)]"
          role="toolbar"
          aria-label="Bulk actions"
        >
          <span className="num px-1 text-xs">{count.toLocaleString()} selected</span>
          <span className="h-5 w-px bg-white/15" />
          <div className="flex flex-wrap items-center gap-1.5 [&_button]:border-white/15 [&_button]:bg-transparent [&_button]:text-white [&_button:hover]:bg-white/10">
            {children}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection" className="text-white/60 hover:bg-white/10 hover:text-white">
            <X />
          </Button>
        </m.div>
      )}
    </AnimatePresence>
  )
}
