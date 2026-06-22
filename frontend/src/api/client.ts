import axios, { AxiosError } from 'axios'
import { config } from '@/lib/config'
import { getAccessToken, clearTokens } from '@/lib/token'

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

// Response interceptor — normalize errors + handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: unknown; message?: string }>) => {
    if (error.response?.status === 401) {
      clearTokens()
      window.location.href = '/login'
    }

    let message = 'Something went wrong'
    const data = error.response?.data

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

    return Promise.reject(new Error(message))
  },
)
