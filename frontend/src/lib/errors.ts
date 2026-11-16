import { ApiError } from '@/api/client'

export interface FriendlyError {
  title: string
  message: string
  detail?: string
}

/** Turn API / network errors into something a person can act on. */
export function friendlyError(err: unknown): FriendlyError {
  const status = err instanceof ApiError ? err.status : (err as { status?: number } | null)?.status
  const raw = err instanceof Error ? err.message : undefined

  if (!status) {
    if (raw && /network|timeout|ECONN|Failed to fetch/i.test(raw)) {
      return { title: "Can't reach the server", message: 'Check that the backend is running and your connection is up, then retry.', detail: raw }
    }
    return { title: 'Something went wrong', message: raw || 'An unexpected error occurred. Retry usually fixes it.', detail: raw }
  }
  if (status === 401) return { title: 'Session expired', message: 'Sign in again to continue.', detail: raw }
  if (status === 403) return { title: 'Not allowed', message: "You don't have access to this resource.", detail: raw }
  if (status === 404) return { title: 'Not found', message: 'It may have been deleted or moved.', detail: raw }
  if (status === 409) return { title: 'Conflict', message: raw || 'This changed in the meantime. Refresh and try again.' }
  if (status === 413) return { title: 'File too large', message: 'Try a smaller file or split it into parts.', detail: raw }
  if (status === 422 || status === 400) return { title: 'Check your input', message: raw || 'Some values were not accepted.' }
  if (status === 429) return { title: 'Rate limited', message: 'The provider is throttling requests. Wait a moment and retry.', detail: raw }
  if (status >= 500) return { title: 'Server error', message: 'The server hit a problem. Retry in a few seconds.', detail: raw }
  return { title: 'Request failed', message: raw || `Status ${status}` }
}
