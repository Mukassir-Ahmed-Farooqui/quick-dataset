import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { m } from 'framer-motion'
import { CheckCircle2, CircleDashed, Pencil, Plug, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { GridSkeleton } from '@/components/common/LoadingState'
import PaginationControls from '@/components/common/PaginationControls'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { useProviders, useDeleteProvider, useTestProvider } from '@/hooks/useProviders'
import { toast, toastError } from '@/lib/toast'
import { fadeUp, stagger } from '@/lib/animations'
import { plural, timeAgo } from '@/lib/format'
import AddKeyDialog from '../components/AddKeyDialog'
import EditKeyDialog from '../components/EditKeyDialog'
import ModelPicker from '../components/ModelPicker'
import { PROVIDERS, providerLabel } from '../components/providerMeta'
import type { LLMKeyOut } from '@/types/api'

function ValidityBadge({ k }: { k: LLMKeyOut }) {
  if (k.is_valid === true) return <Badge variant="success" dot>Valid</Badge>
  if (k.is_valid === false) return <Badge variant="destructive" dot>Invalid</Badge>
  return <Badge variant="outline">Untested</Badge>
}

function KeyCard({
  k,
  testing,
  onTest,
  onEdit,
  onDelete,
}: {
  k: LLMKeyOut
  testing: boolean
  onTest: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const StatusIcon = k.is_valid === true ? CheckCircle2 : k.is_valid === false ? XCircle : CircleDashed
  return (
    <m.li variants={fadeUp} className="flex flex-col bg-bg">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="eyebrow">{providerLabel(k.provider)}</p>
          <p className="mt-1 truncate font-display text-sm font-bold">{k.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {k.is_default && <Badge variant="accent">Default</Badge>}
          <ValidityBadge k={k} />
        </div>
      </div>
      <div className="mx-4 border border-line-hair bg-bg-subtle px-3 py-2 font-mono text-xs text-fg-secondary">{k.masked_key}</div>
      <div className="px-4 pt-3">
        <ModelPicker keyData={k} />
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3 font-mono text-[11px] text-fg-muted">
        <StatusIcon
          className={k.is_valid === true ? 'size-3.5 text-success' : k.is_valid === false ? 'size-3.5 text-danger' : 'size-3.5'}
          strokeWidth={1.75}
        />
        {k.last_validated_at ? `Tested ${timeAgo(k.last_validated_at)}` : 'Never tested'}
        <span className="text-fg-subtle">· added {timeAgo(k.created_at)}</span>
      </div>
      <div className="mt-auto flex items-center gap-1 border-t border-line px-2 py-2">
        <Button variant="ghost" size="xs" onClick={onTest} loading={testing}>
          {!testing && <RefreshCw />} Test
        </Button>
        <Button variant="ghost" size="xs" onClick={onEdit}>
          <Pencil /> Edit
        </Button>
        <Tooltip content="Delete key">
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Delete ${k.name}`} className="ml-auto hover:text-danger">
            <Trash2 />
          </Button>
        </Tooltip>
      </div>
    </m.li>
  )
}

export default function ProvidersPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LLMKeyOut | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LLMKeyOut | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const { data, isLoading, isError, error, refetch } = useProviders({ page, pageSize })
  const deleteProvider = useDeleteProvider()
  const testProvider = useTestProvider()
  const keys = data?.items ?? []
  const total = data?.pagination.total_items ?? 0
  const valid = keys.filter((k) => k.is_valid === true).length

  const handleTest = async (key: LLMKeyOut) => {
    setTestingId(key.id)
    try {
      const result = await testProvider.mutateAsync({ id: key.id })
      if (result.success && result.warning) {
        toast({
          title: `${providerLabel(key.provider)} works, but check the model`,
          description: result.warning,
          variant: 'destructive',
        })
      } else if (result.success) {
        toast({
          title: `${providerLabel(key.provider)} connection OK`,
          description: [result.model, result.latency_ms != null && `${result.latency_ms} ms`].filter(Boolean).join(' · '),
        })
      } else {
        toast({ title: 'Connection failed', description: result.error || 'The provider rejected the key.', variant: 'destructive' })
      }
    } catch (err) {
      toastError('Test failed', err, () => void handleTest(key))
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteProvider.mutateAsync(deleteTarget.id)
      await qc.invalidateQueries({ queryKey: ['providers'] })
      toast({ title: 'Key deleted', description: `${deleteTarget.name} was removed.` })
      setDeleteTarget(null)
    } catch (err) {
      toastError('Could not delete key', err)
    }
  }

  return (
    <m.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <m.div variants={fadeUp}>
        <PageHeader
          eyebrow="Settings"
          title="Providers"
          description={
            total > 0
              ? `${plural(total, 'API key')}${valid ? ` · ${valid} valid` : ''}. Used to generate GA pairs, questions and answers.`
              : 'LLM API keys used to generate GA pairs, questions and answers.'
          }
          action={
            total > 0 && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus /> Add API key
              </Button>
            )
          }
        />
      </m.div>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <GridSkeleton count={3} />
      ) : keys.length === 0 ? (
        <m.div variants={fadeUp}>
          <EmptyState
            icon={Plug}
            title="No API keys yet"
            description="Add a key from any supported provider. It's encrypted at rest and you can test it right after."
            bullets={PROVIDERS.map((p) => p.label)}
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus /> Add API key
              </Button>
            }
          />
        </m.div>
      ) : (
        <div className="border border-line">
          <m.ul variants={stagger} className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {keys.map((k) => (
              <KeyCard
                key={k.id}
                k={k}
                testing={testingId === k.id}
                onTest={() => void handleTest(k)}
                onEdit={() => setEditTarget(k)}
                onDelete={() => setDeleteTarget(k)}
              />
            ))}
          </m.ul>
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

      <AddKeyDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditKeyDialog keyData={editTarget} open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete API key"
        message={`Remove "${deleteTarget?.name}"? Projects using it as their default will need another key. This can't be undone.`}
        confirmLabel="Delete key"
        variant="destructive"
        loading={deleteProvider.isPending}
        onConfirm={() => void handleDelete()}
      />
    </m.div>
  )
}
