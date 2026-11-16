import * as React from 'react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

const DropdownMenu = DM.Root
const DropdownMenuTrigger = DM.Trigger

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DM.Content>, React.ComponentPropsWithoutRef<typeof DM.Content>>(
  ({ className, sideOffset = 6, ...props }, ref) => (
    <DM.Portal>
      <DM.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[200px] border border-line bg-bg p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.2)] data-[state=open]:animate-slide-up',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  ),
)
DropdownMenuContent.displayName = 'DropdownMenuContent'

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DM.Item>, React.ComponentPropsWithoutRef<typeof DM.Item>>(
  ({ className, ...props }, ref) => (
    <DM.Item
      ref={ref}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 px-2.5 py-1.5 text-sm text-fg outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-bg-muted data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:text-fg-muted',
        className,
      )}
      {...props}
    />
  ),
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

const DropdownMenuLabel = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Label>) => (
  <DM.Label className={cn('px-2.5 py-1.5 text-xs text-fg-muted', className)} {...props} />
)

const DropdownMenuSeparator = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Separator>) => (
  <DM.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
)

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator }
