import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

interface Shortcut {
  keys: string[]
  label: string
  /** Keys pressed one after another rather than together. */
  sequence?: boolean
}

const SHORTCUT_GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Navigation',
    items: [
      { keys: ['g', 'p'], label: 'Go to projects', sequence: true },
      { keys: ['g', 'd'], label: 'Go to dashboard', sequence: true },
    ],
  },
  {
    title: 'General',
    items: [
      { keys: ['t'], label: 'Toggle light / dark theme' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['Esc'], label: 'Close dialog or menu' },
    ],
  },
  {
    title: 'Review',
    items: [
      { keys: ['a'], label: 'Approve answer' },
      { keys: ['r'], label: 'Reject answer' },
      { keys: ['j'], label: 'Next item' },
      { keys: ['k'], label: 'Previous item' },
      { keys: ['e'], label: 'Edit answer' },
    ],
  },
]

export default function HelpOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="eyebrow">Help</p>
          <DialogTitle className="font-display text-base font-bold">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs text-fg-muted">Shortcuts are off while you type in a field.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-line">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="px-5 py-4">
              <h3 className="eyebrow mb-2">{group.title}</h3>
              <ul className="space-y-1.5">
                {group.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-4 text-sm text-fg-secondary">
                    <span>{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1">
                          {i > 0 && <span className="font-mono text-[10px] text-fg-subtle">{s.sequence ? 'then' : '+'}</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
