import { useNavigate } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        }
      />
    </div>
  )
}
