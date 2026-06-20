import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import LoadingState from '@/components/common/LoadingState'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ProjectsPage = lazy(() => import('@/features/projects/pages/ProjectsPage'))
const CreateProjectPage = lazy(() => import('@/features/projects/pages/CreateProjectPage'))
const ProjectDetailPage = lazy(() => import('@/features/projects/pages/ProjectDetailPage'))
const ProvidersPage = lazy(() => import('@/features/providers/pages/ProvidersPage'))
const DocumentsPage = lazy(() => import('@/features/documents/pages/DocumentsPage'))
const ChunksPage = lazy(() => import('@/features/chunks/pages/ChunksPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<SuspenseWrapper><DashboardPage /></SuspenseWrapper>} />
            <Route path="/projects" element={<SuspenseWrapper><ProjectsPage /></SuspenseWrapper>} />
            <Route path="/projects/new" element={<SuspenseWrapper><CreateProjectPage /></SuspenseWrapper>} />
            <Route path="/projects/:projectId" element={<SuspenseWrapper><ProjectDetailPage /></SuspenseWrapper>} />
            <Route path="/projects/:projectId/documents" element={<SuspenseWrapper><DocumentsPage /></SuspenseWrapper>} />
            <Route path="/projects/:projectId/chunks" element={<SuspenseWrapper><ChunksPage /></SuspenseWrapper>} />
            <Route path="/providers" element={<SuspenseWrapper><ProvidersPage /></SuspenseWrapper>} />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
