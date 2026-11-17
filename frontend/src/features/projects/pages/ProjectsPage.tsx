import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { m } from 'framer-motion'
import { FolderOpen, Plus, Search } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import PaginationControls from '@/components/common/PaginationControls'
import { ListSkeleton } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProjects, prefetchProject } from '@/hooks/useProjects'
import { useDebounce } from '@/hooks/useDebounce'
import { fadeUp } from '@/lib/animations'
import { plural, timeAgo } from '@/lib/format'
import { prefetchPage } from '@/routes/pages'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [query, setQuery] = useState('')
  const q = useDebounce(query, 150).trim().toLowerCase()
  const { data, isLoading, isError, error, refetch } = useProjects({ page, pageSize })

  const projects = data?.items ?? []
  const total = data?.pagination.total_items ?? 0
  const visible = q
    ? projects.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
    : projects

  const open = (id: string) => navigate(`/projects/${id}`)
  const warm = (id: string) => {
    void prefetchProject(id)
    prefetchPage('projectLayout')
    prefetchPage('overview')
  }

  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description={total > 0 ? `${plural(total, 'project')}. Each one turns its documents into a dataset.` : 'Each project turns its documents into a dataset.'}
        action={
          <Button asChild>
            <Link to="/projects/new" onMouseEnter={() => prefetchPage('createProject')}>
              <Plus /> New project
            </Link>
          </Button>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to start building a dataset from your documents."
          bullets={['Upload PDF, DOCX, Markdown or TXT', 'Generate questions and answers with your LLM key', 'Review, then export']}
          action={
            <Button asChild>
              <Link to="/projects/new">
                <Plus /> Create project
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="border border-line">
          <div className="flex items-center gap-3 border-b border-line px-3 py-2">
            <Search className="size-3.5 shrink-0 text-fg-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter projects on this page…"
              aria-label="Filter projects"
              className="h-8 border-transparent px-0 hover:border-transparent focus:border-transparent dark:bg-transparent"
            />
            {q && <span className="shrink-0 font-mono text-[11px] text-fg-muted">{visible.length} match</span>}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Docs</TableHead>
                <TableHead className="hidden text-right md:table-cell">Questions</TableHead>
                <TableHead className="hidden text-right md:table-cell">Items</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-fg-muted">
                    No projects match “{query}”.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((p) => (
                  <TableRow
                    key={p.id}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-bg-subtle focus-visible:outline-none"
                    onClick={() => open(p.id)}
                    onKeyDown={(e) => e.key === 'Enter' && open(p.id)}
                    onMouseEnter={() => warm(p.id)}
                    onFocus={() => warm(p.id)}
                  >
                    <TableCell className="max-w-0 sm:max-w-sm">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.description && <p className="truncate text-xs text-fg-muted">{p.description}</p>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="num text-right text-fg-secondary">{p.document_count.toLocaleString()}</TableCell>
                    <TableCell className="num hidden text-right text-fg-secondary md:table-cell">{p.question_count.toLocaleString()}</TableCell>
                    <TableCell className="num hidden text-right text-fg-secondary md:table-cell">{p.dataset_item_count.toLocaleString()}</TableCell>
                    <TableCell className="hidden text-right font-mono text-[11px] text-fg-muted lg:table-cell">
                      {p.last_activity_at ? timeAgo(p.last_activity_at) : 'Never'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationControls
            meta={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}
    </m.div>
  )
}
