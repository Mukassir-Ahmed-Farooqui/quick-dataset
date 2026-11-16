import * as React from 'react'
import { cn } from '@/lib/utils'

export const fieldClass =
  'w-full border border-input bg-bg px-3 text-sm text-fg transition-colors duration-150 placeholder:text-fg-subtle hover:border-line-strong focus:border-fg focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger dark:bg-input/40'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn(fieldClass, 'h-9', className)} {...props} />
  ),
)
Input.displayName = 'Input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldClass, 'min-h-[80px] resize-y py-2 leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        fieldClass,
        'h-9 cursor-pointer appearance-none bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%23737373' stroke-width='1.2'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { indeterminate?: boolean }>(
  ({ className, indeterminate, ...props }, ref) => {
    const inner = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => inner.current as HTMLInputElement)
    React.useEffect(() => {
      if (inner.current) inner.current.indeterminate = !!indeterminate
    }, [indeterminate])
    return (
      <input
        ref={inner}
        type="checkbox"
        className={cn(
          'qd-check peer size-4 shrink-0 cursor-pointer appearance-none border border-line-strong bg-bg transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
        {...props}
      />
    )
  },
)
Checkbox.displayName = 'Checkbox'

export { Input, Textarea, Select, Checkbox }
