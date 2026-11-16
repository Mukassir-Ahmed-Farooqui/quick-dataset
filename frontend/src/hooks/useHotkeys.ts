import { useEffect, useRef } from 'react'

type Handler = (e: KeyboardEvent) => void

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/**
 * Register single-key shortcuts, e.g. { a: approve, r: reject, j: next, 'shift+a': ... }.
 * Ignored while typing in a field or when a modifier (ctrl/meta/alt) is held.
 */
export function useHotkeys(map: Record<string, Handler>, enabled = true) {
  const ref = useRef(map)
  useEffect(() => {
    ref.current = map
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target) && e.key !== 'Escape') return
      if (document.querySelector('[role="dialog"]') && e.key !== 'Escape') return
      const key = (e.shiftKey && e.key.length === 1 ? `shift+${e.key.toLowerCase()}` : e.key.length === 1 ? e.key.toLowerCase() : e.key)
      const handler = ref.current[key]
      if (handler) {
        e.preventDefault()
        handler(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
