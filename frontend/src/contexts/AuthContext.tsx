import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authApi } from '@/api/auth'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/token'
import type { UserOut, RegisterRequest } from '@/types/api'

interface AuthContextValue {
  user: UserOut | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount — check localStorage tokens and validate with /auth/me
  useEffect(() => {
    const init = async () => {
      const access = getAccessToken()
      const refresh = getRefreshToken()
      if (!access && !refresh) {
        setIsLoading(false)
        return
      }
      try {
        const me = await authApi.getMe()
        setUser(me)
      } catch {
        // access token expired — try refresh
        if (refresh) {
          try {
            const data = await authApi.refresh(refresh)
            setTokens(data.access_token, data.refresh_token)
            setUser(data.user)
          } catch {
            clearTokens()
          }
        } else {
          clearTokens()
        }
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password })
    setTokens(data.access_token, data.refresh_token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    await authApi.register(data)
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}

export default AuthContext
