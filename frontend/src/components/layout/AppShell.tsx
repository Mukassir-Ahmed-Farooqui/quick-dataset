import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ease } from '@/lib/animations'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import HelpOverlay from './HelpOverlay'
import { useGlobalHotkeys } from './useGlobalHotkeys'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const openHelp = useCallback(() => setHelpOpen(true), [])

  useGlobalHotkeys(openHelp)

  // Escape closes the drawer; lock page scroll while it is open.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:bg-bg focus:px-3 focus:py-2 focus:font-display focus:text-xs"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <m.div
              key="scrim"
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease }}
              onClick={closeDrawer}
              aria-hidden
            />
            <m.div
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease }}
            >
              <Sidebar onNavigate={closeDrawer} onClose={closeDrawer} className="bg-bg" />
            </m.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar onMenuToggle={() => setDrawerOpen((o) => !o)} onHelp={openHelp} />
        <main id="main" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <HelpOverlay open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
