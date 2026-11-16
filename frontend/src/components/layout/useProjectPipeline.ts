import { useMatch } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { useExports } from '@/hooks/useExports'
import { nextAction, stepStates, STEPS, type NextAction, type StepKey, type StepState } from '@/lib/pipeline'

export type StepStatus = 'done' | 'current' | 'locked' | 'open'

export interface PipelineStep extends StepState {
  status: StepStatus
}

/** The project id in the URL, or null outside a project (and on /projects/new). */
export function useRouteProjectId(): string | null {
  const match = useMatch('/projects/:projectId/*')
  const id = match?.params.projectId
  return id && id !== 'new' ? id : null
}

/** The active pipeline step from the URL, if any. */
export function useRouteStep(): StepKey | null {
  const match = useMatch('/projects/:projectId/:step/*')
  const step = match?.params.step
  if (step === 'review') return 'dataset-review'
  return STEPS.find((s) => s.path === step)?.key ?? null
}

/**
 * Status per step: done when it has output, current for the step nextAction() points at,
 * locked for later steps that need an earlier one first, open otherwise (optional / revisitable).
 */
export function pipelineSteps(states: StepState[], next: NextAction): PipelineStep[] {
  const nextIdx = STEPS.findIndex((s) => s.key === next.step)
  return states.map((s, i) => {
    let status: StepStatus
    if (s.def.key === next.step) status = 'current'
    else if (s.done) status = 'done'
    else if (i > nextIdx) status = 'locked'
    else status = 'open'
    return { ...s, status }
  })
}

export function useProjectPipeline(projectId: string | null) {
  const project = useProject(projectId ?? '')
  const exports = useExports(projectId ?? '', 1, 1)
  const progress = project.data?.pipeline_progress
  const exportsCount = exports.data?.pagination.total_items ?? 0
  const next = nextAction(progress, exportsCount)
  const steps = pipelineSteps(stepStates(progress, exportsCount), next)
  return { project, steps, next, exportsCount }
}

/** Display label used by the shell (stepper, sidebar, breadcrumb). */
export function stepLabel(key: StepKey): string {
  if (key === 'dataset-review') return 'Review'
  return STEPS.find((s) => s.key === key)?.label ?? key
}
