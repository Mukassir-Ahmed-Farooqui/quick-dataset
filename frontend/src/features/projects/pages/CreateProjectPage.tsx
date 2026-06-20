import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/common/PageHeader'

export default function CreateProjectPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Project"
        description="Create a new dataset project."
        action={
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />
      <div className="max-w-lg space-y-4">
        <div className="h-10 rounded-lg border border-hairline bg-canvas px-3 flex items-center">
          <span className="text-sm text-muted">Project name</span>
        </div>
        <div className="h-20 rounded-lg border border-hairline bg-canvas px-3 py-2">
          <span className="text-sm text-muted">Description (optional)</span>
        </div>
        <Button disabled>Create Project</Button>
      </div>
    </div>
  )
}
