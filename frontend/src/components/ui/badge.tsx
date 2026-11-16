import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex h-5 shrink-0 items-center gap-1 border px-1.5 font-display text-[10px] font-bold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'border-line bg-bg-subtle text-fg-secondary',
        solid: 'border-primary bg-primary text-primary-foreground',
        accent: 'border-accent/40 bg-accent/10 text-accent',
        outline: 'border-line text-fg-muted',
        secondary: 'border-transparent bg-paper-2 text-fg-secondary',
        success: 'border-success/30 bg-success/10 text-success',
        destructive: 'border-danger/30 bg-danger/10 text-danger',
        warning: 'border-warning/30 bg-warning/10 text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
