import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap border font-display text-xs font-bold tracking-tight transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground hover:bg-primary/85',
        accent: 'border-accent bg-accent text-accent-foreground hover:bg-accent/90',
        outline: 'border-line bg-bg text-fg hover:border-line-strong hover:bg-bg-subtle',
        secondary: 'border-transparent bg-bg-muted text-fg hover:bg-paper-2',
        ghost: 'border-transparent text-fg-secondary hover:bg-bg-muted hover:text-fg',
        destructive: 'border-danger bg-danger text-white hover:bg-danger/90',
        'danger-outline': 'border-line bg-bg text-danger hover:border-danger/50 hover:bg-danger/5',
        link: 'border-transparent px-0 text-fg underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-[11px]',
        xs: 'h-7 px-2 text-[11px]',
        lg: 'h-11 px-6 text-[13px]',
        icon: 'h-9 w-9 px-0',
        'icon-sm': 'h-7 w-7 px-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      )
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
