import { useMemo, useState } from 'react'
import { Calculator, Sparkles, X } from 'lucide-react'
import Collapsible from '@/components/common/Collapsible'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/input'
import { useEstimateQuestions, useGenerateQuestions } from '@/hooks/useQuestions'
import { trackTask } from '@/lib/tasks'
import { sonnerToast, toastError } from '@/lib/toast'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChunkOut, DocumentOut, GAPairOut, GenerationEstimateResponse, QuestionGeneratePayload } from '@/types/api'

/** The backend may accept these ahead of the typed client; extra fields are sent as-is. */
type CountMode = 'auto' | 'fixed'
type GeneratePayload = QuestionGeneratePayload & { question_count_mode?: CountMode }

interface GeneratePanelProps {
  projectId: string
  docs: DocumentOut[]
  chunks: ChunkOut[]
  gaPairs: GAPairOut[]
  onClose?: () => void
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export default function GeneratePanel({ projectId, docs, chunks, gaPairs, onClose }: GeneratePanelProps) {
  const chunksByDoc = useMemo(() => {
    const m = new Map<string, ChunkOut[]>()
    for (const c of chunks) {
      const arr = m.get(c.document_id) ?? []
      arr.push(c)
      m.set(c.document_id, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.chunk_index - b.chunk_index)
    return m
  }, [chunks])

  const usableDocs = useMemo(() => docs.filter((d) => (chunksByDoc.get(d.id)?.length ?? 0) > 0), [docs, chunksByDoc])

  // `null` = smart default: everything selected.
  const [docSel, setDocSel] = useState<string[] | null>(null)
  const [gaSel, setGaSel] = useState<string[] | null>(null)
  const [chunkSel, setChunkSel] = useState<string[] | null>(null)
  const [mode, setMode] = useState<CountMode>('auto')
  const [perCombo, setPerCombo] = useState(3)
  const [estimate, setEstimate] = useState<GenerationEstimateResponse | null>(null)

  const selectedDocIds = docSel ?? usableDocs.map((d) => d.id)
  const selectedGaIds = gaSel ?? gaPairs.map((g) => g.id)
  const docChunks = selectedDocIds.flatMap((id) => chunksByDoc.get(id) ?? [])
  const chunkIds = chunkSel ? chunkSel.filter((id) => docChunks.some((c) => c.id === id)) : docChunks.map((c) => c.id)
  const lensCount = Math.max(1, selectedGaIds.length)
  const fixedTotal = chunkIds.length * lensCount * perCombo

  const generate = useGenerateQuestions(projectId)
  const estimateM = useEstimateQuestions(projectId)

  const payload = (): GeneratePayload => ({
    chunk_ids: chunkIds,
    ga_pair_ids: selectedGaIds.length > 0 ? selectedGaIds : undefined,
    ...(mode === 'auto' ? { question_count_mode: 'auto' as const } : { question_count_mode: 'fixed' as const, questions_per_combination: perCombo }),
  })

  const changed = () => setEstimate(null)

  const onEstimate = () =>
    estimateM.mutate(payload(), {
      onSuccess: (r) => setEstimate(r),
      onError: (err) => toastError('Could not estimate', err, onEstimate),
    })

  const onGenerate = () =>
    generate.mutate(payload(), {
      onSuccess: (r) => {
        trackTask({ id: r.task_id, projectId, kind: 'questions', label: 'Generating questions' })
        sonnerToast.success('Question generation started', {
          description: `${plural(chunkIds.length, 'chunk')} × ${plural(lensCount, 'lens', 'lenses')}. Progress shows below.`,
        })
        setEstimate(null)
        onClose?.()
      },
      onError: (err) => toastError('Could not start generation', err, onGenerate),
    })

  const allDocsOn = selectedDocIds.length === usableDocs.length
  const allGaOn = gaPairs.length > 0 && selectedGaIds.length === gaPairs.length

  return (
    <section className="border border-line bg-bg" aria-labelledby="qgen-title">
      <div className="flex items-center justify-between border-b border-line-hair bg-bg-subtle px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-accent" />
          <h2 id="qgen-title" className="eyebrow text-fg">
            Generate questions
          </h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close generate panel">
            <X />
          </Button>
        )}
      </div>

      <div className="grid gap-px bg-line-hair md:grid-cols-2">
        {/* Sources */}
        <div className="bg-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Source documents</p>
            {usableDocs.length > 1 && (
              <button
                type="button"
                className="font-display text-[11px] text-fg-muted hover:text-fg"
                onClick={() => {
                  setDocSel(allDocsOn ? [] : null)
                  changed()
                }}
              >
                {allDocsOn ? 'None' : 'All'}
              </button>
            )}
          </div>
          {usableDocs.length === 0 ? (
            <p className="text-sm text-fg-muted">No chunked documents yet. Create chunks first.</p>
          ) : (
            <ul className="max-h-44 divide-y divide-line-hair overflow-y-auto border border-line-hair">
              {usableDocs.map((d) => {
                const on = selectedDocIds.includes(d.id)
                return (
                  <li key={d.id}>
                    <label className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-bg-subtle', on && 'bg-paper/50')}>
                      <Checkbox
                        checked={on}
                        onChange={() => {
                          setDocSel(toggle(selectedDocIds, d.id))
                          changed()
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                      <span className="num text-[11px] text-fg-muted">{chunksByDoc.get(d.id)?.length ?? 0}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Lenses */}
        <div className="bg-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Genre × audience lenses</p>
            {gaPairs.length > 1 && (
              <button
                type="button"
                className="font-display text-[11px] text-fg-muted hover:text-fg"
                onClick={() => {
                  setGaSel(allGaOn ? [] : null)
                  changed()
                }}
              >
                {allGaOn ? 'None' : 'All'}
              </button>
            )}
          </div>
          {gaPairs.length === 0 ? (
            <p className="text-sm text-fg-muted">No GA pairs — a single default lens is used. Add pairs for more varied questions.</p>
          ) : (
            <ul className="max-h-44 divide-y divide-line-hair overflow-y-auto border border-line-hair">
              {gaPairs.map((g) => {
                const on = selectedGaIds.includes(g.id)
                return (
                  <li key={g.id}>
                    <label className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-bg-subtle', on && 'bg-paper/50')}>
                      <Checkbox
                        checked={on}
                        onChange={() => {
                          setGaSel(toggle(selectedGaIds, g.id))
                          changed()
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{g.genre_title}</span>
                      <span className="max-w-[45%] truncate text-xs text-fg-muted">{g.audience_title}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-line-hair px-4">
        <Collapsible
          label="Advanced options"
          hint={mode === 'auto' ? 'question count: auto · all chunks' : `${perCombo} per GA combination`}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <p className="eyebrow">Question count</p>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="radio"
                  name="qcount"
                  className="qd-radio mt-0.5"
                  checked={mode === 'auto'}
                  onChange={() => {
                    setMode('auto')
                    changed()
                  }}
                />
                <span>
                  Auto <span className="text-fg-muted">— scaled to how much each chunk says</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="qcount"
                  className="qd-radio"
                  checked={mode === 'fixed'}
                  onChange={() => {
                    setMode('fixed')
                    changed()
                  }}
                />
                <span>Per GA combination</span>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={perCombo}
                  disabled={mode !== 'fixed'}
                  aria-label="Questions per GA combination"
                  onChange={(e) => {
                    setPerCombo(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                    changed()
                  }}
                  className="h-7 w-16 text-center font-mono"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Chunks</p>
                {chunkSel && (
                  <button type="button" className="font-display text-[11px] text-fg-muted hover:text-fg" onClick={() => setChunkSel(null)}>
                    Use all
                  </button>
                )}
              </div>
              <ul className="max-h-40 divide-y divide-line-hair overflow-y-auto border border-line-hair">
                {docChunks.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-bg-subtle">
                      <Checkbox
                        checked={chunkIds.includes(c.id)}
                        onChange={() => {
                          setChunkSel(toggle(chunkIds, c.id))
                          changed()
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {docs.find((d) => d.id === c.document_id)?.filename ?? 'Doc'} · #{c.chunk_index + 1}
                      </span>
                      <span className="font-mono text-[10.5px] text-fg-muted">{c.token_count} tok</span>
                    </label>
                  </li>
                ))}
                {docChunks.length === 0 && <li className="px-2.5 py-2 text-xs text-fg-muted">Select a document first.</li>}
              </ul>
            </div>
          </div>
        </Collapsible>
      </div>

      {/* Summary + actions */}
      <div className="flex flex-col gap-3 border-t border-line bg-bg-subtle px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-xs text-fg-secondary">
          <span className="num text-sm text-fg">{chunkIds.length.toLocaleString()}</span> chunks
          <span className="text-fg-subtle">×</span>
          <span className="num text-sm text-fg">{lensCount}</span> {lensCount === 1 ? 'lens' : 'lenses'}
          <span className="text-fg-subtle">×</span>
          <span className="num text-sm text-fg">{mode === 'auto' ? 'auto' : perCombo}</span>
          {mode === 'fixed' && (
            <>
              <span className="text-fg-subtle">=</span>
              <span className="num text-sm font-bold text-fg">{fixedTotal.toLocaleString()}</span> questions
            </>
          )}
          {estimate && (
            <span className="ml-1 border-l border-line pl-3">
              ≈ <span className="num text-fg">{estimate.estimated_item_count.toLocaleString()}</span> items ·{' '}
              <span className="num text-fg">${estimate.estimated_cost_usd.toFixed(4)}</span>
              {estimate.warning && <span className="ml-2 text-warning">{estimate.warning}</span>}
            </span>
          )}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={onEstimate} loading={estimateM.isPending} disabled={chunkIds.length === 0}>
            <Calculator /> Estimate
          </Button>
          <Button size="sm" onClick={onGenerate} loading={generate.isPending} disabled={chunkIds.length === 0}>
            <Sparkles /> Generate
          </Button>
        </div>
      </div>
    </section>
  )
}
