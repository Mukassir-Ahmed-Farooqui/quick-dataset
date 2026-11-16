import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, MotionConfig } from 'framer-motion'
import '@fontsource/space-mono/latin-400.css'
import '@fontsource/space-mono/latin-700.css'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/lib/theme'
import { queryClient } from '@/lib/queryClient'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GlobalErrorBoundary } from './ErrorBoundary'
import App from './App'
import './index.css'

const loadMotion = () => import('@/lib/motion-features').then((m) => m.default)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LazyMotion features={loadMotion} strict>
              <MotionConfig reducedMotion="user">
                <TooltipProvider delayDuration={300}>
                  <App />
                </TooltipProvider>
              </MotionConfig>
            </LazyMotion>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
)
