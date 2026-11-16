import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react'
import Collapsible from '@/components/common/Collapsible'
import InlineEdit from '@/components/common/InlineEdit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DatasetItemOut } from '@/types/api'
import ScoreMeter from './ScoreMeter'
import { answerKey, answerOf, cotOf, promptOf } from './payload'

interface ItemDetailProps {
  item: DatasetItemOut
  position: { index: number; total: number }
  editing: boolean
  saving?: boolean
  onEdit: (on: boolean) => void
  onSaveAnswer: (value: string) => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onPrev: () => void
  onNext: () => void
}

function Block({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  )
}

export default function ItemDetail({ item, position, editing, saving, onEdit, onSaveAnswer, onApprove, onReject, onDelete, onPrev, onNext }: ItemDetailProps) {
  const p = item.payload
  const cot = cotOf(item)
  const options = Array.isArray(p.options) ? (p.options as unknown[]).map(String) : []
  const key = answerKey(item)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line bg-bg-subtle px-4 py-2">
        <span className="num text-[11px] text-fg-muted">
          {position.index + 1} / {position.total}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onPrev} disabled={position.index <= 0} aria-label="Previous item (k)">
          <ChevronUp />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onNext} disabled={position.index >= position.total - 1} aria-label="Next item (j)">
          <ChevronDown />
        </Button>
        <Badge variant={item.confirmed ? 'success' : 'outline'} dot>
          {item.confirmed ? 'Approved' : 'Pending'}
        </Badge>
        <Badge variant="default">{item.dataset_type}</Badge>
        <span className="ml-auto flex items-center gap-2">
          <span className="eyebrow text-[9.5px]">Quality</span>
          <ScoreMeter score={item.score} />
        </span>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Block label={item.dataset_type === 'classification' ? 'Text' : 'Question'}>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{promptOf(item) || '—'}</p>
        </Block>

        {item.dataset_type === 'mcq' && options.length > 0 && (
          <Block label="Options">
            <ol className="divide-y divide-line-hair border border-line-hair">
              {options.map((o, i) => {
                const correct = o === p.correct_answer
                return (
                  <li key={i} className={cn('flex items-start gap-3 px-3 py-2 text-sm', correct && 'bg-success/[0.06]')}>
                    <span className="num w-4 text-fg-muted">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{o}</span>
                    {correct && <Check className="size-3.5 text-success" aria-label="Correct answer" />}
                  </li>
                )
              })}
            </ol>
          </Block>
        )}

        <Block label={key === 'label' ? 'Label' : key === 'correct_answer' ? 'Correct answer' : key ? 'Answer' : 'Payload (JSON)'}>
          {editing ? (
            <InlineEdit value={answerOf(item)} rows={key ? 6 : 12} label="Edit answer" saving={saving} onCancel={() => onEdit(false)} onSave={onSaveAnswer} />
          ) : (
            <div
              className={cn(
                'group relative cursor-text border border-transparent px-0 py-0 hover:border-line-hair',
                key ? 'whitespace-pre-wrap text-sm leading-relaxed text-fg' : 'font-mono text-xs text-fg-secondary',
              )}
              onDoubleClick={() => onEdit(true)}
              title="Double-click or press e to edit"
            >
              {key ? answerOf(item) || <span className="text-fg-subtle">No answer</span> : <pre className="whitespace-pre-wrap">{answerOf(item)}</pre>}
            </div>
          )}
        </Block>

        {cot && (
          <Collapsible label="Chain of thought" hint={`${item.cot_source || 'model'} · ${cot.length.toLocaleString()} chars`}>
            <p className="whitespace-pre-wrap border-l border-line pl-3 font-mono text-xs leading-relaxed text-fg-secondary">{cot}</p>
          </Collapsible>
        )}

        {item.ai_evaluation && (
          <Collapsible label="Evaluator notes" defaultOpen={item.score != null && item.score < 0.5}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">{item.ai_evaluation}</p>
          </Collapsible>
        )}

        <dl className="grid grid-cols-2 gap-px border border-line-hair bg-line-hair text-xs sm:grid-cols-3">
          {[
            ['Source', item.source_document_filename ?? '—'],
            ['Chunk', item.source_chunk_index != null ? `#${item.source_chunk_index + 1}` : '—'],
            ['Updated', timeAgo(item.updated_at)],
          ].map(([k, v]) => (
            <div key={k} className="bg-bg px-3 py-2">
              <dt className="eyebrow text-[9.5px]">{k}</dt>
              <dd className="mt-0.5 truncate font-mono text-fg-secondary" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <Button variant={item.confirmed ? 'outline' : 'default'} size="sm" onClick={onApprove}>
          <Check /> {item.confirmed ? 'Approved' : 'Approve'} <Kbd className={cn('ml-1', !item.confirmed && 'border-white/20 bg-transparent text-inherit')}>a</Kbd>
        </Button>
        <Button variant="outline" size="sm" onClick={onReject}>
          <X /> Reject <Kbd className="ml-1">r</Kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(true)} disabled={editing}>
          <Pencil /> Edit <Kbd className="ml-1">e</Kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="ml-auto hover:text-danger">
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  )
}
