import { apiClient } from '@/api/client'
import type { DatasetItemOut, ExportCreate, ExportOut } from '@/types/api'

export type ExportType = ExportCreate['export_type']

export interface FormatDef {
  value: ExportType
  label: string
  ext: 'json' | 'jsonl'
  blurb: string
  shape: string
}

/** Every format the export API accepts (ExportCreate.export_type). */
export const FORMATS: FormatDef[] = [
  { value: 'jsonl', label: 'JSONL', ext: 'jsonl', blurb: 'One JSON object per line. Streams well; most fine-tuning tools take it.', shape: '{…}\\n{…}' },
  { value: 'json', label: 'JSON', ext: 'json', blurb: 'A single array of payload objects, with id and score.', shape: '[{…}, {…}]' },
  { value: 'alpaca', label: 'Alpaca', ext: 'json', blurb: 'instruction / input / output triples for instruction tuning.', shape: 'instruction·input·output' },
  { value: 'sharegpt', label: 'ShareGPT', ext: 'json', blurb: 'Chat turns (human → gpt) for conversational fine-tuning.', shape: 'conversations[]' },
]

export const formatDef = (t: string) => FORMATS.find((f) => f.value === t) ?? FORMATS[0]

const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const optionsText = (opts: unknown) => (Array.isArray(opts) ? opts.map((o, i) => `${String.fromCharCode(65 + i)}. ${s(o)}`).join('\n') : '')

/** Client-side mirror of the backend writers, used for the preview only. */
function toRow(item: DatasetItemOut, type: ExportType): unknown {
  const p = item.payload
  if (type === 'json' || type === 'jsonl') {
    const row: Record<string, unknown> = { ...p, id: item.id }
    if (item.score != null) row.score = item.score
    return row
  }
  if (type === 'alpaca') {
    if (item.dataset_type === 'qa') return { instruction: s(p.question), input: '', output: s(p.answer) }
    if (item.dataset_type === 'mcq') return { instruction: s(p.question), input: optionsText(p.options), output: s(p.correct_answer) }
    return { instruction: s(p.text), input: '', output: s(p.label) }
  }
  if (item.dataset_type === 'qa')
    return { conversations: [{ from: 'human', value: s(p.question) }, { from: 'gpt', value: s(p.answer) }] }
  if (item.dataset_type === 'mcq')
    return { conversations: [{ from: 'human', value: `${s(p.question)}\n\n${optionsText(p.options)}` }, { from: 'gpt', value: s(p.correct_answer) }] }
  return { conversations: [{ from: 'human', value: s(p.text) }, { from: 'gpt', value: s(p.label) }] }
}

export function renderPreview(items: DatasetItemOut[], type: ExportType): string {
  const rows = items.map((i) => toRow(i, type))
  if (type === 'jsonl') return rows.map((r) => JSON.stringify(r)).join('\n')
  return JSON.stringify(rows, null, 2)
}

export function exportFilename(ex: Pick<ExportOut, 'export_type' | 'created_at'>) {
  const d = new Date(ex.created_at)
  const stamp = Number.isNaN(d.getTime()) ? 'export' : d.toISOString().slice(0, 16).replace(/[:T]/g, '-')
  return `dataset-${ex.export_type}-${stamp}.${formatDef(ex.export_type).ext}`
}

/**
 * Download an export with byte progress. Same endpoint as exportsApi.download,
 * called directly so axios can report onDownloadProgress.
 */
export async function downloadExport(projectId: string, ex: ExportOut, onProgress: (pct: number | null) => void) {
  const res = await apiClient.get<Blob>(`/projects/${projectId}/exports/${ex.id}/download`, {
    responseType: 'blob',
    onDownloadProgress: (e) => onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null),
  })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFilename(ex)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
