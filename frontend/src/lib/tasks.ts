import { useSyncExternalStore } from 'react'

export type TaskKind = 'chunks' | 'ga-pairs' | 'questions' | 'answers'

export interface TrackedTask {
  id: string
  projectId: string
  kind: TaskKind
  label: string
  startedAt: number
}

const KEY = 'qd-tasks'
let tasks: TrackedTask[] = load()
const listeners = new Set<() => void>()

function load(): TrackedTask[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TrackedTask[]) : []
  } catch {
    return []
  }
}

function emit() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(tasks))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

/** Start following a background task. Progress shows inline on every page of the project. */
export function trackTask(t: Omit<TrackedTask, 'startedAt'>) {
  if (!t.id || t.id === 'pending') return
  tasks = [...tasks.filter((x) => x.id !== t.id), { ...t, startedAt: Date.now() }]
  emit()
}

export function untrackTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id)
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const getSnapshot = () => tasks

export function useTrackedTasks(projectId?: string) {
  const all = useSyncExternalStore(subscribe, getSnapshot)
  return projectId ? all.filter((t) => t.projectId === projectId) : all
}

/** Query keys to refresh when a task of this kind finishes. */
export function keysForKind(kind: TaskKind, projectId: string): string[][] {
  const project = ['project', projectId]
  switch (kind) {
    case 'chunks':
      return [['chunks', projectId], project]
    case 'ga-pairs':
      return [['ga-pairs', projectId], project]
    case 'questions':
      return [['questions', projectId], ['questions_stats', projectId], project]
    case 'answers':
      return [['dataset-items', projectId], ['questions', projectId], ['questions_stats', projectId], project]
  }
}
