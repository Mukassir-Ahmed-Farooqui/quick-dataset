import { Link, Navigate } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowRight, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WindowFrame } from '@/components/ui/window-frame'
import { fadeUp, stagger } from '@/lib/animations'
import { STEPS } from '@/lib/pipeline'
import { prefetchPage } from '@/routes/pages'

const FORMATS = [
  { name: 'JSON', note: 'One array, every field.' },
  { name: 'JSONL', note: 'One record per line, stream-friendly.' },
  { name: 'Alpaca', note: 'instruction / input / output.' },
  { name: 'ShareGPT', note: 'Multi-turn conversations.' },
]

const PREVIEW_ROWS = [
  { q: 'What triggers a refund under section 4.2?', score: 0.94, status: 'approved' as const },
  { q: 'How long is the warranty for refurbished units?', score: 0.88, status: 'approved' as const },
  { q: 'Who signs off on vendor exceptions?', score: 0.61, status: 'pending' as const },
]

function Header() {
  const { resolved, toggle } = useTheme()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-widest">
          <span aria-hidden className="size-2 bg-accent" />
          Quick Dataset
        </Link>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme">
            {resolved === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/login" onMouseEnter={() => prefetchPage('login')}>
              Sign in
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register" onMouseEnter={() => prefetchPage('register')}>
              Get started
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}

function AppPreview() {
  return (
    <WindowFrame title="quick-dataset / review" className="shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)]">
      <div className="grid grid-cols-6 border-b border-line">
        {STEPS.map((s, i) => (
          <div key={s.key} className="border-r border-line px-2 py-2 last:border-r-0">
            <p className={i === 4 ? 'eyebrow text-[9px] text-fg' : 'eyebrow text-[9px]'}>{s.short}</p>
            <p className="num mt-0.5 text-[11px] text-fg-muted">{[4, 128, 12, 384, 384, 2][i]}</p>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-line-hair">
        {PREVIEW_ROWS.map((r) => (
          <li key={r.q} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[13px]">{r.q}</span>
            <span className="num text-[11px] text-fg-muted">{r.score.toFixed(2)}</span>
            <Badge variant={r.status === 'approved' ? 'success' : 'outline'}>{r.status}</Badge>
          </li>
        ))}
      </ul>
    </WindowFrame>
  )
}

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Header />

      <section className="grid-lines-light border-b border-line">
        <m.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-28"
        >
          <div>
            <m.p variants={fadeUp} className="eyebrow text-accent">
              Dataset builder for RAG and fine-tuning
            </m.p>
            <m.h1 variants={fadeUp} className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              From documents to a reviewed dataset.
            </m.h1>
            <m.p variants={fadeUp} className="mt-5 max-w-lg text-base leading-relaxed text-fg-secondary">
              Upload your files, split them into chunks, generate grounded questions and answers with your own LLM key,
              approve what is right, and export in the format your trainer expects.
            </m.p>
            <m.div variants={fadeUp} className="mt-8 flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link to="/register">
                  Create a free account <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
            </m.div>
          </div>
          <m.div variants={fadeUp}>
            <AppPreview />
          </m.div>
        </m.div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="eyebrow">The pipeline</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Six steps. One next button.</h2>
          <p className="mt-2 max-w-xl text-sm text-fg-secondary">
            Every project walks the same path, and the app always tells you what to do next.
          </p>
          <m.ol
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3"
          >
            {STEPS.map((s, i) => (
              <m.li key={s.key} variants={fadeUp} className="bg-bg p-5">
                <div className="flex items-center justify-between">
                  <span className="num text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <s.icon className="size-4 text-fg-muted" strokeWidth={1.5} />
                </div>
                <p className="mt-3 font-display text-sm font-bold">
                  {s.label}
                  {s.optional && <span className="ml-1.5 font-sans text-xs font-normal text-fg-subtle">optional</span>}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{s.blurb}</p>
              </m.li>
            ))}
          </m.ol>
        </div>
      </section>

      <section className="grid-lines bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-white/45">Export</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Ship it in the shape you need.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
              Filter by approval and score, then download. Every export is kept in history so you can re-download it later.
            </p>
          </div>
          <ul className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <li key={f.name} className="bg-ink-2 p-5">
                <p className="font-display text-sm font-bold">{f.name}</p>
                <p className="mt-1 text-xs text-white/55">{f.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Bring a document. Leave with a dataset.</h2>
            <p className="mt-1 text-sm text-fg-secondary">Works with OpenAI, OpenRouter, Groq and Gemini keys.</p>
          </div>
          <Button asChild size="lg" variant="accent">
            <Link to="/register">
              Get started <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">Quick Dataset v0.1</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">© {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
