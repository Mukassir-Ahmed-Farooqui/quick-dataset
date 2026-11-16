import { NavLink } from 'react-router-dom'
import { FolderOpen, LayoutDashboard, Lock, Plug, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { prefetchPage, stepPageKey, type PageKey } from '@/routes/pages'
import { useProjectPipeline, useRouteProjectId, stepLabel, type PipelineStep, type StepStatus } from './useProjectPipeline'

interface NavItem {
  label: string
  icon: LucideIcon
  to: string
  page: PageKey
  end?: boolean
}

const WORKSPACE: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', page: 'dashboard' },
  { label: 'Projects', icon: FolderOpen, to: '/projects', page: 'projects', end: true },
]

const SETTINGS: NavItem[] = [{ label: 'Providers', icon: Plug, to: '/providers', page: 'providers' }]

const linkBase =
  'group relative flex h-8 items-center gap-2.5 px-3 font-display text-[11.5px] uppercase tracking-widest transition-colors duration-150'

function linkClass(isActive: boolean) {
  return cn(
    linkBase,
    isActive ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:bg-bg-muted/60 hover:text-fg',
  )
}

function ActiveBar({ active }: { active: boolean }) {
  return <span aria-hidden className={cn('absolute inset-y-1.5 left-0 w-px', active ? 'bg-accent' : 'bg-transparent')} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow px-3 pb-1.5 pt-5 text-[10px] text-fg-subtle">{children}</p>
}

const dotClass: Record<StepStatus, string> = {
  done: 'bg-fg',
  current: 'bg-accent',
  open: 'border border-fg-subtle bg-transparent',
  locked: 'border border-line-strong bg-transparent',
}

function StepLink({ projectId, step, onNavigate }: { projectId: string; step: PipelineStep; onNavigate?: () => void }) {
  const key = step.def.key
  return (
    <NavLink
      to={`/projects/${projectId}/${step.def.path}`}
      onClick={onNavigate}
      onMouseEnter={() => prefetchPage(stepPageKey[key])}
      onFocus={() => prefetchPage(stepPageKey[key])}
      className={({ isActive }) => cn(linkClass(isActive), step.status === 'locked' && !isActive && 'text-fg-subtle')}
    >
      {({ isActive }) => (
        <>
          <ActiveBar active={isActive} />
          <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dotClass[step.status])} />
          <span className="flex-1 truncate">{stepLabel(key)}</span>
          {step.status === 'locked' ? (
            <Lock className="size-3 text-fg-subtle" aria-label="Locked" />
          ) : (
            <span className={cn('num text-[11px]', step.count > 0 ? 'text-fg-secondary' : 'text-fg-subtle')}>
              {step.count.toLocaleString()}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function ProjectSection({ projectId, onNavigate }: { projectId: string; onNavigate?: () => void }) {
  const { project, steps } = useProjectPipeline(projectId)
  return (
    <>
      <SectionLabel>Project</SectionLabel>
      <NavLink
        to={`/projects/${projectId}`}
        end
        onClick={onNavigate}
        onMouseEnter={() => prefetchPage('overview')}
        className={({ isActive }) => cn(linkClass(isActive), 'normal-case tracking-normal')}
        title={project.data?.name}
      >
        {({ isActive }) => (
          <>
            <ActiveBar active={isActive} />
            <span className="truncate font-sans text-[13px] font-medium">
              {project.data?.name ?? <span className="skeleton inline-block h-3 w-28 align-middle" />}
            </span>
          </>
        )}
      </NavLink>
      <div className="mt-0.5 space-y-px">
        {steps.map((s) => (
          <StepLink key={s.def.key} projectId={projectId} step={s} onNavigate={onNavigate} />
        ))}
      </div>
    </>
  )
}

function NavItems({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-px">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          onMouseEnter={() => prefetchPage(item.page)}
          onFocus={() => prefetchPage(item.page)}
          className={({ isActive }) => linkClass(isActive)}
        >
          {({ isActive }) => (
            <>
              <ActiveBar active={isActive} />
              <item.icon className="size-3.5 shrink-0" strokeWidth={1.75} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}

interface SidebarProps {
  /** Called after a link is chosen (closes the mobile drawer). */
  onNavigate?: () => void
  /** Shows a close button (mobile drawer). */
  onClose?: () => void
  className?: string
}

export default function Sidebar({ onNavigate, onClose, className }: SidebarProps) {
  const projectId = useRouteProjectId()
  return (
    <aside className={cn('flex h-full w-60 shrink-0 flex-col border-r border-line bg-bg-subtle', className)}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <NavLink
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-widest text-fg"
        >
          <span aria-hidden className="size-2 bg-accent" />
          Quick Dataset
        </NavLink>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-fg-muted transition-colors hover:text-fg"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
        <SectionLabel>Workspace</SectionLabel>
        <NavItems items={WORKSPACE} onNavigate={onNavigate} />
        {projectId && (
          <ProjectSection projectId={projectId} onNavigate={onNavigate} />
        )}
        <SectionLabel>Settings</SectionLabel>
        <NavItems items={SETTINGS} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-line px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">Quick Dataset v0.1</span>
      </div>
    </aside>
  )
}
