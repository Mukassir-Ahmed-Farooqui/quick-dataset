import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ProcessingStatus } from '@/types/api'

const CONFIG: Record<ProcessingStatus, { label: string; variant: 'outline' | 'accent' | 'success' | 'destructive' }> = {
  queued: { label: 'Queued', variant: 'outline' },
  parsing: { label: 'Parsing', variant: 'accent' },
  parsed: { label: 'Ready', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
}

export default function DocumentStatusBadge({ status }: { status: ProcessingStatus }) {
  const c = CONFIG[status]
  return (
    <Badge variant={c.variant}>
      {(status === 'parsing' || status === 'queued') && <Loader2 className="size-2.5 animate-spin" aria-hidden />}
      {c.label}
    </Badge>
  )
}
