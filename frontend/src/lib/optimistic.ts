import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { PageEnvelope } from '@/types/api'

type Snapshot = Array<[QueryKey, unknown]>

/**
 * Apply `update` to every cached paged list under `queryKey` (prefix match) and
 * return a snapshot for rollback. Used for instant UI on edits/deletes/confirms.
 */
export async function patchPagedLists<T extends { id: string }>(
  qc: QueryClient,
  queryKey: QueryKey,
  update: (items: T[]) => T[],
): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey })
  const snapshot = qc.getQueriesData({ queryKey })
  qc.setQueriesData<PageEnvelope<T>>({ queryKey }, (old) => {
    if (!old || !Array.isArray(old.items)) return old
    const items = update(old.items)
    const removed = old.items.length - items.length
    return {
      ...old,
      items,
      pagination: old.pagination
        ? { ...old.pagination, total_items: Math.max(0, old.pagination.total_items - removed) }
        : old.pagination,
    }
  })
  return snapshot
}

export function restore(qc: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data))
}

export const removeIds = <T extends { id: string }>(ids: string[] | Set<string>): ((items: T[]) => T[]) => {
  const set = ids instanceof Set ? ids : new Set(ids)
  return (items: T[]) => items.filter((i) => !set.has(i.id))
}

export const patchIds = <T extends { id: string }>(ids: string[] | Set<string>, patch: Partial<T>): ((items: T[]) => T[]) => {
  const set = ids instanceof Set ? ids : new Set(ids)
  return (items: T[]) => items.map((i) => (set.has(i.id) ? { ...i, ...patch } : i))
}
