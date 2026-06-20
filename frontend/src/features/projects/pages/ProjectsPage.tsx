import { FolderOpen } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export default function ProjectsPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage your RAG pipeline projects."
        action={
          <Button onClick={() => navigate('/projects/new')}>
            New Project
          </Button>
        }
      />
      <EmptyState
        icon={FolderOpen}
        title="No projects yet"
        description="Create your first project to start building datasets from your documents."
        action={
          <Button onClick={() => navigate('/projects/new')}>
            Create Project
          </Button>
        }
      />
    </div>
  )
}
