import { useState } from 'react'
import { Plug, Loader2, Trash2, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PaginationControls from '@/components/common/PaginationControls'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useProviders, useDeleteProvider, useTestProvider } from '@/hooks/useProviders'
import { toast } from '@/lib/toast'
import { stagger, fadeUp } from '@/lib/animations'
import AddKeyDialog from '@/features/providers/components/AddKeyDialog'
import type { LLMKeyOut } from '@/types/api'

const providerIcons: Record<string, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  gemini: 'Gemini',
}

export default function ProvidersPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LLMKeyOut | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const { data, isLoading, isError, error, refetch } = useProviders({ page, pageSize })
  const deleteProvider = useDeleteProvider()
  const testProvider = useTestProvider()
  const keys = data?.items ?? []

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const handleTest = async (key: LLMKeyOut) => {
    setTestingId(key.id)
    try {
      const result = await testProvider.mutateAsync({ id: key.id })
      if (result.success) {
        toast({ title: `${providerIcons[key.provider] || key.provider} connection OK`, description: `Latency: ${result.latency_ms}ms` })
      } else {
        toast({ title: 'Connection failed', description: result.error || 'Unknown error', variant: 'destructive' })
      }
      refetch()
    } catch (err) {
      toast({ title: 'Test failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteProvider.mutateAsync(deleteTarget.id)
      toast({ title: 'Key deleted', description: `${deleteTarget.name} has been removed.` })
      setDeleteTarget(null)
    } catch (err) {
      toast({
        title: 'Failed to delete key',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Providers"
          description={keys.length > 0 ? `${keys.length} API key${keys.length !== 1 ? 's' : ''} configured` : 'Manage your LLM API keys.'}
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plug className="h-4 w-4 mr-2" />
              Add API Key
            </Button>
          }
        />
      </motion.div>

      {isError ? (
        <motion.div variants={fadeUp}>
          <ErrorState message={error instanceof Error ? error.message : 'Failed to load API keys'} onRetry={refetch} />
        </motion.div>
      ) : keys.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={Plug}
            title="No API keys configured"
            description="Add your first LLM provider key to enable generation. Supports OpenRouter, OpenAI, Groq, and Gemini."
            action={
              <Button onClick={() => setAddOpen(true)}>Add API Key</Button>
            }
          />
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {keys.map((key) => (
            <motion.div key={key.id} variants={fadeUp} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
              <Card className="border border-hairline rounded-lg bg-canvas h-full">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-ink">{key.name}</div>
                      <div className="text-xs text-muted mt-0.5">{providerIcons[key.provider] || key.provider}</div>
                    </div>
                    <Badge variant={key.is_valid === true ? 'success' : key.is_valid === false ? 'destructive' : 'outline'}>
                      {key.is_valid === true ? 'Valid' : key.is_valid === false ? 'Invalid' : 'Untested'}
                    </Badge>
                  </div>

                  <div className="font-mono text-xs text-muted bg-stone rounded-md px-3 py-2">
                    {key.masked_key}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>Added {new Date(key.created_at).toLocaleDateString()}</span>
                    {key.is_default && (
                      <>
                        <span>&middot;</span>
                        <Badge variant="secondary" className="text-[10px]">Default</Badge>
                      </>
                    )}
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(key)}
                      disabled={testingId === key.id}
                      className="flex-1"
                    >
                      {testingId === key.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(key)}
                      className="text-error hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          </div>
          <PaginationControls
            meta={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </motion.div>
      )}

      <AddKeyDialog open={addOpen} onOpenChange={setAddOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete API Key"
        message={`Remove "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </motion.div>
  )
}
