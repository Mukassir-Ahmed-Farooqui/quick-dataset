import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ErrorState from '@/components/common/ErrorState'
import { TaskTray } from '@/components/common/TaskProgress'
import { useTrackedTasks } from '@/lib/tasks'
import { prefetchPage, stepPageKey } from '@/routes/pages'
import { cn } from '@/lib/utils'
import type { ProjectDetailOut } from '@/types/api'
import {
  stepLabel,
  useProjectPipeline,
  useRouteStep,
  type PipelineStep,
} from '@/components/layout/useProjectPipeline'

/** Outlet context for child pages that want the already-loaded project. */
export interface ProjectOutletContext {
  project: ProjectDetailOut
}

function StepMarker({ step, index }: { step: PipelineStep; index: number }) {
  const base = 'flex size-5 shrink-0 items-center justify-center border font-display text-[10px] font-bold'
  if (step.status === 'done') return <span className={cn(base, 'border-fg bg-fg text-bg')}><Check className="size-3" strokeWidth={3} /></span>
  if (step.status === 'current') return <span className={cn(base, 'border-accent bg-accent text-accent-foreground')}>{index + 1}</span>
  if (step.status === 'locked') return <span className={cn(base, 'border-line text-fg-subtle')}><Lock className="size-2.5" /></span>
  return <span className={cn(base, 'border-line-strong text-fg-muted')}>{index + 1}</span>
}

function Stepper({ projectId, steps }: { projectId: string; steps: PipelineStep[] }) {
  return (
    <nav aria-label="Pipeline" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex min-w-max border border-line sm:min-w-0">
        {steps.map((s, i) => {
          const key = s.def.key
          return (
            <li key={key} className="relative flex-1 border-r border-line last:border-r-0">
              <NavLink
                to={`/projects/${projectId}/${s.def.path}`}
                onMouseEnter={() => prefetchPage(stepPageKey[key])}
                onFocus={() => prefetchPage(stepPageKey[key])}
                aria-label={`${stepLabel(key)}: ${s.status}, ${s.count}`}
                className={({ isActive }) =>
                  cn(
                    'group flex h-full items-center gap-2.5 px-3 py-2.5 transition-colors duration-150',
                    isActive ? 'bg-bg-muted' : 'bg-bg hover:bg-bg-subtle',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      className={cn('absolute inset-x-0 bottom-0 h-px transition-colors', isActive ? 'bg-accent' : 'bg-transparent')}
                    />
                    <StepMarker step={s} index={i} />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block truncate font-display text-[11px] uppercase tracking-widest',
                          s.status === 'locked' ? 'text-fg-subtle' : isActive ? 'text-fg' : 'text-fg-secondary',
                        )}
                      >
                        {stepLabel(key)}
                        {s.def.optional && <span className="ml-1 normal-case tracking-normal text-fg-subtle">opt.</span>}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-fg-muted">
                        <span className="num">{s.count.toLocaleString()}</span>
                        {s.sub && <span className="text-fg-subtle"> · {s.sub}</span>}
                      </span>
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function HeaderSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading project">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-6 w-56" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-14 w-full" />
    </div>
  )
}

export default function ProjectLayout() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { project, steps, next } = useProjectPipeline(projectId)
  const routeStep = useRouteStep()
  const tasks = useTrackedTasks(projectId)

  if (project.isError) {
    return <ErrorState error={project.error} message="Could not load this project." onRetry={() => void project.refetch()} />
  }

  const p = project.data
  const onNextStep = routeStep === next.step

  return (
    <div className="space-y-6">
      {!p ? (
        <HeaderSkeleton />
      ) : (
        <header className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Project</p>
              <h1 className="mt-1 truncate font-display text-xl font-bold tracking-tight text-fg">
                <Link to={`/projects/${projectId}`} className="hover:underline hover:underline-offset-4">
                  {p.name}
                </Link>
              </h1>
              {p.description && <p className="mt-1 line-clamp-1 text-sm text-fg-muted">{p.description}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              <Button asChild variant={onNextStep ? 'outline' : 'default'} size="default">
                <Link
                  to={`/projects/${projectId}/${next.step}`}
                  onMouseEnter={() => prefetchPage(stepPageKey[next.step])}
                  onFocus={() => prefetchPage(stepPageKey[next.step])}
                  aria-current={onNextStep ? 'step' : undefined}
                >
                  <span className="uppercase tracking-widest">Next:</span> {next.label}
                  <ArrowRight />
                </Link>
              </Button>
              <p className="max-w-xs font-mono text-[11px] text-fg-muted sm:text-right">{next.hint}</p>
            </div>
          </div>
          <Stepper projectId={projectId} steps={steps} />
        </header>
      )}

      <TaskTray tasks={tasks} />

      <Outlet context={p ? ({ project: p } satisfies ProjectOutletContext) : undefined} />
    </div>
  )
}
