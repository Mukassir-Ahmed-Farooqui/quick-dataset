import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/AuthContext'
import LoadingState from '@/components/common/LoadingState'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthContext()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <LoadingState />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
