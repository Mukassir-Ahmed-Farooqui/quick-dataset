import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExportOut } from '@/types/api'
import { exportFilename } from './formats'

/** Download progress per export id: number = %, null = indeterminate. */
export type DownloadState = Record<string, number | null>

interface Props {
  exports: ExportOut[]
  downloads: DownloadState
  onDownload: (ex: ExportOut) => void
  onDelete: (ex: ExportOut) => void
}

function describeFilter(ex: ExportOut) {
  const f = ex.filter_snapshot ?? {}
  const parts = [f.confirmed ? 'approved' : 'all items']
  if (f.min_score != null) parts.push(`score ≥ ${f.min_score}`)
  return parts.join(' · ')
}

export default function ExportHistory({ exports, downloads, onDownload, onDelete }: Props) {
  if (exports.length === 0) return <p className="px-4 py-6 text-sm text-fg-muted">No exports yet. Your first file appears here.</p>

  return (
    <ul className="divide-y divide-line-hair">
      {exports.map((ex) => {
        const dl = ex.id in downloads ? downloads[ex.id] : undefined
        const downloading = dl !== undefined
        return (
          <li key={ex.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 font-display text-[11px] font-bold uppercase tracking-wider text-fg">{ex.export_type}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-fg-secondary" title={exportFilename(ex)}>
                  {exportFilename(ex)}
                </p>
                <p className="mt-0.5 font-mono text-[10.5px] text-fg-muted">
                  {describeFilter(ex)} · {ex.row_count != null ? `${ex.row_count.toLocaleString()} rows` : '— rows'} · {timeAgo(ex.created_at)}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 font-display text-[10.5px] font-bold uppercase tracking-wider',
                  ex.status === 'ready' ? 'text-success' : ex.status === 'failed' ? 'text-danger' : 'text-fg-muted',
                )}
              >
                {ex.status === 'generating' && <Loader2 className="size-3 animate-spin" />}
                {ex.status === 'failed' && <AlertTriangle className="size-3" />}
                {ex.status}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={ex.status !== 'ready'}
                loading={downloading}
                onClick={() => onDownload(ex)}
                aria-label={`Download ${ex.export_type} export`}
              >
                {!downloading && <Download />} {downloading ? (dl == null ? '…' : `${dl}%`) : 'Download'}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onDelete(ex)} aria-label="Delete export" className="hover:text-danger">
                <Trash2 />
              </Button>
            </div>
            {downloading && <Progress value={dl} className="mt-2 h-1" label="Download progress" />}
          </li>
        )
      })}
    </ul>
  )
}
