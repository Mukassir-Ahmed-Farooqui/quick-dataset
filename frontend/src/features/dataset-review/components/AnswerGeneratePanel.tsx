import { useState } from 'react'
import { Calculator, FileText, ListChecks, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, Select } from '@/components/ui/input'
import { useEstimateAnswers, useGenerateAnswers } from '@/hooks/useDatasetItems'
import { trackTask } from '@/lib/tasks'
import { sonnerToast, toastError } from '@/lib/toast'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnswerGeneratePayload, GenerationEstimateResponse, QuestionStatsDocument } from '@/types/api'

type DatasetType = NonNullable<AnswerGeneratePayload['dataset_type']>

const TYPES: Array<{ value: DatasetType; label: string }> = [
  { value: 'qa', label: 'Question & answer' },
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'classification', label: 'Classification' },
]

const docKey = (d: QuestionStatsDocument) => d.document_id ?? 'unknown'

export default function AnswerGeneratePanel({
  projectId,
  documents,
  onClose,
}: {
  projectId: string
  documents: QuestionStatsDocument[]
  onClose?: () => void
}) {
  // `null` = every document with unanswered questions (smart default).
  const [docSel, setDocSel] = useState<string[] | null>(null)
  const [type, setType] = useState<DatasetType>('qa')
  const [estimate, setEstimate] = useState<GenerationEstimateResponse | null>(null)

  const withOpen = documents.filter((d) => d.unanswered_count > 0)
  const selectedKeys = docSel ?? withOpen.map(docKey)
  const questionIds = withOpen.filter((d) => selectedKeys.includes(docKey(d))).flatMap((d) => d.unanswered_question_ids)

  const generate = useGenerateAnswers(projectId)
  const estimateM = useEstimateAnswers(projectId)
  const payload = (): AnswerGeneratePayload => ({ question_ids: questionIds, dataset_type: type })

  const onEstimate = () =>
    estimateM.mutate(payload(), {
      onSuccess: setEstimate,
      onError: (err) => toastError('Could not estimate', err, onEstimate),
    })

  const onGenerate = () =>
    generate.mutate(payload(), {
      onSuccess: (r) => {
        trackTask({ id: r.task_id, projectId, kind: 'answers', label: `Answering ${plural(questionIds.length, 'question')}` })
        sonnerToast.success('Answer generation started', { description: 'Items appear here as they are written.' })
        setEstimate(null)
        onClose?.()
      },
      onError: (err) => toastError('Could not start answer generation', err, onGenerate),
    })

  return (
    <section className="border border-line bg-bg" aria-labelledby="agen-title">
      <div className="flex items-center justify-between border-b border-line-hair bg-bg-subtle px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ListChecks className="size-3.5 text-accent" />
          <h2 id="agen-title" className="eyebrow text-fg">
            Generate answers
          </h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        )}
      </div>

      <div className="grid gap-px bg-line-hair md:grid-cols-[2fr_1fr]">
        <div className="bg-bg p-4">
          <p className="eyebrow mb-2">Unanswered questions by document</p>
          {withOpen.length === 0 ? (
            <p className="text-sm text-fg-muted">Every question has an answer.</p>
          ) : (
            <ul className="max-h-48 divide-y divide-line-hair overflow-y-auto border border-line-hair">
              {withOpen.map((d) => {
                const k = docKey(d)
                const on = selectedKeys.includes(k)
                return (
                  <li key={k}>
                    <label className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-bg-subtle', on && 'bg-paper/50')}>
                      <Checkbox
                        checked={on}
                        onChange={() => {
                          setDocSel(on ? selectedKeys.filter((x) => x !== k) : [...selectedKeys, k])
                          setEstimate(null)
                        }}
                      />
                      <FileText className="size-3.5 text-fg-muted" />
                      <span className="min-w-0 flex-1 truncate">{d.document_filename ?? 'Unknown document'}</span>
                      <span className="num text-[11px] text-fg-muted">{d.unanswered_count}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="space-y-3 bg-bg p-4">
          <label className="block space-y-1.5">
            <span className="eyebrow block">Dataset type</span>
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value as DatasetType)
                setEstimate(null)
              }}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>
          <p className="font-mono text-xs text-fg-secondary">
            <span className="num text-sm text-fg">{questionIds.length.toLocaleString()}</span> questions selected
          </p>
          {estimate && (
            <p className="font-mono text-xs text-fg-secondary">
              ≈ <span className="num text-fg">{estimate.estimated_item_count.toLocaleString()}</span> items ·{' '}
              <span className="num text-fg">${estimate.estimated_cost_usd.toFixed(4)}</span>
              {estimate.warning && <span className="mt-1 block text-warning">{estimate.warning}</span>}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onEstimate} loading={estimateM.isPending} disabled={questionIds.length === 0}>
              <Calculator /> Estimate
            </Button>
            <Button size="sm" className="flex-1" onClick={onGenerate} loading={generate.isPending} disabled={questionIds.length === 0}>
              <ListChecks /> Generate
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
