import { Fragment, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HelpCircle, LayoutDashboard, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/lib/theme'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProject } from '@/hooks/useProjects'
import { prefetchPage } from '@/routes/pages'
import { cn } from '@/lib/utils'
import { stepLabel, useRouteProjectId, useRouteStep } from './useProjectPipeline'

interface Crumb {
  label: React.ReactNode
  to?: string
}

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation()
  const projectId = useRouteProjectId()
  const step = useRouteStep()
  const project = useProject(projectId ?? '')

  if (pathname.startsWith('/dashboard')) return [{ label: 'Dashboard' }]
  if (pathname.startsWith('/providers')) return [{ label: 'Providers' }]
  if (pathname === '/projects/new') return [{ label: 'Projects', to: '/projects' }, { label: 'New' }]
  if (projectId) {
    const name = project.data?.name ?? <span className="skeleton inline-block h-3 w-24 align-middle" />
    const crumbs: Crumb[] = [{ label: 'Projects', to: '/projects' }, { label: name, to: step ? `/projects/${projectId}` : undefined }]
    if (step) crumbs.push({ label: stepLabel(step) })
    return crumbs
  }
  if (pathname.startsWith('/projects')) return [{ label: 'Projects' }]
  return []
}

function Breadcrumbs() {
  const crumbs = useBreadcrumbs()
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 font-display text-[11.5px] uppercase tracking-widest">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden className="text-fg-subtle">
                  /
                </li>
              )}
              <li className={cn('min-w-0', i === 1 && crumbs.length > 2 ? 'hidden truncate sm:block' : 'truncate')}>
                {c.to && !last ? (
                  <Link
                    to={c.to}
                    onMouseEnter={() => prefetchPage(c.to === '/projects' ? 'projects' : 'overview')}
                    className="text-fg-muted transition-colors hover:text-fg"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-fg" aria-current={last ? 'page' : undefined}>
                    {c.label}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

interface NavbarProps {
  onMenuToggle?: () => void
  onHelp?: () => void
}

export default function Navbar({ onMenuToggle, onHelp }: NavbarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const [signingOut, setSigningOut] = useState(false)
  const initials = user?.username?.charAt(0).toUpperCase() || 'U'

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await logout()
      toast({ title: 'Signed out' })
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-bg/90 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="-ml-1.5 p-1.5 text-fg-muted transition-colors hover:text-fg lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
        )}
        <Breadcrumbs />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onHelp && (
          <Tooltip content="Keyboard shortcuts (?)">
            <Button variant="ghost" size="icon-sm" onClick={onHelp} aria-label="Keyboard shortcuts">
              <HelpCircle />
            </Button>
          </Tooltip>
        )}
        <Tooltip content={`${resolved === 'dark' ? 'Light' : 'Dark'} theme (t)`}>
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme">
            {resolved === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex size-7 items-center justify-center border border-line bg-bg-subtle font-display text-xs font-bold text-fg transition-colors hover:border-line-strong"
              aria-label="User menu"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="pb-0 font-display text-xs font-bold text-fg">{user?.username}</DropdownMenuLabel>
            <DropdownMenuLabel className="truncate pt-0.5 font-mono text-[11px]">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/dashboard')}>
              <LayoutDashboard /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={toggle}>
              {resolved === 'dark' ? <Sun /> : <Moon />} {resolved === 'dark' ? 'Light' : 'Dark'} theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                void handleSignOut()
              }}
              disabled={signingOut}
              className="text-danger [&_svg]:text-danger"
            >
              <LogOut /> {signingOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
