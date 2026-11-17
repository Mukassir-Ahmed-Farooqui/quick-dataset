import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowRight, Check, FolderOpen, Plug, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProjects, prefetchProject } from '@/hooks/useProjects'
import { useProviders } from '@/hooks/useProviders'
import PageHeader from '@/components/common/PageHeader'
import ErrorState from '@/components/common/ErrorState'
import EmptyState from '@/components/common/EmptyState'
import { GridSkeleton, ListSkeleton } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { fadeUp, stagger } from '@/lib/animations'
import { plural, timeAgo } from '@/lib/format'
import { prefetchPage } from '@/routes/pages'
import { cn } from '@/lib/utils'

function StatTile({ label, value, hint, to }: { label: string; value: React.ReactNode; hint: string; to?: string }) {
  const inner = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 text-[28px] font-bold leading-none text-fg">{value}</p>
      <p className="mt-2 text-xs text-fg-muted">{hint}</p>
    </>
  )
  return to ? (
    <Link to={to} className="group block bg-bg p-5 transition-colors hover:bg-bg-subtle">
      {inner}
    </Link>
  ) : (
    <div className="bg-bg p-5">{inner}</div>
  )
}

function SetupStep({ n, done, title, hint, action }: { n: number; done: boolean; title: string; hint: string; action: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 px-4 py-3.5">
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center border font-display text-[10px] font-bold',
          done ? 'border-fg bg-fg text-bg' : 'border-accent bg-accent text-accent-foreground',
        )}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-display text-sm font-bold', done && 'text-fg-muted line-through decoration-line-strong')}>{title}</p>
        <p className="text-xs text-fg-secondary">{hint}</p>
      </div>
      {!done && action}
    </li>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const projects = useProjects({ page: 1, pageSize: 6 })
  const providers = useProviders()

  const items = projects.data?.items ?? []
  const totalProjects = projects.data?.pagination.total_items ?? 0
  const totalKeys = providers.data?.pagination.total_items ?? 0
  const questions = items.reduce((n, p) => n + p.question_count, 0)
  const datasetItems = items.reduce((n, p) => n + p.dataset_item_count, 0)
  const loading = projects.isLoading || providers.isLoading
  const needsSetup = !loading && (totalKeys === 0 || totalProjects === 0)

  return (
    <m.div variants={stagger} initial="hidden" animate="visible" className="space-y-8">
      <m.div variants={fadeUp}>
        <PageHeader
          eyebrow="Dashboard"
          title={`Welcome back${user?.username ? `, ${user.username}` : ''}`}
          description="Your projects and LLM keys at a glance."
          action={
            <Button asChild>
              <Link to="/projects/new" onMouseEnter={() => prefetchPage('createProject')}>
                <Plus /> New project
              </Link>
            </Button>
          }
        />
      </m.div>

      {projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : (
        <>
          <m.div variants={fadeUp}>
            {loading ? (
              <GridSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
                <StatTile label="Projects" value={totalProjects.toLocaleString()} hint="In this workspace" to="/projects" />
                <StatTile
                  label="LLM keys"
                  value={totalKeys.toLocaleString()}
                  hint={totalKeys ? 'Connected providers' : 'Add one to generate'}
                  to="/providers"
                />
                <StatTile label="Questions" value={questions.toLocaleString()} hint="Across recent projects" />
                <StatTile label="Dataset items" value={datasetItems.toLocaleString()} hint="Across recent projects" />
              </div>
            )}
          </m.div>

          {needsSetup && (
            <m.div variants={fadeUp}>
              <Card>
                <CardHeader>
                  <CardTitle>Get started</CardTitle>
                  <span className="font-mono text-[11px] text-fg-muted">{[totalKeys > 0, totalProjects > 0].filter(Boolean).length} / 2</span>
                </CardHeader>
                <ol className="divide-y divide-line-hair">
                  <SetupStep
                    n={1}
                    done={totalKeys > 0}
                    title="Add an LLM key"
                    hint="OpenAI, OpenRouter, Groq or Gemini. Used for questions and answers."
                    action={
                      <Button asChild size="sm" variant="outline">
                        <Link to="/providers">
                          <Plug /> Add key
                        </Link>
                      </Button>
                    }
                  />
                  <SetupStep
                    n={2}
                    done={totalProjects > 0}
                    title="Create your first project"
                    hint="A project holds the documents and the dataset built from them."
                    action={
                      <Button asChild size="sm">
                        <Link to="/projects/new">
                          <Plus /> New project
                        </Link>
                      </Button>
                    }
                  />
                </ol>
              </Card>
            </m.div>
          )}

          <m.section variants={fadeUp} aria-labelledby="recent-projects">
            <div className="mb-3 flex items-end justify-between">
              <h2 id="recent-projects" className="eyebrow text-fg">
                Recent projects
              </h2>
              {totalProjects > items.length && (
                <Link to="/projects" className="font-display text-[11px] uppercase tracking-widest text-fg-muted hover:text-fg">
                  View all {totalProjects} →
                </Link>
              )}
            </div>
            {projects.isLoading ? (
              <ListSkeleton rows={3} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No projects yet"
                description="Create a project, upload a document, and the app walks you through the rest."
                action={
                  <Button asChild>
                    <Link to="/projects/new">
                      <Plus /> Create project
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => (
                  <li key={p.id} className="bg-bg">
                    <Link
                      to={`/projects/${p.id}`}
                      onMouseEnter={() => {
                        void prefetchProject(p.id)
                        prefetchPage('projectLayout')
                      }}
                      className="group flex h-full flex-col p-4 transition-colors hover:bg-bg-subtle"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate font-display text-sm font-bold">{p.name}</p>
                        <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>{p.status}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 min-h-8 text-xs text-fg-secondary">{p.description || 'No description'}</p>
                      <div className="mt-4 flex items-center gap-4 font-mono text-[11px] text-fg-muted">
                        <span>{plural(p.document_count, 'doc')}</span>
                        <span>{plural(p.question_count, 'question')}</span>
                        <span>{plural(p.dataset_item_count, 'item')}</span>
                        <ArrowRight className="ml-auto size-3.5 text-fg-subtle transition-colors group-hover:text-fg" />
                      </div>
                      <p className="mt-2 font-mono text-[10.5px] text-fg-subtle">Active {timeAgo(p.last_activity_at ?? p.updated_at)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </m.section>
        </>
      )}
    </m.div>
  )
}
