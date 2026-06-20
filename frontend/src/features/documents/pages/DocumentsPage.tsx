import { useParams, useNavigate } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

export default function DocumentsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description={projectId ? `Project: ${projectId}` : 'Upload and manage your source documents.'}
        action={
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Button>
        }
      />
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Upload PDF, DOCX, Markdown, or TXT files to get started."
        action={<Button>Upload Documents</Button>}
      />
    </div>
  )
}
