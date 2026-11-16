import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useTheme } from '@/lib/theme'
import { prefetchPage } from '@/routes/pages'

const SEQUENCE_MS = 1200

/** App-wide shortcuts: g p, g d, t, ?. Second key of a "g" sequence is swallowed so pages don't see it. */
export function useGlobalHotkeys(openHelp: () => void) {
  const navigate = useNavigate()
  const { toggle } = useTheme()
  const disarm = useRef<(() => void) | null>(null)

  useEffect(() => () => disarm.current?.(), [])

  const armG = useCallback(() => {
    disarm.current?.()
    prefetchPage('projects')
    prefetchPage('dashboard')
    const onNext = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Shift') return
      cleanup()
      const k = e.key.toLowerCase()
      const to = k === 'p' ? '/projects' : k === 'd' ? '/dashboard' : null
      if (!to) return
      e.preventDefault()
      e.stopImmediatePropagation()
      navigate(to)
    }
    const timer = window.setTimeout(() => cleanup(), SEQUENCE_MS)
    function cleanup() {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onNext, true)
      disarm.current = null
    }
    window.addEventListener('keydown', onNext, true)
    disarm.current = cleanup
  }, [navigate])

  useHotkeys({
    g: armG,
    t: () => toggle(),
    '?': openHelp,
    'shift+?': openHelp,
    'shift+/': openHelp,
  })
}
