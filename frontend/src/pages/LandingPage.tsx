import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ArrowRight, Sparkles, Upload, Brain, Download, CheckCircle, Quote } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fadeUp, stagger, scaleUp } from '@/lib/animations'

const features = [
  {
    icon: Upload,
    title: 'Upload & Parse',
    description: 'Drag-and-drop PDFs, DOCX, Markdown, or TXT. Auto-parsed and ready for processing in seconds.',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    icon: Brain,
    title: 'Generate QA Pairs',
    description: 'AI-powered question-answer generation from your documents. Custom prompts at every stage.',
    color: 'from-emerald-500 to-teal-400',
  },
  {
    icon: Download,
    title: 'Export Datasets',
    description: 'Export high-quality, reviewed datasets in multiple formats. Ready for your RAG pipelines.',
    color: 'from-purple-500 to-pink-400',
  },
]

const stats = [
  { label: 'Documents Processed', value: '10K+' },
  { label: 'QA Pairs Generated', value: '50K+' },
  { label: 'Active Users', value: '1K+' },
  { label: 'Datasets Exported', value: '5K+' },
]

const testimonials = [
  { text: 'Quick Dataset cut our data preparation time by 80%. The QA generation is remarkably accurate.', author: 'Alex Chen', role: 'ML Engineer' },
  { text: 'Finally, a tool that understands RAG pipeline needs. The chunking strategies are incredibly smart.', author: 'Sarah Kim', role: 'AI Product Manager' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.95])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-hairline shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-deep-green flex items-center justify-center">
              <span className="text-white text-xs font-mono font-bold">QD</span>
            </div>
            <span className="text-sm font-semibold text-ink tracking-tight">Quick Dataset</span>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-body-muted hover:text-ink transition-colors px-4 py-2"
            >
              Sign in
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/register')}
              className="text-sm font-medium bg-ink text-white rounded-pill px-5 py-2 hover:bg-ink/90 transition-colors shadow-sm"
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section style={{ opacity: heroOpacity, scale: heroScale }} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-deep-green/5 via-canvas to-pale-blue/50" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-action/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-deep-green/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-coral/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-deep-green/10 text-deep-green text-xs font-medium rounded-pill px-4 py-1.5 mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Your RAG Pipeline Dataset Builder
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-tight text-ink leading-[1.1]">
              Build{' '}
              <span className="bg-gradient-to-r from-deep-green to-emerald-500 bg-clip-text text-transparent">
                Smarter Datasets
              </span>
              <br />
              for Your AI Pipeline
            </h1>

            <p className="mt-6 text-base sm:text-lg text-body-muted max-w-xl mx-auto leading-relaxed">
              Upload documents, generate intelligent QA pairs, and export production-ready datasets 
              for your RAG pipelines — all in one workspace.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/register')}
                className="bg-ink text-white rounded-pill px-8 py-3 text-sm font-medium hover:bg-ink/90 transition-colors shadow-lg flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/login')}
                className="border border-hairline text-ink rounded-pill px-8 py-3 text-sm font-medium hover:bg-stone transition-colors w-full sm:w-auto"
              >
                Sign In
              </motion.button>
            </div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-16 flex flex-col items-center gap-2 text-muted"
            >
              <span className="text-xs font-mono uppercase tracking-widest">Scroll</span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-5 h-8 border-2 border-muted/30 rounded-full flex justify-center pt-1.5"
              >
                <div className="w-1 h-2 rounded-full bg-muted/50" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section className="py-24 lg:py-32 bg-stone/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
              Everything you need
            </h2>
            <p className="mt-4 text-body-muted max-w-md mx-auto">
              From raw documents to production-ready datasets — one smooth pipeline.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white rounded-xl border border-hairline p-8 hover:shadow-lg hover:border-deep-green/20 transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} p-2.5 mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-full w-full text-white" />
                </div>
                <h3 className="text-lg font-semibold text-ink mb-2">{feature.title}</h3>
                <p className="text-sm text-body-muted leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 lg:py-32 bg-deep-green">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={scaleUp}
                className="text-center"
              >
                <div className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-white/60 mt-2">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink text-center mb-16"
          >
            Loved by teams like yours
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-stone/50 rounded-xl border border-hairline p-8"
              >
                <Quote className="h-6 w-6 text-deep-green/30 mb-4" />
                <p className="text-sm text-body-muted leading-relaxed">"{t.text}"</p>
                <div className="mt-4 pt-4 border-t border-hairline">
                  <div className="text-sm font-medium text-ink">{t.author}</div>
                  <div className="text-xs text-muted">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32 bg-gradient-to-br from-deep-green to-emerald-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <CheckCircle className="h-12 w-12 text-white/60 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
              Ready to build smarter?
            </h2>
            <p className="mt-4 text-lg text-white/70 max-w-lg mx-auto">
              Start creating production-ready datasets for your RAG pipelines in minutes.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/register')}
              className="mt-10 bg-white text-deep-green rounded-pill px-10 py-3.5 text-sm font-semibold hover:bg-white/90 transition-colors shadow-xl inline-flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-white/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-deep-green flex items-center justify-center">
              <span className="text-white text-[8px] font-mono font-bold">QD</span>
            </div>
            <span className="text-sm text-white/80">Quick Dataset</span>
          </div>
          <div className="text-xs">
            &copy; {new Date().getFullYear()} Quick Dataset. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
