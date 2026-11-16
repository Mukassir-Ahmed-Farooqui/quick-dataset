import { useEffect, useState } from 'react'

/** Seconds since `startedAt` (ms), ticking once a second while `running`. */
export function useElapsed(startedAt: number | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt || !running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt, running])
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
}
