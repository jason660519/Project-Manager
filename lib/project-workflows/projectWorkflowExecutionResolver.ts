import type { IntegrationSheet, IntegrationSourceKind } from '../integrations/types';
import type { ProjectWorkflowExecutionDraft } from './projectWorkflowEngine';

export type ProjectWorkflowExecutorResolutionState = 'resolved' | 'unresolved';
export type ProjectWorkflowExecutorExecutionState = 'dry_run_only' | 'live_command_allowed';

export interface ProjectWorkflowExecutorCommandPreview {
  command: string;
  args: string[];
}

export interface ProjectWorkflowExecutorCandidate {
  state: 'resolved';
  executionState: ProjectWorkflowExecutorExecutionState;
  capabilityId: string;
  integrationSheet: IntegrationSheet;
  sourceKind: IntegrationSourceKind;
  sourceId: string;
  label: string;
  commandPreview: string;
  command: ProjectWorkflowExecutorCommandPreview;
  safetyNotice: string;
}

export interface ProjectWorkflowExecutorUnresolved {
  state: 'unresolved';
  executionState: ProjectWorkflowExecutorExecutionState;
  capabilityId: string;
  safetyNotice: string;
}

export type ProjectWorkflowExecutorResolution =
  | ProjectWorkflowExecutorCandidate
  | ProjectWorkflowExecutorUnresolved;

export type ProjectWorkflowExecutorRegistry = Record<string, Omit<ProjectWorkflowExecutorCandidate, 'capabilityId'>>;

export const DEFAULT_PROJECT_WORKFLOW_EXECUTOR_REGISTRY: ProjectWorkflowExecutorRegistry = {
  'software:verification:tool': {
    state: 'resolved',
    executionState: 'dry_run_only',
    integrationSheet: 'commands',
    sourceKind: 'command-mapping',
    sourceId: 'npm:verify-baseline',
    label: 'Run Project Manager verification baseline',
    commandPreview: 'npm run verify:baseline',
    command: { command: 'npm', args: ['run', 'verify:baseline'] },
    safetyNotice: 'Executor candidate only; Project Manager does not run this command in F54.',
  },
};

export function resolveProjectWorkflowDraftExecutor(
  draft: ProjectWorkflowExecutionDraft,
  executorRegistry: ProjectWorkflowExecutorRegistry = DEFAULT_PROJECT_WORKFLOW_EXECUTOR_REGISTRY,
): ProjectWorkflowExecutorResolution {
  const capabilityId = draft.integrationPolicy.capabilityId ?? `${draft.actorKind}:${draft.nodeId}`;
  const candidate = executorRegistry[capabilityId];
  if (!candidate) {
    return {
      state: 'unresolved',
      executionState: 'dry_run_only',
      capabilityId,
      safetyNotice: 'No Integration Hub executor candidate is registered for this capability.',
    };
  }
  return {
    ...candidate,
    capabilityId,
  };
}
