import type { LucideIcon } from 'lucide-react'
import { FileText, Layers, Tags, MessageSquare, ListChecks, Download } from 'lucide-react'
import type { PipelineProgress } from '@/types/api'

export type StepKey = 'documents' | 'chunks' | 'ga-pairs' | 'questions' | 'dataset-review' | 'export'

export interface StepDef {
  key: StepKey
  label: string
  short: string
  icon: LucideIcon
  path: StepKey
  optional?: boolean
  blurb: string
}

export const STEPS: StepDef[] = [
  { key: 'documents', label: 'Documents', short: 'Docs', icon: FileText, path: 'documents', blurb: 'Upload the source files your dataset is built from.' },
  { key: 'chunks', label: 'Chunks', short: 'Chunks', icon: Layers, path: 'chunks', blurb: 'Split parsed text into passages the model can read in one go.' },
  { key: 'ga-pairs', label: 'GA Pairs', short: 'GA', icon: Tags, path: 'ga-pairs', optional: true, blurb: 'Genre × audience lenses that make questions more varied.' },
  { key: 'questions', label: 'Questions', short: 'Qs', icon: MessageSquare, path: 'questions', blurb: 'Generate questions from every chunk (and lens).' },
  { key: 'dataset-review', label: 'Answers', short: 'Review', icon: ListChecks, path: 'dataset-review', blurb: 'Generate answers, then approve or reject each pair.' },
  { key: 'export', label: 'Export', short: 'Export', icon: Download, path: 'export', blurb: 'Download the approved items as JSON, JSONL, Alpaca or ShareGPT.' },
]

export interface StepState {
  def: StepDef
  count: number
  sub?: string
  done: boolean
}

export function stepStates(p: PipelineProgress | undefined, exportsCount = 0): StepState[] {
  const pr = p ?? { documents: 0, chunks: 0, ga_pairs: 0, questions: 0, questions_reviewed: 0, dataset_items: 0, dataset_items_confirmed: 0 }
  const values: Record<StepKey, { count: number; sub?: string; done: boolean }> = {
    documents: { count: pr.documents, done: pr.documents > 0 },
    chunks: { count: pr.chunks, done: pr.chunks > 0 },
    'ga-pairs': { count: pr.ga_pairs, done: pr.ga_pairs > 0 },
    questions: { count: pr.questions, done: pr.questions > 0 },
    'dataset-review': {
      count: pr.dataset_items,
      sub: pr.dataset_items > 0 ? `${pr.dataset_items_confirmed} approved` : undefined,
      done: pr.dataset_items > 0 && pr.dataset_items_confirmed > 0,
    },
    export: { count: exportsCount, done: exportsCount > 0 },
  }
  return STEPS.map((def) => ({ def, ...values[def.key] }))
}

export interface NextAction {
  step: StepKey
  label: string
  hint: string
}

/** The single most useful thing to do next for this project. */
export function nextAction(p: PipelineProgress | undefined, exportsCount = 0): NextAction {
  const pr = p
  if (!pr || pr.documents === 0) return { step: 'documents', label: 'Upload documents', hint: 'Start with a PDF, DOCX, Markdown or TXT file.' }
  if (pr.chunks === 0) return { step: 'chunks', label: 'Create chunks', hint: 'Defaults work well for most documents.' }
  if (pr.ga_pairs === 0 && pr.questions === 0)
    return { step: 'ga-pairs', label: 'Generate GA pairs', hint: 'Optional, but makes questions far more diverse.' }
  if (pr.questions === 0) return { step: 'questions', label: 'Generate questions', hint: 'One click uses every chunk and lens.' }
  if (pr.dataset_items === 0) return { step: 'dataset-review', label: 'Generate answers', hint: `${pr.questions.toLocaleString()} questions are waiting for answers.` }
  const pending = pr.dataset_items - pr.dataset_items_confirmed
  if (pr.dataset_items_confirmed === 0 || (pending > 0 && exportsCount === 0))
    return { step: 'dataset-review', label: 'Review answers', hint: `${pending.toLocaleString()} answers to approve or reject.` }
  if (exportsCount === 0) return { step: 'export', label: 'Export dataset', hint: `${pr.dataset_items_confirmed.toLocaleString()} approved items ready.` }
  return { step: 'export', label: 'Export again', hint: 'Your dataset is exported. Re-export after more review.' }
}
