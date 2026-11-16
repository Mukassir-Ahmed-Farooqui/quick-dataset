import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center border border-line border-b-line-strong bg-bg-subtle px-1 font-mono text-[10.5px] font-medium text-fg-secondary',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
