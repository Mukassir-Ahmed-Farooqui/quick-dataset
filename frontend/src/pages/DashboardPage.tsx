import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import PageHeader from '@/components/common/PageHeader'
import { Plus } from 'lucide-react'

const statCards = [
  { label: 'PROJECTS', value: '--', subtitle: 'Total active projects' },
  { label: 'PROVIDERS', value: '--', subtitle: 'Connected LLM keys' },
  { label: 'DOCUMENTS', value: '--', subtitle: 'Uploaded documents' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your dataset pipeline."
        action={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {statCards.map((card) => (
          <Card key={card.label} className="border border-card-border rounded-lg bg-canvas">
            <CardContent className="p-6 space-y-3">
              <span className="font-mono text-xs tracking-wide uppercase text-muted">
                {card.label}
              </span>
              <div className="text-3xl font-semibold tracking-tight text-ink">
                {card.value}
              </div>
              <Separator />
              <span className="text-xs text-muted">{card.subtitle}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
