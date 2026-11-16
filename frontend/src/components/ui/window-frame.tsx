import { cn } from '@/lib/utils'

/** macOS-style window chrome for console / preview panels. */
export function WindowFrame({
  title,
  right,
  dark,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode
  right?: React.ReactNode
  dark?: boolean
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col border', dark ? 'border-white/10 bg-ink-2 text-white' : 'border-line bg-bg', className)}>
      <div
        className={cn(
          'relative flex h-8 shrink-0 items-center gap-1.5 border-b px-3',
          dark ? 'border-white/10 bg-ink' : 'border-line-hair bg-bg-subtle',
        )}
      >
        <span className="size-[10px] rounded-full bg-[#ff5f57]" />
        <span className="size-[10px] rounded-full bg-[#febc2e]" />
        <span className="size-[10px] rounded-full bg-[#28c840]" />
        {title && (
          <span
            className={cn(
              'absolute left-1/2 -translate-x-1/2 truncate font-mono text-[11px]',
              dark ? 'text-white/45' : 'text-fg-muted',
            )}
          >
            {title}
          </span>
        )}
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </div>
  )
}
