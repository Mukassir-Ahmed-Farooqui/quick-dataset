import type { LucideIcon } from 'lucide-react'
import type React from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center py-12">
      <div className="bg-stone rounded-xl p-4 mb-4">
        <Icon className="h-6 w-6 text-muted" />
      </div>
      <h3 className="text-base font-medium text-ink mb-1">{title}</h3>
      <p className="text-sm text-body-muted max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
