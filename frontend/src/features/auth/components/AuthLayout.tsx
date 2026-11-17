import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { WindowFrame } from '@/components/ui/window-frame'
import { fadeUp } from '@/lib/animations'
import { STEPS } from '@/lib/pipeline'

interface AuthLayoutProps {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
  footer: React.ReactNode
}

/** Split auth screen: dark Mindcase panel with a pipeline preview on the left, form on the right. */
export default function AuthLayout({ eyebrow, title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className="grid-lines relative hidden w-1/2 flex-col justify-between bg-ink p-10 text-white lg:flex xl:p-14">
        <Link to="/" className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-widest">
          <span aria-hidden className="size-2 bg-accent" />
          Quick Dataset
        </Link>

        <div className="max-w-md">
          <p className="eyebrow text-white/45">Documents → Dataset</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight">
            Turn source files into reviewed training data.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Upload, chunk, generate questions and answers, approve what is good, export as JSONL, Alpaca or ShareGPT.
          </p>

          <WindowFrame dark title="pipeline" className="mt-10" bodyClassName="p-4">
            <ol className="space-y-2 font-mono text-[12px]">
              {STEPS.map((s, i) => (
                <li key={s.key} className="flex items-center gap-3">
                  <span className="num w-5 text-white/35">{String(i + 1).padStart(2, '0')}</span>
                  <span className={i < 3 ? 'text-white' : 'text-white/45'}>{s.label}</span>
                  <span className="h-px flex-1 bg-white/10" />
                  <span className={i < 3 ? 'text-accent' : 'text-white/30'}>{i < 3 ? 'done' : i === 3 ? 'next' : '—'}</span>
                </li>
              ))}
            </ol>
          </WindowFrame>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Quick Dataset v0.1</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <m.div variants={fadeUp} initial="hidden" animate="visible" className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-10 flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-widest lg:hidden"
          >
            <span aria-hidden className="size-2 bg-accent" />
            Quick Dataset
          </Link>
          <p className="eyebrow text-accent">{eyebrow}</p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-fg-secondary">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t border-line pt-5 text-sm text-fg-secondary">{footer}</div>
        </m.div>
      </main>
    </div>
  )
}
