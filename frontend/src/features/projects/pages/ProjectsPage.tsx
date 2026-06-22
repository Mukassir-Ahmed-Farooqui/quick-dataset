import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import DataTable from '@/components/common/DataTable'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import PaginationControls from '@/components/common/PaginationControls'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProjects } from '@/hooks/useProjects'
import { stagger, fadeUp } from '@/lib/animations'
import type { ProjectListItemOut } from '@/types/api'

const columns = [
  { key: 'name', header: 'Name', render: (p: ProjectListItemOut) => <span className="font-medium text-ink">{p.name}</span> },
  { key: 'status', header: 'Status', render: (p: ProjectListItemOut) => (
    <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>{p.status}</Badge>
  )},
  { key: 'documents', header: 'Documents', render: (p: ProjectListItemOut) => (
    <span className="text-body-muted">{p.document_count}</span>
  )},
  { key: 'last_activity', header: 'Last Activity', render: (p: ProjectListItemOut) => (
    <span className="text-body-muted">
      {p.last_activity_at ? new Date(p.last_activity_at).toLocaleDateString() : 'Never'}
    </span>
  )},
  { key: 'created', header: 'Created', render: (p: ProjectListItemOut) => (
    <span className="text-body-muted text-sm">{new Date(p.created_at).toLocaleDateString()}</span>
  )},
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const { data, isLoading, isError, error, refetch } = useProjects({ page, pageSize })
  const projects = data?.items ?? []
  const total = data?.pagination.total_items ?? 0
  const errorMessage = error instanceof Error ? error.message : 'Failed to load projects'

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Projects"
          description={total > 0 ? `${total} project${total !== 1 ? 's' : ''} total` : 'Manage your RAG pipeline projects.'}
          action={
            <Button onClick={() => navigate('/projects/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          }
        />
      </motion.div>

      {isError ? (
        <motion.div variants={fadeUp}>
          <ErrorState message={errorMessage} onRetry={refetch} />
        </motion.div>
      ) : projects.length === 0 && !isLoading ? (
        <motion.div variants={fadeUp}>
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
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="space-y-4">
          <DataTable
            columns={columns}
            data={projects}
            loading={isLoading}
            onRowClick={(p) => navigate(`/projects/${p.id}`)}
          />
          <PaginationControls
            meta={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </motion.div>
      )}
    </motion.div>
  )
}
