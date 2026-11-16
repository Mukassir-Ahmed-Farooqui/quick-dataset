import { CheckCircle2, Loader2, RotateCw, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '@/lib/format'
import type { UploadItem } from './useUploadQueue'

/** Per-file upload progress. */
export default function UploadQueue({ items, onRetry, onDismiss }: { items: UploadItem[]; onRetry: (key: string) => void; onDismiss: (key: string) => void }) {
  if (items.length === 0) return null
  return (
    <ul className="divide-y divide-line-hair border border-line" aria-label="Uploads" aria-live="polite">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-3 px-4 py-2.5 animate-slide-up">
          {i.status === 'done' ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" />
          ) : i.status === 'error' ? (
            <XCircle className="size-4 shrink-0 text-danger" />
          ) : (
            <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm">{i.file.name}</p>
              <p className="num shrink-0 text-[11px] text-fg-muted">
                {i.status === 'error' ? 'failed' : i.status === 'waiting' ? 'waiting' : `${i.progress}%`} · {formatBytes(i.file.size)}
              </p>
            </div>
            {i.status === 'error' ? (
              <p className="mt-1 truncate text-xs text-danger">{i.error}</p>
            ) : (
              <Progress
                value={i.status === 'waiting' ? 0 : i.progress}
                tone={i.status === 'done' ? 'success' : 'accent'}
                className="mt-1.5 h-1"
                label={`Uploading ${i.file.name}`}
              />
            )}
          </div>
          {i.status === 'error' && (
            <>
              <Button variant="outline" size="xs" onClick={() => onRetry(i.key)}>
                <RotateCw /> Retry
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onDismiss(i.key)} aria-label={`Dismiss ${i.file.name}`}>
                <X />
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
