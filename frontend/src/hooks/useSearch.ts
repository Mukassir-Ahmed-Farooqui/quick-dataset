import { useQuery } from '@tanstack/react-query'
import { searchApi } from '@/api/search'

export function useSearch(projectId: string, query: string, enabled = false) {
  return useQuery({
    queryKey: ['search', projectId, query],
    queryFn: () => searchApi.search(projectId, query),
    enabled: !!projectId && !!query && enabled,
  })
}
