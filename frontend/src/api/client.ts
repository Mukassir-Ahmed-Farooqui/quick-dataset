import axios, { AxiosError } from 'axios'
import { config } from '@/lib/config'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/token'

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 300000,
})

// Request interceptor — attach token + set content-type
apiClient.interceptors.request.use((axiosConfig) => {
  const token = getAccessToken()
  if (token) {
    axiosConfig.headers.Authorization = `Bearer ${token}`
  }

  // FormData needs the browser to auto-set the multipart boundary header.
  // For all other requests, force JSON.
  if (axiosConfig.data instanceof FormData) {
    delete axiosConfig.headers['Content-Type']
  } else if (!axiosConfig.headers['Content-Type']) {
    axiosConfig.headers['Content-Type'] = 'application/json'
  }

  return axiosConfig
})

export class ApiError extends Error {
  status?: number
  endpoint?: string

  constructor(message: string, status?: number, endpoint?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.endpoint = endpoint
  }
}

// Queue state for token refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: any) => void
  reject: (reason?: any) => void
}> = []

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Response interceptor — normalize errors + handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: unknown; message?: string }>) => {
    const originalRequest = error.config as any

    if (error.response?.status === 401) {
      // Prevent infinite loops if the refresh itself or login fails
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(new ApiError('Session expired', 401, originalRequest.url))
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true

        if (isRefreshing) {
          // Add this request to the queue to wait for the refresh to finish
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              return apiClient(originalRequest)
            })
            .catch((err) => Promise.reject(err))
        }

        originalRequest._retry = true
        isRefreshing = true

        const refreshToken = getRefreshToken()
        if (!refreshToken) {
          clearTokens()
          window.location.href = '/login'
          return Promise.reject(new ApiError('Session expired', 401, originalRequest.url))
        }

        return new Promise((resolve, reject) => {
          axios
            .post(`${config.apiBaseUrl}/auth/refresh`, { refresh_token: refreshToken })
            .then(({ data }) => {
              setTokens(data.access_token, data.refresh_token)
              apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
              originalRequest.headers.Authorization = `Bearer ${data.access_token}`
              processQueue(null, data.access_token)
              resolve(apiClient(originalRequest))
            })
            .catch((err) => {
              processQueue(err, null)
              clearTokens()
              window.location.href = '/login'
              reject(err)
            })
            .finally(() => {
              isRefreshing = false
            })
        })
      }
    }

    let message = 'Something went wrong'
    const data = error.response?.data
    const endpoint = error.config?.url

    if (typeof data?.detail === 'string') {
      message = data.detail
    } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
      // FastAPI validation errors
      const msgs = data.detail.map((e: { msg: string; loc: string[] }) => {
        const field = e.loc?.filter(l => l !== 'body').join('.') || 'unknown'
        return `${field}: ${e.msg}`
      })
      message = msgs.join('; ')
    } else if (data?.message) {
      message = data.message
    } else if (error.message) {
      message = error.message
    }

    return Promise.reject(new ApiError(message, error.response?.status, endpoint))
  },
)
