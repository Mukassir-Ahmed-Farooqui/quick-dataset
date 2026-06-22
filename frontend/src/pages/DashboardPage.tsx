import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { useProviders } from '@/hooks/useProviders'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { stagger, fadeUp, scaleUp } from '@/lib/animations'
import { FolderOpen, Plug, Plus } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: projectsData } = useProjects({ page: 1, pageSize: 5 })
  const { data: providersData } = useProviders()
  const projects = projectsData?.items ?? []
  const totalProjects = projectsData?.pagination.total_items ?? 0
  const totalProviders = providersData?.pagination.total_items ?? 0

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <div className="bg-gradient-to-br from-deep-green to-emerald-700 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-medium text-white">
              Welcome back, {user?.username}.
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Your RAG pipeline workspace is ready.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/projects/new')}
            className="bg-white/10 border border-white/20 text-white text-sm rounded-pill px-5 py-2
              hover:bg-white/20 transition-colors font-medium whitespace-nowrap"
          >
            New Project
          </motion.button>
        </div>
      </motion.div>

      <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <motion.div variants={scaleUp}>
          <Card className="border-card-border rounded-lg bg-canvas hover:shadow-md transition-all duration-300 h-full overflow-hidden group cursor-pointer" onClick={() => navigate('/projects')}>
            <CardContent className="p-6 space-y-3 relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-deep-green/5 rounded-bl-3xl group-hover:scale-150 transition-transform duration-500" />
              <span className="font-mono text-xs tracking-wide uppercase text-muted relative">Projects</span>
              <div className="text-3xl font-semibold tracking-tight text-ink relative">{totalProjects}</div>
              <Separator />
              <span className="text-xs text-muted relative">Total active projects</span>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={scaleUp} transition={{ delay: 0.1 }}>
          <Card className="border-card-border rounded-lg bg-canvas hover:shadow-md transition-all duration-300 h-full overflow-hidden group cursor-pointer" onClick={() => navigate('/providers')}>
            <CardContent className="p-6 space-y-3 relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-action/5 rounded-bl-3xl group-hover:scale-150 transition-transform duration-500" />
              <span className="font-mono text-xs tracking-wide uppercase text-muted relative">Providers</span>
              <div className="text-3xl font-semibold tracking-tight text-ink relative">{totalProviders}</div>
              <Separator />
              <span className="text-xs text-muted relative">Connected LLM keys</span>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={scaleUp} transition={{ delay: 0.2 }}>
          <Card className="border-card-border rounded-lg bg-canvas hover:shadow-md transition-all duration-300 h-full">
            <CardContent className="p-6 space-y-3">
              <span className="font-mono text-xs tracking-wide uppercase text-muted">Quick actions</span>
              <div className="flex flex-col gap-2">
                <button onClick={() => navigate('/projects/new')} className="flex items-center gap-2 text-sm text-action hover:text-action/80 font-medium transition-colors">
                  <Plus className="h-4 w-4" />
                  Create a project
                </button>
                <button onClick={() => navigate('/providers')} className="flex items-center gap-2 text-sm text-action hover:text-action/80 font-medium transition-colors">
                  <Plug className="h-4 w-4" />
                  Add an API key
                </button>
              </div>
              <Separator />
              <span className="text-xs text-muted">Get started in seconds</span>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Recent projects */}
      {projects.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card className="border-hairline">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-ink">Recent projects</h3>
                <button onClick={() => navigate('/projects')} className="text-xs text-action hover:underline">View all</button>
              </div>
              <div className="space-y-2">
                {projects.map(p => (
                  <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="flex items-center justify-between p-3 rounded-lg hover:bg-stone cursor-pointer transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderOpen className="h-4 w-4 text-muted group-hover:text-ink flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                        <p className="text-xs text-muted">{p.document_count} docs</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="success" className="text-[10px]">{p.status}</Badge>
                      <span className="text-xs text-muted hidden sm:inline">{new Date(p.last_activity_at || p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
