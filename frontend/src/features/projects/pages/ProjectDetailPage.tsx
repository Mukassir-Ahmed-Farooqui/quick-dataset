import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const pipelineSteps = [
  { label: 'DOCUMENTS', value: '--' },
  { label: 'CHUNKS', value: '--' },
  { label: 'GA PAIRS', value: '--' },
  { label: 'QUESTIONS', value: '--' },
  { label: 'DATASET', value: '--' },
]

export default function ProjectDetailPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Detail"
        description={`Project ID: ${projectId}`}
        action={
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        }
      />

      <div className="grid grid-cols-5 gap-4">
        {pipelineSteps.map((step) => (
          <Card key={step.label}>
            <CardContent className="p-4 space-y-2 text-center">
              <span className="font-mono text-[10px] tracking-wide uppercase text-muted">
                {step.label}
              </span>
              <div className="text-2xl font-semibold tracking-tight text-ink">{step.value}</div>
              <Separator />
            </CardContent>
          </Card>
        ))}
      </div>

      <EmptyState
        icon={FolderOpen}
        title="Start building your dataset"
        description="Upload documents to begin the pipeline."
        action={
          <Button onClick={() => navigate(`/projects/${projectId}/documents`)}>
            Upload Documents
          </Button>
        }
      />
    </div>
  )
}
