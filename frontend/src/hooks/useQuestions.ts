import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi } from '@/api/questions'
import { tasksApi } from '@/api/tasks'
import type { QuestionGeneratePayload, QuestionCreate, QuestionUpdate, TaskOut } from '@/types/api'

interface UseQuestionsOptions {
  chunkId?: string
  gaPairId?: string
  generationRunId?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
}

export function useQuestions(projectId: string, options: UseQuestionsOptions = {}) {
  const { chunkId, gaPairId, generationRunId, status, search, page = 1, pageSize = 50 } = options
  return useQuery({
    queryKey: ['questions', projectId, { chunkId, gaPairId, generationRunId, status, search }, page, pageSize],
    queryFn: () => questionsApi.list(projectId, {
      chunk_id: chunkId,
      ga_pair_id: gaPairId,
      generation_run_id: generationRunId,
      status,
      search: search || undefined,
      page,
      page_size: pageSize,
    }),
    enabled: !!projectId,
  })
}

export function useQuestionStats(projectId: string) {
  return useQuery({
    queryKey: ['questions_stats', projectId],
    queryFn: () => questionsApi.getStats(projectId),
    enabled: !!projectId,
  })
}

export function useTaskPoll(taskId: string | null, enabled = false) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
    enabled: !!taskId && enabled,
    refetchInterval: (data) => {
      if (!data) return 2000
      if (data.status === 'done' || data.status === 'failed' || data.status === 'cancelled') return false
      return 2000
    },
  })
}

export function useGenerateQuestions(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: QuestionGeneratePayload) => questionsApi.generate(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', projectId] })
    },
  })
}

export function useEstimateQuestions(projectId: string) {
  return useMutation({
    mutationFn: (data: QuestionGeneratePayload) => questionsApi.estimate(projectId, data),
  })
}

export function useCreateQuestion(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: QuestionCreate) => questionsApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', projectId] })
    },
  })
}

export function useUpdateQuestion(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: QuestionUpdate }) =>
      questionsApi.update(projectId, questionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', projectId] })
    },
  })
}

export function useDeleteQuestion(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (questionId: string) => questionsApi.delete(projectId, questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', projectId] })
    },
  })
}

export function useBulkDeleteQuestions(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => questionsApi.bulkDelete(projectId, { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', projectId] })
    },
  })
}
