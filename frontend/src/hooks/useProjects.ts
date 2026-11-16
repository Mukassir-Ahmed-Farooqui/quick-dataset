import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { queryClient } from '@/lib/queryClient'
import type { ProjectCreate, ProjectUpdate } from '@/types/api'

interface UseProjectsOptions {
  page?: number
  pageSize?: number
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { page = 1, pageSize = 50 } = options
  return useQuery({
    queryKey: ['projects', page, pageSize],
    queryFn: () => projectsApi.list(page, pageSize),
  })
}

export const projectQuery = (id: string) => ({
  queryKey: ['project', id],
  queryFn: () => projectsApi.get(id),
  staleTime: 10_000,
})

export function useProject(id: string) {
  return useQuery({ ...projectQuery(id), enabled: !!id })
}

/** Warm the cache on hover so opening a project is instant. */
export function prefetchProject(id: string) {
  return queryClient.prefetchQuery(projectQuery(id))
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectCreate) => projectsApi.create(data),
    onSuccess: (p) => {
      qc.setQueryData(['project', p.id], p)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectUpdate) => projectsApi.update(id, data),
    onSuccess: (p) => {
      qc.setQueryData(['project', id], p)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
