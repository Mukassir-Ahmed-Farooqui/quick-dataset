import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import PublicRoute from '@/routes/PublicRoute'
import LoadingState from '@/components/common/LoadingState'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ProjectsPage = lazy(() => import('@/features/projects/pages/ProjectsPage'))
const CreateProjectPage = lazy(() => import('@/features/projects/pages/CreateProjectPage'))
const ProjectDetailPage = lazy(() => import('@/features/projects/pages/ProjectDetailPage'))
const GAPairsPage = lazy(() => import('@/features/ga-pairs/pages/GAPairsPage'))
const QuestionsPage = lazy(() => import('@/features/questions/pages/QuestionsPage'))
const DatasetReviewPage = lazy(() => import('@/features/dataset-review/pages/DatasetReviewPage'))
const ProvidersPage = lazy(() => import('@/features/providers/pages/ProvidersPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          {/* Landing page — public, no guard */}
          <Route path="/" element={<SuspenseWrapper><LandingPage /></SuspenseWrapper>} />

          {/* Auth routes — public, redirect if authenticated */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<SuspenseWrapper><LoginPage /></SuspenseWrapper>} />
            <Route path="/register" element={<SuspenseWrapper><RegisterPage /></SuspenseWrapper>} />
          </Route>

          {/* Protected routes */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<SuspenseWrapper><DashboardPage /></SuspenseWrapper>} />
            <Route path="/projects" element={<SuspenseWrapper><ProjectsPage /></SuspenseWrapper>} />
            <Route path="/projects/new" element={<SuspenseWrapper><CreateProjectPage /></SuspenseWrapper>} />
            <Route path="/projects/:projectId" element={<SuspenseWrapper><ProjectDetailPage /></SuspenseWrapper>} />
            <Route path="/projects/:projectId/ga-pairs" element={<SuspenseWrapper><GAPairsPage /></SuspenseWrapper>} />
            <Route path="/projects/:projectId/questions" element={<SuspenseWrapper><QuestionsPage /></SuspenseWrapper>} />
            <Route path="/projects/:projectId/dataset-review" element={<SuspenseWrapper><DatasetReviewPage /></SuspenseWrapper>} />
            <Route path="/providers" element={<SuspenseWrapper><ProvidersPage /></SuspenseWrapper>} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
