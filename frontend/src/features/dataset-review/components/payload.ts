import type { DatasetItemOut } from '@/types/api'

export type ReviewStatus = '' | 'pending' | 'approved'

export interface ReviewFilters {
  status: ReviewStatus
  type: '' | DatasetItemOut['dataset_type']
  minScore: string
}

export const EMPTY_REVIEW_FILTERS: ReviewFilters = { status: '', type: '', minScore: '' }

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v))

/** The prompt side of an item, whatever its dataset type. */
export function promptOf(item: DatasetItemOut): string {
  const p = item.payload
  if (item.dataset_type === 'classification') return str(p.text)
  if (item.dataset_type === 'conversation') {
    const turns = Array.isArray(p.conversations) ? p.conversations : Array.isArray(p.messages) ? p.messages : []
    const first = turns[0] as Record<string, unknown> | undefined
    return str(first?.value ?? first?.content ?? p.question)
  }
  return str(p.question)
}

/** The payload key that holds the answer, for inline editing. Null = edit raw JSON. */
export function answerKey(item: DatasetItemOut): string | null {
  switch (item.dataset_type) {
    case 'qa':
      return 'answer'
    case 'mcq':
      return 'correct_answer'
    case 'classification':
      return 'label'
    default:
      return null
  }
}

export function answerOf(item: DatasetItemOut): string {
  const k = answerKey(item)
  return k ? str(item.payload[k]) : JSON.stringify(item.payload, null, 2)
}

/** Chain-of-thought lives on the item; older payloads carried it inline. */
export function cotOf(item: DatasetItemOut): string | null {
  const c = item.cot ?? item.payload.cot
  return typeof c === 'string' && c.trim() ? c : null
}

export function scoreTone(score: number | null | undefined): 'success' | 'warning' | 'danger' | 'none' {
  if (score == null) return 'none'
  if (score >= 0.8) return 'success'
  if (score >= 0.5) return 'warning'
  return 'danger'
}
