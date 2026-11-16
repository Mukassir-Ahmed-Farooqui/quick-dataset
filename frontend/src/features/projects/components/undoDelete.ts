import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { patchPagedLists, removeIds, restore } from '@/lib/optimistic'
import { undoable } from '@/lib/undo'

interface UndoDeleteOptions {
  /** Prefix of the paged list queries the rows live in, e.g. ['chunks', projectId]. */
  listKey: QueryKey
  ids: string[]
  message: string
  remove: (id: string) => Promise<unknown>
  /** Extra queries to refresh once the delete is committed. */
  invalidate?: QueryKey[]
  onApplied?: () => void
}

/**
 * Optimistically drop rows from every cached page, show an Undo toast, and only
 * call the API once the undo window closes.
 */
export function undoDelete<T extends { id: string }>(qc: QueryClient, opts: UndoDeleteOptions) {
  let snapshot: Awaited<ReturnType<typeof patchPagedLists>> | undefined
  return undoable({
    message: opts.message,
    apply: async () => {
      snapshot = await patchPagedLists<T>(qc, opts.listKey, removeIds<T>(opts.ids))
      opts.onApplied?.()
    },
    rollback: () => restore(qc, snapshot),
    commit: () => Promise.all(opts.ids.map((id) => opts.remove(id))),
    onCommitted: () => {
      for (const key of [opts.listKey, ...(opts.invalidate ?? [])]) qc.invalidateQueries({ queryKey: key })
    },
  })
}
