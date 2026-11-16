import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Footer strip that hands the user to the next pipeline step once this one has output. */
export default function NextStepBar({
  to,
  label,
  hint,
  primary = true,
  className,
}: {
  to: string
  label: string
  hint?: string
  primary?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3 border border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <p className="eyebrow text-accent">Next step</p>
        {hint && <p className="mt-0.5 text-sm text-fg-secondary">{hint}</p>}
      </div>
      <Button asChild variant={primary ? 'default' : 'outline'}>
        <Link to={to}>
          {label} <ArrowRight />
        </Link>
      </Button>
    </div>
  )
}
