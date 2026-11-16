import { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import PublicRoute from '@/routes/PublicRoute'
import LoadingState, { GridSkeleton, ListSkeleton } from '@/components/common/LoadingState'
import { Pages } from '@/routes/pages'

/** Bare page (landing, auth, 404) while its chunk loads. */
function FullPageFallback() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" aria-busy aria-label="Loading">
      <div className="h-px w-40 overflow-hidden bg-line">
        <div className="h-full w-1/3 animate-shimmer bg-accent motion-reduce:animate-none" />
      </div>
    </div>
  )
}

/** A top-level page inside the shell. */
function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

/** A project step page: the project header and stepper stay put, only the body shimmers. */
function Step({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6" aria-busy aria-label="Loading">
          <GridSkeleton count={3} />
          <ListSkeleton rows={5} />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function LegacyReviewRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/projects/${projectId}/dataset-review`} replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageFallback />}>
        <Routes>
          <Route path="/" element={<Pages.Landing />} />

          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Pages.Login />} />
            <Route path="/register" element={<Pages.Register />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<S><Pages.Dashboard /></S>} />
            <Route path="/projects" element={<S><Pages.Projects /></S>} />
            <Route path="/projects/new" element={<S><Pages.CreateProject /></S>} />
            <Route path="/providers" element={<S><Pages.Providers /></S>} />
            <Route path="/projects/:projectId" element={<S><Pages.ProjectLayout /></S>}>
              <Route index element={<Step><Pages.Overview /></Step>} />
              <Route path="documents" element={<Step><Pages.Documents /></Step>} />
              <Route path="chunks" element={<Step><Pages.Chunks /></Step>} />
              <Route path="ga-pairs" element={<Step><Pages.GAPairs /></Step>} />
              <Route path="questions" element={<Step><Pages.Questions /></Step>} />
              <Route path="dataset-review" element={<Step><Pages.Review /></Step>} />
              <Route path="review" element={<LegacyReviewRedirect />} />
              <Route path="export" element={<Step><Pages.Export /></Step>} />
              <Route path="*" element={<Step><Pages.NotFound /></Step>} />
            </Route>
          </Route>

          <Route path="*" element={<Pages.NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
