import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACCEPT_ATTR } from './useUploadQueue'

export interface UploadDropzoneHandle {
  open: () => void
}

/** Large drag-and-drop target. Also keyboard-operable (Enter / Space opens the picker). */
const UploadDropzone = forwardRef<UploadDropzoneHandle, { onFiles: (files: File[]) => void; compact?: boolean }>(
  ({ onFiles, compact }, ref) => {
    const input = useRef<HTMLInputElement>(null)
    const [over, setOver] = useState(false)
    const depth = useRef(0)

    useImperativeHandle(ref, () => ({ open: () => input.current?.click() }))

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents: drop files here or press Enter to browse"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            input.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          depth.current += 1
          setOver(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current -= 1
          if (depth.current <= 0) setOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          depth.current = 0
          setOver(false)
          onFiles(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'grid-lines-light flex cursor-pointer flex-col items-center justify-center border border-dashed text-center transition-colors duration-150',
          compact ? 'px-6 py-6' : 'px-6 py-14',
          over ? 'border-accent bg-accent/5' : 'border-line-strong hover:border-fg-muted hover:bg-bg-subtle',
        )}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <div className={cn('grid place-items-center border border-line bg-bg', compact ? 'mb-2 size-9' : 'mb-4 size-11')}>
          <Upload className={cn('size-5', over ? 'text-accent' : 'text-fg-secondary')} strokeWidth={1.5} />
        </div>
        <p className="font-display text-sm font-bold">{over ? 'Drop to upload' : 'Drop files here or click to browse'}</p>
        <p className="mt-1 text-xs text-fg-muted">PDF · DOCX · Markdown · TXT — upload as many as you like</p>
      </div>
    )
  },
)
UploadDropzone.displayName = 'UploadDropzone'
export default UploadDropzone
