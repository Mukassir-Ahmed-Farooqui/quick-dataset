import { useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { WindowFrame } from '@/components/ui/window-frame'
import type { DatasetItemOut } from '@/types/api'
import { formatDef, renderPreview, type ExportType } from './formats'

interface Props {
  items: DatasetItemOut[]
  type: ExportType
  total: number
  loading?: boolean
}

/** First rows of the file as it will be written, in a window-frame panel. */
export default function ExportPreview({ items, type, total, loading }: Props) {
  const text = useMemo(() => renderPreview(items, type), [items, type])
  const def = formatDef(type)
  const lines = text ? text.split('\n') : []

  return (
    <WindowFrame
      title={`dataset.${def.ext}`}
      right={
        <span className="font-mono text-[10.5px] text-fg-muted">
          {items.length} of {total.toLocaleString()} rows
        </span>
      }
      className="h-full min-h-[360px]"
      bodyClassName="overflow-auto bg-bg"
    >
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${40 + ((i * 23) % 55)}%` }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="grid h-full min-h-[300px] place-items-center p-6 text-center text-sm text-fg-muted">No rows match these filters.</div>
      ) : (
        <pre className="max-h-[560px] py-3 font-mono text-[11.5px] leading-[1.65] text-fg-secondary">
          {lines.map((l, i) => (
            <div key={i} className="flex hover:bg-bg-subtle">
              <span className="w-10 shrink-0 select-none pr-3 text-right text-fg-subtle">{i + 1}</span>
              <span className="whitespace-pre pr-4">{l}</span>
            </div>
          ))}
          {total > items.length && <div className="pl-10 pt-1 text-fg-subtle">… {(total - items.length).toLocaleString()} more rows</div>}
        </pre>
      )}
    </WindowFrame>
  )
}
