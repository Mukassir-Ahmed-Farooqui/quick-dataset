import { Link, useLocation, useMatch } from 'react-router-dom'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

/**
 * 404. Rendered bare (top-level) or inside a project (unknown step), where it
 * offers the way back to that project's overview instead.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()
  const inProject = useMatch('/projects/:projectId/*')
  const projectId = inProject?.params.projectId

  const body = (
    <EmptyState
      icon={FileQuestion}
      step="404 · Not found"
      title="Nothing lives here"
      description={
        <>
          <span className="font-mono text-xs text-fg-muted">{pathname}</span>
          <br />
          The page may have moved, or the link is mistyped.
        </>
      }
      action={
        projectId ? (
          <Button asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft /> Back to project
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to={isAuthenticated ? '/dashboard' : '/'}>
              <ArrowLeft /> {isAuthenticated ? 'Go to dashboard' : 'Go home'}
            </Link>
          </Button>
        )
      }
      secondary={
        isAuthenticated && (
          <Button asChild variant="outline">
            <Link to="/projects">All projects</Link>
          </Button>
        )
      }
      className="w-full max-w-xl"
    />
  )

  if (projectId) return body

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 items-center border-b border-line px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-widest">
          <span aria-hidden className="size-2 bg-accent" />
          Quick Dataset
        </Link>
      </header>
      <main className="grid flex-1 place-items-center p-6">{body}</main>
    </div>
  )
}
