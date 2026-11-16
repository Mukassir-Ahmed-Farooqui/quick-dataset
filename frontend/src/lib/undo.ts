import { toast } from 'sonner'
import { toastError } from '@/lib/toast'

interface UndoableOptions {
  /** Toast text, e.g. "Question deleted" */
  message: string
  /** Apply the change locally right away (optimistic). */
  apply: () => void | Promise<void>
  /** Restore local state if undone or if commit fails. */
  rollback: () => void
  /** Perform the real API call once the undo window closes. */
  commit: () => Promise<unknown>
  /** Called after a successful commit (e.g. invalidate queries). */
  onCommitted?: () => void
  duration?: number
}

const pending = new Map<string, () => void>()
let seq = 0

// Flush pending commits if the tab closes so deletes are not silently lost.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => pending.forEach((flush) => flush()))
}

/**
 * Delete-with-undo: the item disappears immediately, a toast offers Undo for a few
 * seconds, and only then the API call is made. Replaces confirm dialogs for
 * reversible, single-item or bulk deletes.
 */
export async function undoable({ message, apply, rollback, commit, onCommitted, duration = 5000 }: UndoableOptions) {
  const id = `undo-${++seq}`
  let settled = false
  await apply()

  const flush = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    pending.delete(id)
    commit()
      .then(() => onCommitted?.())
      .catch((err) => {
        rollback()
        toastError('Could not delete', err)
      })
  }

  const timer = setTimeout(flush, duration)
  pending.set(id, flush)

  toast(message, {
    id,
    duration,
    action: {
      label: 'Undo',
      onClick: () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        pending.delete(id)
        rollback()
      },
    },
  })
}
