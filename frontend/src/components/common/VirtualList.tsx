import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

export interface VirtualListHandle {
  scrollToIndex: (index: number) => void
}

interface VirtualListProps<T> {
  items: T[]
  getKey: (item: T) => string
  estimateSize?: number
  overscan?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  /** Accessible label for the list */
  label?: string
}

/**
 * Windowed list with dynamic row heights. Only visible rows render, so a page of
 * several hundred questions/items stays smooth.
 */
function VirtualListInner<T>(
  { items, getKey, estimateSize = 72, overscan = 8, renderItem, className, label }: VirtualListProps<T>,
  ref: React.Ref<VirtualListHandle>,
) {
  const parentRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (i) => getKey(items[i]),
  })

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => virtualizer.scrollToIndex(index, { align: 'auto' }),
  }))

  return (
    <div ref={parentRef} className={cn('overflow-y-auto overscroll-contain', className)} role="list" aria-label={label}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            role="listitem"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}
          >
            {renderItem(items[v.index], v.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListHandle> },
) => ReturnType<typeof VirtualListInner>

export default VirtualList
