import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { questionsApi } from '@/api/questions'
import { tasksApi } from '@/api/tasks'
import { patchIds, patchPagedLists, restore } from '@/lib/optimistic'
import type { QuestionGeneratePayload, QuestionCreate, QuestionOut, QuestionUpdate } from '@/types/api'

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
    queryFn: () =>
      questionsApi.list(projectId, {
        chunk_id: chunkId,
        ga_pair_id: gaPairId,
        generation_run_id: generationRunId,
        status,
        search: search || undefined,
        page,
        page_size: pageSize,
      }),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  })
}

export function useQuestionStats(projectId: string) {
  return useQuery({
    queryKey: ['questions_stats', projectId],
    queryFn: () => questionsApi.getStats(projectId),
    enabled: !!projectId,
  })
}

const TERMINAL = ['done', 'failed', 'cancelled']

/** Polls a background task every 1.5s and stops automatically once it finishes. */
export function useTaskPoll(taskId: string | null, enabled = false) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
    enabled: !!taskId && enabled,
    staleTime: 0,
    retry: 2,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (query.state.status === 'error') return false
      return status && TERMINAL.includes(status) ? false : 1500
    },
  })
}

export function useCancelTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.cancel(taskId),
    onSuccess: (task) => qc.setQueryData(['task', task.id], task),
  })
}

export function useGenerateQuestions(projectId: string) {
  return useMutation({
    mutationFn: (data: QuestionGeneratePayload) => questionsApi.generate(projectId, data),
  })
}

export function useEstimateQuestions(projectId: string) {
  return useMutation({
    mutationFn: (data: QuestionGeneratePayload) => questionsApi.estimate(projectId, data),
  })
}

export function useCreateQuestion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: QuestionCreate) => questionsApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useUpdateQuestion(projectId: string) {
  const qc = useQueryClient()
  const key = ['questions', projectId]
  return useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: QuestionUpdate }) =>
      questionsApi.update(projectId, questionId, data),
    onMutate: ({ questionId, data }) => patchPagedLists<QuestionOut>(qc, key, patchIds([questionId], data as Partial<QuestionOut>)),
    onError: (_e, _v, snap) => restore(qc, snap),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/** Raw delete calls; the UI applies optimistic removal + undo (see lib/undo). */
export function useDeleteQuestion(projectId: string) {
  return useMutation({ mutationFn: (questionId: string) => questionsApi.delete(projectId, questionId) })
}

export function useBulkDeleteQuestions(projectId: string) {
  return useMutation({ mutationFn: (ids: string[]) => questionsApi.bulkDelete(projectId, { ids }) })
}
