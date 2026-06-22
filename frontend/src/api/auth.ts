import { apiClient } from './client'
import type { TokenResponse, LoginPayload, RegisterPayload, User } from '@/types/api'

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiClient.post<User>('/auth/register', payload).then(r => r.data),

  login: (payload: LoginPayload) =>
    apiClient.post<TokenResponse>('/auth/login', payload).then(r => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then(r => r.data),

  me: () =>
    apiClient.get<User>('/auth/me').then(r => r.data),
}
