import { isTauriRuntime, spawnAgent, writeFile, type SpawnAgentResult } from '../bridge';
import type { ProjectWorkflowExecutionDraft, ProjectWorkflowRun } from './projectWorkflowEngine';
import {
  resolveProjectWorkflowDraftExecutor,
  type ProjectWorkflowExecutorRegistry,
  type ProjectWorkflowExecutorResolution,
} from './projectWorkflowExecutionResolver';

export type ProjectWorkflowExecutionRequestStatus = 'pending_external_executor';
export type ProjectWorkflowExecutionRequestSchemaVersion = 1;
export type ProjectWorkflowExecutionRequestReviewStatus =
  | 'review_required'
  | 'approved_for_executor'
  | 'blocked_policy';

export interface ProjectWorkflowExecutionRequestPackage {
  schemaVersion: ProjectWorkflowExecutionRequestSchemaVersion;
  id: string;
  workflowRunId: string;
  workItemId: string;
  nodeId: string;
  nodeTitle: string;
  draftId: string;
  actorKind: ProjectWorkflowExecutionDraft['actorKind'];
  status: ProjectWorkflowExecutionRequestStatus;
  executionState: ProjectWorkflowExecutorResolution['executionState'];
  reviewStatus: ProjectWorkflowExecutionRequestReviewStatus;
  policyGate: {
    state: ProjectWorkflowExecutionRequestReviewStatus;
    reason: string;
  };
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  capabilityId: string;
  executorResolution: ProjectWorkflowExecutorResolution;
  command?: {
    command: string;
    args: string[];
  };
  systemPromptLabel: string;
  taskPromptLabel: string;
  memoryFiles: string[];
  allowedTools: string[];
  expectedHandoffArtifactId: string;
  expectedEvidenceIds: string[];
  safetyNotice: string;
}

export type ProjectWorkflowExecutionRequestConsumptionDecision =
  | {
      state: 'blocked';
      requestId: string;
      reason: string;
    }
  | {
      state: 'ready';
      requestId: string;
      executionState: ProjectWorkflowExecutorResolution['executionState'];
      command: {
        command: string;
        args: string[];
      };
      reason: string;
    };

export type ProjectWorkflowExecutorHandoffRecordStatus =
  | 'ready_for_executor'
  | 'blocked_by_policy';

export type ProjectWorkflowExecutorRunRecordStatus =
  | 'dry_run_completed'
  | 'live_spawned'
  | 'blocked_by_policy';

export type ProjectWorkflowExecutorRunResult =
  | {
      state: 'completed';
      exitCode: number;
      stdoutPreview: string;
      stderrPreview: string;
    }
  | {
      state: 'spawned';
      pid: number;
      spawnToken: number;
    }
  | {
      state: 'blocked';
      reason: string;
    };

export interface ProjectWorkflowExecutorHandoffRecord {
  schemaVersion: 1;
  id: string;
  requestId: string;
  workflowRunId: string;
  workItemId: string;
  nodeId: string;
  nodeTitle: string;
  draftId: string;
  status: ProjectWorkflowExecutorHandoffRecordStatus;
  consumedBy: string;
  consumedAt: string;
  executionState: ProjectWorkflowExecutorResolution['executionState'];
  capabilityId: string;
  commandPreview?: string;
  command?: {
    command: string;
    args: string[];
  };
  policyDecision: ProjectWorkflowExecutionRequestConsumptionDecision;
  safetyNotice: string;
}

export interface ProjectWorkflowExecutorRunRecord {
  schemaVersion: 1;
  id: string;
  requestId: string;
  workflowRunId: string;
  workItemId: string;
  nodeId: string;
  nodeTitle: string;
  draftId: string;
  status: ProjectWorkflowExecutorRunRecordStatus;
  consumedBy: string;
  consumedAt: string;
  executionState: ProjectWorkflowExecutorResolution['executionState'];
  capabilityId: string;
  workingDir?: string;
  commandPreview?: string;
  command?: {
    command: string;
    args: string[];
  };
  policyDecision: ProjectWorkflowExecutionRequestConsumptionDecision;
  runnerResult: ProjectWorkflowExecutorRunResult;
  safetyNotice: string;
}

export interface ProjectWorkflowExecutorRunnerAdapter {
  runDryRunCommand: (input: {
    request: ProjectWorkflowExecutionRequestPackage;
    command: {
      command: string;
      args: string[];
    };
    commandPreview?: string;
  }) => Promise<{
    exitCode: number;
    stdoutPreview: string;
    stderrPreview: string;
  }>;
}

export interface ProjectWorkflowExecutorLiveRunnerAdapter {
  spawnLiveCommand: (input: {
    request: ProjectWorkflowExecutionRequestPackage;
    command: {
      command: string;
      args: string[];
    };
    commandPreview?: string;
    workingDir: string;
  }) => Promise<SpawnAgentResult>;
}

export interface ProjectWorkflowExecutionRequestStoreAdapter {
  writeFile: (path: string, content: string) => Promise<void>;
}

const DEFAULT_STORE_ADAPTER: ProjectWorkflowExecutionRequestStoreAdapter = {
  writeFile,
};

const DEFAULT_DRY_RUNNER_ADAPTER: ProjectWorkflowExecutorRunnerAdapter = {
  runDryRunCommand: async () => ({
    exitCode: 0,
    stdoutPreview: 'Dry-run executor validated the approved command package. No process was spawned.',
    stderrPreview: '',
  }),
};

const DEFAULT_LIVE_RUNNER_ADAPTER: ProjectWorkflowExecutorLiveRunnerAdapter = {
  spawnLiveCommand: async ({ command, workingDir }) => {
    if (!isTauriRuntime()) {
      throw new Error('Live executor requires the Tauri desktop runtime. Browser mode remains dry-run only.');
    }
    return spawnAgent({
      command: command.command,
      args: command.args,
      workingDir,
    });
  },
};

function trimTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}

function safeFileSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

export function projectWorkflowExecutionRequestsDirectory(projectRoot: string): string {
  return `${trimTrailingSlash(projectRoot)}/.project-manager/project-workflow-execution-requests`;
}

export function projectWorkflowExecutionRequestPath(projectRoot: string, requestId: string): string {
  return `${projectWorkflowExecutionRequestsDirectory(projectRoot)}/${safeFileSegment(requestId)}.json`;
}

export function projectWorkflowExecutorHandoffRecordsDirectory(projectRoot: string): string {
  return `${trimTrailingSlash(projectRoot)}/.project-manager/project-workflow-execution-records`;
}

export function projectWorkflowExecutorHandoffRecordPath(projectRoot: string, recordId: string): string {
  return `${projectWorkflowExecutorHandoffRecordsDirectory(projectRoot)}/${safeFileSegment(recordId)}.json`;
}

export function serializeProjectWorkflowExecutionRequest(request: ProjectWorkflowExecutionRequestPackage): string {
  return `${JSON.stringify(request, null, 2)}\n`;
}

export function buildProjectWorkflowExecutionRequests(
  run: ProjectWorkflowRun,
  executorRegistry?: ProjectWorkflowExecutorRegistry,
): ProjectWorkflowExecutionRequestPackage[] {
  return run.executionDrafts
    .filter((draft) => draft.status === 'run_requested')
    .map((draft) => buildProjectWorkflowExecutionRequest(run, draft, executorRegistry));
}

export async function saveProjectWorkflowExecutionRequests(
  projectRoot: string,
  run: ProjectWorkflowRun,
  adapter: ProjectWorkflowExecutionRequestStoreAdapter = DEFAULT_STORE_ADAPTER,
  executorRegistry?: ProjectWorkflowExecutorRegistry,
): Promise<string[]> {
  const requests = buildProjectWorkflowExecutionRequests(run, executorRegistry);
  const paths = await Promise.all(
    requests.map(async (request) => {
      const path = projectWorkflowExecutionRequestPath(projectRoot, request.id);
      await adapter.writeFile(path, serializeProjectWorkflowExecutionRequest(request));
      return path;
    }),
  );
  return paths;
}

export function approveProjectWorkflowExecutionRequest(
  request: ProjectWorkflowExecutionRequestPackage,
  approvedBy: string,
  approvedAt: string,
): ProjectWorkflowExecutionRequestPackage {
  return {
    ...request,
    reviewStatus: 'approved_for_executor',
    approvedBy,
    approvedAt,
    policyGate: {
      state: 'approved_for_executor',
      reason: 'Human approved this dry-run request for a future executor handoff.',
    },
  };
}

export function evaluateProjectWorkflowExecutionRequestConsumption(
  request: ProjectWorkflowExecutionRequestPackage,
): ProjectWorkflowExecutionRequestConsumptionDecision {
  if (request.reviewStatus !== 'approved_for_executor' || request.policyGate.state !== 'approved_for_executor') {
    return {
      state: 'blocked',
      requestId: request.id,
      reason: 'Execution request must be approved_for_executor before any executor may consume it.',
    };
  }
  if (request.executorResolution.state !== 'resolved' || !request.command) {
    return {
      state: 'blocked',
      requestId: request.id,
      reason: 'Execution request has no resolved Integration Hub executor candidate.',
    };
  }
  return {
    state: 'ready',
    requestId: request.id,
    executionState: request.executionState,
    command: request.command,
    reason: 'Approved dry-run request is ready for a future executor handoff.',
  };
}

export function evaluateProjectWorkflowLiveExecutionRequestConsumption(
  request: ProjectWorkflowExecutionRequestPackage,
): ProjectWorkflowExecutionRequestConsumptionDecision {
  const decision = evaluateProjectWorkflowExecutionRequestConsumption(request);
  if (decision.state === 'blocked') return decision;
  if (request.executionState !== 'live_command_allowed') {
    return {
      state: 'blocked',
      requestId: request.id,
      reason: 'Execution request is dry_run_only and cannot be spawned as a live command.',
    };
  }
  return {
    ...decision,
    reason: 'Approved live command request is ready for a guarded executor spawn.',
  };
}

export function buildProjectWorkflowExecutorHandoffRecord(
  request: ProjectWorkflowExecutionRequestPackage,
  consumedBy: string,
  consumedAt: string,
): ProjectWorkflowExecutorHandoffRecord {
  const policyDecision = evaluateProjectWorkflowExecutionRequestConsumption(request);
  const commandPreview = request.executorResolution.state === 'resolved'
    ? request.executorResolution.commandPreview
    : undefined;
  return {
    schemaVersion: 1,
    id: `${request.id}:handoff:${safeFileSegment(consumedAt)}`,
    requestId: request.id,
    workflowRunId: request.workflowRunId,
    workItemId: request.workItemId,
    nodeId: request.nodeId,
    nodeTitle: request.nodeTitle,
    draftId: request.draftId,
    status: policyDecision.state === 'ready' ? 'ready_for_executor' : 'blocked_by_policy',
    consumedBy,
    consumedAt,
    executionState: request.executionState,
    capabilityId: request.capabilityId,
    commandPreview,
    command: policyDecision.state === 'ready' ? policyDecision.command : undefined,
    policyDecision,
    safetyNotice: 'Handoff record only; Project Manager did not execute the command.',
  };
}

export function serializeProjectWorkflowExecutorHandoffRecord(
  record: ProjectWorkflowExecutorHandoffRecord,
): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

export function buildProjectWorkflowExecutorRunRecord(
  request: ProjectWorkflowExecutionRequestPackage,
  consumedBy: string,
  consumedAt: string,
  runnerResult?: Extract<ProjectWorkflowExecutorRunResult, { state: 'completed' }>,
): ProjectWorkflowExecutorRunRecord {
  const policyDecision = evaluateProjectWorkflowExecutionRequestConsumption(request);
  const commandPreview = request.executorResolution.state === 'resolved'
    ? request.executorResolution.commandPreview
    : undefined;
  return {
    schemaVersion: 1,
    id: `${request.id}:run:${safeFileSegment(consumedAt)}`,
    requestId: request.id,
    workflowRunId: request.workflowRunId,
    workItemId: request.workItemId,
    nodeId: request.nodeId,
    nodeTitle: request.nodeTitle,
    draftId: request.draftId,
    status: policyDecision.state === 'ready' ? 'dry_run_completed' : 'blocked_by_policy',
    consumedBy,
    consumedAt,
    executionState: request.executionState,
    capabilityId: request.capabilityId,
    commandPreview,
    command: policyDecision.state === 'ready' ? policyDecision.command : undefined,
    policyDecision,
    runnerResult: policyDecision.state === 'ready'
      ? runnerResult ?? {
        state: 'completed',
        exitCode: 0,
        stdoutPreview: 'Dry-run executor validated the approved command package. No process was spawned.',
        stderrPreview: '',
      }
      : {
        state: 'blocked',
        reason: policyDecision.reason,
      },
    safetyNotice: 'Dry-run executor result only; Project Manager did not spawn a process or execute the command.',
  };
}

export async function runProjectWorkflowExecutorDryRun(
  request: ProjectWorkflowExecutionRequestPackage,
  consumedBy: string,
  consumedAt: string,
  runnerAdapter: ProjectWorkflowExecutorRunnerAdapter = DEFAULT_DRY_RUNNER_ADAPTER,
): Promise<ProjectWorkflowExecutorRunRecord> {
  const policyDecision = evaluateProjectWorkflowExecutionRequestConsumption(request);
  if (policyDecision.state === 'blocked') {
    return buildProjectWorkflowExecutorRunRecord(request, consumedBy, consumedAt);
  }

  const commandPreview = request.executorResolution.state === 'resolved'
    ? request.executorResolution.commandPreview
    : undefined;
  const result = await runnerAdapter.runDryRunCommand({
    request,
    command: policyDecision.command,
    commandPreview,
  });

  return buildProjectWorkflowExecutorRunRecord(request, consumedBy, consumedAt, {
    state: 'completed',
    exitCode: result.exitCode,
    stdoutPreview: result.stdoutPreview,
    stderrPreview: result.stderrPreview,
  });
}

export async function runProjectWorkflowExecutorLive(
  request: ProjectWorkflowExecutionRequestPackage,
  workingDir: string,
  consumedBy: string,
  consumedAt: string,
  liveRunnerAdapter: ProjectWorkflowExecutorLiveRunnerAdapter = DEFAULT_LIVE_RUNNER_ADAPTER,
): Promise<ProjectWorkflowExecutorRunRecord> {
  const policyDecision = evaluateProjectWorkflowLiveExecutionRequestConsumption(request);
  const commandPreview = request.executorResolution.state === 'resolved'
    ? request.executorResolution.commandPreview
    : undefined;

  if (policyDecision.state === 'blocked') {
    return {
      schemaVersion: 1,
      id: `${request.id}:live:${safeFileSegment(consumedAt)}`,
      requestId: request.id,
      workflowRunId: request.workflowRunId,
      workItemId: request.workItemId,
      nodeId: request.nodeId,
      nodeTitle: request.nodeTitle,
      draftId: request.draftId,
      status: 'blocked_by_policy',
      consumedBy,
      consumedAt,
      executionState: request.executionState,
      capabilityId: request.capabilityId,
      commandPreview,
      command: undefined,
      policyDecision,
      runnerResult: {
        state: 'blocked',
        reason: policyDecision.reason,
      },
      safetyNotice: 'Live executor was blocked before process spawn.',
    };
  }

  const result = await liveRunnerAdapter.spawnLiveCommand({
    request,
    command: policyDecision.command,
    commandPreview,
    workingDir,
  });

  return {
    schemaVersion: 1,
    id: `${request.id}:live:${safeFileSegment(consumedAt)}`,
    requestId: request.id,
    workflowRunId: request.workflowRunId,
    workItemId: request.workItemId,
    nodeId: request.nodeId,
    nodeTitle: request.nodeTitle,
    draftId: request.draftId,
    status: 'live_spawned',
    consumedBy,
    consumedAt,
    executionState: request.executionState,
    capabilityId: request.capabilityId,
    workingDir,
    commandPreview,
    command: policyDecision.command,
    policyDecision,
    runnerResult: {
      state: 'spawned',
      pid: result.pid,
      spawnToken: result.spawnToken,
    },
    safetyNotice: 'Live executor spawn record only; process output is tracked by spawnToken events.',
  };
}

export function serializeProjectWorkflowExecutorRunRecord(
  record: ProjectWorkflowExecutorRunRecord,
): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

export async function saveProjectWorkflowExecutorHandoffRecord(
  projectRoot: string,
  record: ProjectWorkflowExecutorHandoffRecord,
  adapter: ProjectWorkflowExecutionRequestStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<string> {
  const path = projectWorkflowExecutorHandoffRecordPath(projectRoot, record.id);
  await adapter.writeFile(path, serializeProjectWorkflowExecutorHandoffRecord(record));
  return path;
}

export async function saveProjectWorkflowExecutorRunRecord(
  projectRoot: string,
  record: ProjectWorkflowExecutorRunRecord,
  adapter: ProjectWorkflowExecutionRequestStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<string> {
  const path = projectWorkflowExecutorHandoffRecordPath(projectRoot, record.id);
  await adapter.writeFile(path, serializeProjectWorkflowExecutorRunRecord(record));
  return path;
}

function buildProjectWorkflowExecutionRequest(
  run: ProjectWorkflowRun,
  draft: ProjectWorkflowExecutionDraft,
  executorRegistry?: ProjectWorkflowExecutorRegistry,
): ProjectWorkflowExecutionRequestPackage {
  const executorResolution = resolveProjectWorkflowDraftExecutor(draft, executorRegistry);
  const requestedAt = draft.runRequestedAt ?? draft.createdAt;
  const capabilityId = executorResolution.capabilityId;
  return {
    schemaVersion: 1,
    id: `${run.id}:${draft.id}:execution-request`,
    workflowRunId: run.id,
    workItemId: run.workItemId,
    nodeId: draft.nodeId,
    nodeTitle: draft.nodeTitle,
    draftId: draft.id,
    actorKind: draft.actorKind,
    status: 'pending_external_executor',
    executionState: executorResolution.executionState,
    reviewStatus: 'review_required',
    policyGate: {
      state: 'review_required',
      reason: 'Human review is required before any external executor may consume this request.',
    },
    requestedBy: draft.runRequestedBy ?? 'Unknown requester',
    requestedAt,
    createdAt: requestedAt,
    capabilityId,
    executorResolution,
    command: executorResolution.state === 'resolved' ? executorResolution.command : undefined,
    systemPromptLabel: draft.systemPromptLabel,
    taskPromptLabel: draft.taskPromptLabel,
    memoryFiles: expandFeatureMemoryFiles(run.workItemId, draft.memoryFiles),
    allowedTools: normalizeAllowedTools(draft),
    expectedHandoffArtifactId: draft.expectedHandoffArtifactId,
    expectedEvidenceIds: draft.expectedEvidenceIds,
    safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
  };
}

function expandFeatureMemoryFiles(workItemId: string, memoryFiles: string[]): string[] {
  const featureRoot = `.project-manager/features/${workItemId}`;
  return uniqueStrings([
    ...memoryFiles,
    `${featureRoot}/README.md`,
    `${featureRoot}/feature-spec.md`,
    `${featureRoot}/tdd-spec.md`,
    `${featureRoot}/test-scenarios.md`,
    `${featureRoot}/dev-log.md`,
  ]);
}

function normalizeAllowedTools(draft: ProjectWorkflowExecutionDraft): string[] {
  const normalizedRef = draft.actorKind === 'tool' ? `tool:${draft.nodeId}` : `${draft.actorKind}:${draft.nodeId}`;
  return uniqueStrings([normalizedRef, ...draft.allowedTools]);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
