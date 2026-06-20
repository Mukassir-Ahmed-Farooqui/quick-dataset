import axios from 'axios'
import { config } from '@/lib/config'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/token'

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — attach Bearer token if available
apiClient.interceptors.request.use((req) => {
  const token = getAccessToken()
  if (token && req.headers) {
    req.headers.Authorization = `Bearer ${token}`
  }
  return req
})

// Response interceptor — refresh on 401, redirect to login on failure
let isRefreshing = false
let pendingQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  pendingQueue.forEach((p) => {
    if (token) p.resolve(token)
    else p.reject(error)
  })
  pendingQueue = []
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }
      originalRequest._retry = true
      isRefreshing = true
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        const { data } = await axios.post(`${config.apiBaseUrl}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        setTokens(data.access_token, data.refresh_token)
        processQueue(null, data.access_token)
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)
