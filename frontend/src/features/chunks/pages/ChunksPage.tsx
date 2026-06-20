import { useParams, useNavigate } from 'react-router-dom'
import { Layers, ArrowLeft } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

export default function ChunksPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chunks"
        description={projectId ? `Project: ${projectId}` : 'Split documents into chunks for processing.'}
        action={
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Button>
        }
      />
      <EmptyState
        icon={Layers}
        title="No chunks generated"
        description="Upload and parse documents first, then generate chunks using recursive, markdown, or token strategies."
        action={<Button disabled>Generate Chunks</Button>}
      />
    </div>
  )
}
