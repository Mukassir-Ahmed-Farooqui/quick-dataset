import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { friendlyError } from '@/lib/errors'
import { sonnerToast } from '@/lib/toast'
import { plural } from '@/lib/format'
import type { DocumentOut } from '@/types/api'

export const ACCEPTED_EXT = ['pdf', 'docx', 'md', 'txt'] as const
export const ACCEPT_ATTR = '.pdf,.docx,.md,.markdown,.txt'

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  key: string
  file: File
  progress: number // 0..100
  status: UploadStatus
  error?: string
}

const CONCURRENCY = 3
let seq = 0

function extOf(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'markdown' ? 'md' : ext
}

/**
 * Uploads files one request per file so each gets its own progress bar,
 * with a small concurrency limit and per-file retry.
 */
export function useUploadQueue(projectId: string) {
  const qc = useQueryClient()
  const [items, setItems] = useState<UploadItem[]>([])
  const active = useRef(0)
  const queue = useRef<UploadItem[]>([])
  const batch = useRef({ ok: 0, failed: 0 })

  const patch = useCallback((key: string, p: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)))
  }, [])

  const finishBatchIfIdle = useCallback(() => {
    if (active.current > 0 || queue.current.length > 0) return
    const { ok, failed } = batch.current
    batch.current = { ok: 0, failed: 0 }
    if (ok > 0) {
      sonnerToast.success(`${plural(ok, 'file')} uploaded`, {
        description: failed ? `${failed} failed — retry them below.` : 'Parsing runs in the background; status updates live.',
      })
    } else if (failed > 0) {
      sonnerToast.error('Upload failed', { description: 'Retry the files below.' })
    }
    // Clear finished rows after a moment; keep errors so they can be retried.
    setTimeout(() => setItems((prev) => prev.filter((i) => i.status !== 'done')), 2500)
  }, [])

  const pump = useCallback(() => {
    const step = () => {
    while (active.current < CONCURRENCY && queue.current.length > 0) {
      const item = queue.current.shift()!
      active.current += 1
      patch(item.key, { status: 'uploading', progress: 0, error: undefined })
      const form = new FormData()
      form.append('files', item.file)
      apiClient
        .post<DocumentOut[]>(`/projects/${projectId}/documents/upload`, form, {
          onUploadProgress: (e) => {
            if (e.total) patch(item.key, { progress: Math.min(99, Math.round((e.loaded / e.total) * 100)) })
          },
        })
        .then(() => {
          batch.current.ok += 1
          patch(item.key, { status: 'done', progress: 100 })
          qc.invalidateQueries({ queryKey: ['documents', projectId] })
          qc.invalidateQueries({ queryKey: ['project', projectId] })
        })
        .catch((err) => {
          batch.current.failed += 1
          patch(item.key, { status: 'error', error: friendlyError(err).message })
        })
        .finally(() => {
          active.current -= 1
          step()
          finishBatchIfIdle()
        })
    }
    }
    step()
  }, [projectId, patch, qc, finishBatchIfIdle])

  const add = useCallback(
    (files: File[]) => {
      const accepted: UploadItem[] = []
      const rejected: string[] = []
      for (const file of files) {
        if ((ACCEPTED_EXT as readonly string[]).includes(extOf(file.name))) {
          accepted.push({ key: `u${++seq}`, file, progress: 0, status: 'waiting' })
        } else rejected.push(file.name)
      }
      if (rejected.length) {
        sonnerToast.error(`Skipped ${plural(rejected.length, 'file')}`, {
          description: `${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''} — only PDF, DOCX, Markdown and TXT are supported.`,
        })
      }
      if (!accepted.length) return
      setItems((prev) => [...prev, ...accepted])
      queue.current.push(...accepted)
      pump()
    },
    [pump],
  )

  const retry = useCallback(
    (key: string) => {
      const item = items.find((i) => i.key === key)
      if (!item) return
      patch(key, { status: 'waiting', progress: 0, error: undefined })
      queue.current.push(item)
      pump()
    },
    [items, patch, pump],
  )

  const dismiss = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), [])

  const busy = items.some((i) => i.status === 'waiting' || i.status === 'uploading')
  return { items, add, retry, dismiss, busy }
}
