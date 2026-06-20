import { apiClient } from './client'
import type { LoginRequest, RegisterRequest, TokenResponse, UserOut } from '@/types/api'

export const authApi = {
  login(data: LoginRequest): Promise<TokenResponse> {
    return apiClient.post('/auth/login', data).then((r) => r.data)
  },

  register(data: RegisterRequest): Promise<UserOut> {
    return apiClient.post('/auth/register', data).then((r) => r.data)
  },

  refresh(refreshToken: string): Promise<TokenResponse> {
    return apiClient.post('/auth/refresh', { refresh_token: refreshToken }).then((r) => r.data)
  },

  getMe(): Promise<UserOut> {
    return apiClient.get('/auth/me').then((r) => r.data)
  },
}
