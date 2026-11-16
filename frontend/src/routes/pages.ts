import { lazy } from 'react'

/** Route chunks. Exposed as import functions so links can prefetch them on hover. */
export const loaders = {
  landing: () => import('@/pages/LandingPage'),
  login: () => import('@/features/auth/pages/LoginPage'),
  register: () => import('@/features/auth/pages/RegisterPage'),
  dashboard: () => import('@/pages/DashboardPage'),
  projects: () => import('@/features/projects/pages/ProjectsPage'),
  createProject: () => import('@/features/projects/pages/CreateProjectPage'),
  projectLayout: () => import('@/features/projects/ProjectLayout'),
  overview: () => import('@/features/projects/pages/ProjectDetailPage'),
  documents: () => import('@/features/documents/pages/DocumentsPage'),
  chunks: () => import('@/features/chunks/pages/ChunksPage'),
  gaPairs: () => import('@/features/ga-pairs/pages/GAPairsPage'),
  questions: () => import('@/features/questions/pages/QuestionsPage'),
  review: () => import('@/features/dataset-review/pages/DatasetReviewPage'),
  export: () => import('@/features/export/pages/ExportPage'),
  providers: () => import('@/features/providers/pages/ProvidersPage'),
  notFound: () => import('@/pages/NotFoundPage'),
}

export type PageKey = keyof typeof loaders

const prefetched = new Set<PageKey>()
export function prefetchPage(key: PageKey) {
  if (prefetched.has(key)) return
  prefetched.add(key)
  loaders[key]().catch(() => prefetched.delete(key))
}

export const stepPageKey: Record<string, PageKey> = {
  documents: 'documents',
  chunks: 'chunks',
  'ga-pairs': 'gaPairs',
  questions: 'questions',
  'dataset-review': 'review',
  export: 'export',
}

export const Pages = {
  Landing: lazy(loaders.landing),
  Login: lazy(loaders.login),
  Register: lazy(loaders.register),
  Dashboard: lazy(loaders.dashboard),
  Projects: lazy(loaders.projects),
  CreateProject: lazy(loaders.createProject),
  ProjectLayout: lazy(loaders.projectLayout),
  Overview: lazy(loaders.overview),
  Documents: lazy(loaders.documents),
  Chunks: lazy(loaders.chunks),
  GAPairs: lazy(loaders.gaPairs),
  Questions: lazy(loaders.questions),
  Review: lazy(loaders.review),
  Export: lazy(loaders.export),
  Providers: lazy(loaders.providers),
  NotFound: lazy(loaders.notFound),
}
