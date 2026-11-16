import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import PublicRoute from '@/routes/PublicRoute'
import LoadingState from '@/components/common/LoadingState'
import { Pages } from '@/routes/pages'

function FullPageFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="h-px w-40 overflow-hidden bg-line">
        <div className="h-full w-1/3 animate-shimmer bg-accent" />
      </div>
    </div>
  )
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
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
              <Route index element={<S><Pages.Overview /></S>} />
              <Route path="documents" element={<S><Pages.Documents /></S>} />
              <Route path="chunks" element={<S><Pages.Chunks /></S>} />
              <Route path="ga-pairs" element={<S><Pages.GAPairs /></S>} />
              <Route path="questions" element={<S><Pages.Questions /></S>} />
              <Route path="dataset-review" element={<S><Pages.Review /></S>} />
              <Route path="review" element={<LegacyReviewRedirect />} />
              <Route path="export" element={<S><Pages.Export /></S>} />
            </Route>
          </Route>

          <Route path="*" element={<Pages.NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
