import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Download, ListChecks } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { exportsApi } from '@/api/exports'
import { useDebounce } from '@/hooks/useDebounce'
import { useDatasetItems } from '@/hooks/useDatasetItems'
import { useCreateExport, useDeleteExport, useExports } from '@/hooks/useExports'
import { patchPagedLists, removeIds, restore } from '@/lib/optimistic'
import { undoable } from '@/lib/undo'
import { sonnerToast, toastError } from '@/lib/toast'
import { plural } from '@/lib/format'
import type { ExportOut } from '@/types/api'
import ExportHistory, { type DownloadState } from '../components/ExportHistory'
import ExportPreview from '../components/ExportPreview'
import FormatPicker from '../components/FormatPicker'
import { downloadExport, formatDef, type ExportType } from '../components/formats'

type Snapshot = Awaited<ReturnType<typeof patchPagedLists>>
const PREVIEW_ROWS = 5
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function ExportPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Options ──
  const [type, setType] = useState<ExportType>('jsonl')
  const [approvedOnly, setApprovedOnly] = useState(true)
  const [minScoreInput, setMinScoreInput] = useState('')
  const minScoreRaw = useDebounce(minScoreInput, 300)
  const minScore = minScoreRaw === '' || Number.isNaN(Number(minScoreRaw)) ? undefined : Math.max(0, Math.min(1, Number(minScoreRaw)))

  // ── Data ──
  const previewQ = useDatasetItems(projectId, { confirmed: approvedOnly ? true : undefined, minScore, page: 1, pageSize: PREVIEW_ROWS })
  const allQ = useDatasetItems(projectId, { page: 1, pageSize: 1 })
  const exportsQ = useExports(projectId)
  const exports = exportsQ.data?.items ?? []
  const matching = previewQ.data?.pagination.total_items ?? 0
  const totalItems = allQ.data?.pagination.total_items ?? 0

  // ── Export + download ──
  const create = useCreateExport(projectId)
  const del = useDeleteExport(projectId)
  const [downloads, setDownloads] = useState<DownloadState>({})
  const [preparing, setPreparing] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const startDownload = async (ex: ExportOut) => {
    setDownloads((d) => ({ ...d, [ex.id]: null }))
    try {
      await downloadExport(projectId, ex, (pct) => alive.current && setDownloads((d) => ({ ...d, [ex.id]: pct })))
    } catch (err) {
      toastError('Download failed', err, () => void startDownload(ex))
    } finally {
      if (alive.current)
        setDownloads((d) => {
          const next = { ...d }
          delete next[ex.id]
          return next
        })
    }
  }

  /** Wait for a freshly created export to finish, then download it. */
  const waitAndDownload = async (id: string) => {
    for (let i = 0; i < 150 && alive.current; i++) {
      const page = await exportsApi.list(projectId, 1, 20).catch(() => null)
      const ex = page?.items.find((e) => e.id === id)
      if (ex?.status === 'ready') {
        qc.invalidateQueries({ queryKey: ['exports', projectId] })
        await startDownload(ex)
        return
      }
      if (ex?.status === 'failed') {
        sonnerToast.error('Export failed', { description: 'The server could not write the file. Try again.' })
        return
      }
      await sleep(2000)
    }
  }

  const onExport = () =>
    create.mutate(
      { export_type: type, filter: { confirmed: approvedOnly || undefined, min_score: minScore } },
      {
        onSuccess: async (ex) => {
          sonnerToast.success(`${formatDef(type).label} export started`, { description: `${plural(matching, 'row')} · downloads automatically when ready.` })
          setPreparing(true)
          try {
            if (ex.status === 'ready') await startDownload(ex)
            else if (ex.status === 'generating') await waitAndDownload(ex.id)
          } finally {
            if (alive.current) setPreparing(false)
          }
        },
        onError: (err) => toastError('Could not start export', err, onExport),
      },
    )

  const onDelete = (ex: ExportOut) => {
    const key = ['exports', projectId]
    let snap: Snapshot | undefined
    void undoable({
      message: `${formatDef(ex.export_type).label} export deleted`,
      apply: async () => {
        snap = await patchPagedLists<ExportOut>(qc, key, removeIds([ex.id]))
      },
      rollback: () => {
        restore(qc, snap)
        qc.invalidateQueries({ queryKey: key })
      },
      commit: () => del.mutateAsync(ex.id),
      onCommitted: () => qc.invalidateQueries({ queryKey: key }),
    })
  }

  const activeDownload = Object.entries(downloads)[0]
  const busy = create.isPending || preparing

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        eyebrow="Step 6 · Export"
        title="Export dataset"
        description="Pick a format, choose which rows to include, check the preview, and download."
        action={
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/dataset-review`)}>
            <ListChecks /> Back to review
          </Button>
        }
      />

      {!allQ.isLoading && totalItems === 0 && !allQ.isError ? (
        <EmptyState
          icon={Download}
          step="Step 6 · Export"
          title="Nothing to export yet"
          description="Exports are built from reviewed answers. Generate answers and approve the good ones, then come back here."
          bullets={['JSON, JSONL, Alpaca and ShareGPT', 'Approved-only and minimum-score filters', 'Preview the exact rows before downloading']}
          action={
            <Button onClick={() => navigate(`/projects/${projectId}/dataset-review`)}>
              Go to review <ArrowRight />
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(320px,5fr)_7fr]">
          {/* Options */}
          <div className="space-y-5">
            <section className="space-y-2">
              <p className="eyebrow">Format</p>
              <FormatPicker value={type} onChange={setType} />
            </section>

            <section className="space-y-2">
              <p className="eyebrow">Rows</p>
              <div className="divide-y divide-line-hair border border-line">
                <label className="flex cursor-pointer items-start gap-3 px-3 py-3">
                  <Checkbox className="mt-0.5" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} />
                  <span>
                    <span className="block text-sm text-fg">Approved only</span>
                    <span className="block text-xs text-fg-muted">Leave on to ship only what you reviewed.</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 px-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm text-fg">Minimum quality score</span>
                    <span className="block text-xs text-fg-muted">0–1. Unscored items are excluded when set.</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    placeholder="any"
                    value={minScoreInput}
                    onChange={(e) => setMinScoreInput(e.target.value)}
                    className="h-8 w-24 text-right font-mono"
                    aria-label="Minimum quality score"
                  />
                </label>
              </div>
            </section>

            <section className="border border-line bg-bg-subtle p-4">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Ready to write</p>
                <p className="font-mono text-[11px] text-fg-muted">of {totalItems.toLocaleString()} items</p>
              </div>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="num text-3xl font-bold text-fg">{previewQ.isLoading ? '—' : matching.toLocaleString()}</span>
                <span className="font-display text-xs uppercase tracking-widest text-fg-muted">rows</span>
              </p>
              {approvedOnly && matching === 0 && !previewQ.isLoading && (
                <p className="mt-1 text-xs text-warning">No approved items match. Approve some in review, or untick “Approved only”.</p>
              )}
              <Button size="lg" className="mt-4 w-full" onClick={onExport} loading={busy} disabled={matching === 0}>
                {!busy && <Download />}
                {preparing && !activeDownload ? 'Preparing file…' : `Export ${formatDef(type).label}`}
              </Button>
              {(preparing || activeDownload) && (
                <div className="mt-3 space-y-1">
                  <Progress value={activeDownload ? activeDownload[1] : null} label="Export progress" />
                  <p className="font-mono text-[10.5px] text-fg-muted">
                    {activeDownload ? (activeDownload[1] == null ? 'Downloading…' : `Downloading ${activeDownload[1]}%`) : 'Writing file on the server…'}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Preview */}
          <div className="min-w-0">
            {previewQ.isError ? (
              <ErrorState error={previewQ.error} onRetry={() => void previewQ.refetch()} />
            ) : (
              <ExportPreview items={previewQ.data?.items ?? []} type={type} total={matching} loading={previewQ.isLoading} />
            )}
          </div>
        </div>
      )}

      <section className="border border-line">
        <div className="flex items-center justify-between border-b border-line bg-bg-subtle px-4 py-2.5">
          <p className="eyebrow text-fg">History</p>
          {exports.length > 0 && <span className="font-mono text-[10.5px] text-fg-muted">{plural(exportsQ.data?.pagination.total_items ?? exports.length, 'export')}</span>}
        </div>
        {exportsQ.isError ? (
          <ErrorState compact error={exportsQ.error} onRetry={() => void exportsQ.refetch()} className="m-3" />
        ) : (
          <ExportHistory exports={exports} downloads={downloads} onDownload={(ex) => void startDownload(ex)} onDelete={onDelete} />
        )}
      </section>
    </div>
  )
}
