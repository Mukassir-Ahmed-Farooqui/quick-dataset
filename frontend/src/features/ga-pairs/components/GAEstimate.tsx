import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { gaPairsApi } from '@/api/ga_pairs'
import { useDebounce } from '@/hooks/useDebounce'
import type { GAGeneratePayload } from '@/types/api'

/** Live, debounced cost / count estimate for the current generation settings. */
export default function GAEstimate({ projectId, payload }: { projectId: string; payload: GAGeneratePayload | null }) {
  const debounced = useDebounce(payload, 400)
  const { data, isFetching, isError } = useQuery({
    queryKey: ['ga-estimate', projectId, debounced],
    queryFn: () => gaPairsApi.estimate(projectId, debounced!),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  })

  if (!payload) return null
  return (
    <div className="space-y-1 border border-line-hair bg-bg-subtle px-3 py-2 font-mono text-[11px] text-fg-secondary" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="eyebrow">Estimate</span>
        {isError ? (
          <span className="text-fg-muted">unavailable</span>
        ) : data ? (
          <>
            <span>≈ {data.estimated_item_count.toLocaleString()} pairs</span>
            <span>≈ {(data.estimated_input_tokens + data.estimated_output_tokens).toLocaleString()} tokens</span>
            <span className="text-fg">${data.estimated_cost_usd.toFixed(4)}</span>
          </>
        ) : (
          <span className="text-fg-muted">calculating…</span>
        )}
        {isFetching && <Loader2 className="ml-auto size-3 animate-spin text-fg-muted" aria-label="Updating estimate" />}
      </div>
      {data?.warning && (
        <p className="flex items-start gap-1.5 text-warning">
          <AlertTriangle className="mt-px size-3 shrink-0" /> {data.warning}
        </p>
      )}
    </div>
  )
}
