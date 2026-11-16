import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Loader2, X, XCircle } from 'lucide-react'
import { useTaskPoll, useCancelTask } from '@/hooks/useQuestions'
import { useElapsed } from '@/hooks/useElapsed'
import { keysForKind, untrackTask, type TrackedTask } from '@/lib/tasks'
import { formatElapsed } from '@/lib/format'
import { sonnerToast, toastError } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const TERMINAL = new Set(['done', 'failed', 'cancelled'])

/** Inline progress for one background task: live counts, ETA, cancel, completion toast. */
export default function TaskProgress({ task }: { task: TrackedTask }) {
  const qc = useQueryClient()
  const { data, isError, error } = useTaskPoll(task.id, true)
  const cancel = useCancelTask()
  const status = data?.status ?? 'queued'
  const terminal = TERMINAL.has(status)
  const elapsed = useElapsed(task.startedAt, !terminal)
  const notified = useRef(false)

  const total = data?.total_count ?? 0
  const done = data?.completed_count ?? 0
  const pct = total > 0 ? (done / total) * 100 : null
  const rate = elapsed > 0 ? done / elapsed : 0
  const eta = rate > 0 && total > done ? Math.round((total - done) / rate) : null

  // Refresh data as results stream in, and once more when finished.
  useEffect(() => {
    if (done > 0) keysForKind(task.kind, task.projectId).forEach((k) => qc.invalidateQueries({ queryKey: k }))
  }, [done, task.kind, task.projectId, qc])

  useEffect(() => {
    if (!terminal || notified.current || !data) return
    notified.current = true
    keysForKind(task.kind, task.projectId).forEach((k) => qc.invalidateQueries({ queryKey: k }))
    if (status === 'done') {
      sonnerToast.success(`${task.label} — done`, {
        description: `${data.completed_count.toLocaleString()} processed${data.error_count ? `, ${data.error_count} errors` : ''} in ${formatElapsed(elapsed)}.`,
      })
      const t = setTimeout(() => untrackTask(task.id), 6000)
      return () => clearTimeout(t)
    }
    if (status === 'failed') {
      sonnerToast.error(`${task.label} failed`, { description: data.error_log?.[0]?.message ?? 'See the error details below.' })
    }
    if (status === 'cancelled') sonnerToast(`${task.label} cancelled`)
  }, [terminal, status, data, task, qc, elapsed])

  // Task no longer exists (e.g. server restarted).
  useEffect(() => {
    if (isError) {
      const t = setTimeout(() => untrackTask(task.id), 4000)
      return () => clearTimeout(t)
    }
  }, [isError, task.id])

  const onCancel = () =>
    cancel.mutate(task.id, { onError: (err) => toastError('Could not cancel task', err) })

  const tone = status === 'failed' ? 'danger' : status === 'done' ? 'success' : status === 'cancelled' ? 'fg' : 'accent'

  return (
    <div
      className={cn(
        'border bg-bg px-4 py-3 animate-slide-up',
        status === 'failed' ? 'border-danger/40' : status === 'done' ? 'border-success/40' : 'border-line',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        {status === 'done' ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : status === 'failed' ? (
          <XCircle className="size-4 text-danger" />
        ) : status === 'cancelled' ? (
          <Ban className="size-4 text-fg-muted" />
        ) : (
          <Loader2 className="size-4 animate-spin text-accent" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-display text-xs font-bold">
              {task.label}
              <span className="ml-2 font-normal uppercase tracking-widest text-fg-muted">{isError ? 'unknown' : status}</span>
            </p>
            <p className="num shrink-0 text-xs text-fg-secondary">{pct !== null ? `${Math.round(pct)}%` : '—'}</p>
          </div>
          <Progress value={terminal ? 100 : pct} tone={tone} className="mt-2" label={task.label} />
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-fg-muted">
            <span>
              {done.toLocaleString()} / {total ? total.toLocaleString() : '…'}
            </span>
            {!terminal && <span>elapsed {formatElapsed(elapsed)}</span>}
            {!terminal && <span>{eta !== null ? `~${formatElapsed(eta)} left` : 'estimating…'}</span>}
            {!!data?.error_count && <span className="text-danger">{data.error_count} errors</span>}
            {isError && <span className="text-danger">{error instanceof Error ? error.message : 'Lost track of task'}</span>}
          </div>
          {status === 'failed' && data?.error_log?.[0] && (
            <p className="mt-1.5 line-clamp-2 font-mono text-[11px] text-danger">{data.error_log[0].message}</p>
          )}
        </div>
        {!terminal && !isError ? (
          <Button variant="outline" size="xs" onClick={onCancel} loading={cancel.isPending}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={() => untrackTask(task.id)} aria-label="Dismiss">
            <X />
          </Button>
        )}
      </div>
    </div>
  )
}

export function TaskTray({ tasks, className }: { tasks: TrackedTask[]; className?: string }) {
  if (tasks.length === 0) return null
  return (
    <div className={cn('space-y-2', className)}>
      {tasks.map((t) => (
        <TaskProgress key={t.id} task={t} />
      ))}
    </div>
  )
}
