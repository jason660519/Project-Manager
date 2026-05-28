import type {
  AgentWorkflowDagDefinition,
  AgentWorkflowNodeRun,
  AgentWorkflowNodeRunErrorKind,
  AgentWorkflowRun,
  AgentWorkflowRunStatus,
} from './dagTypes';
import { buildAgentSessionScope } from './sessionScope';
import type { Feature } from '../types';

export interface CreateAgentWorkflowRunInput {
  projectId: string;
  featureId?: string;
  workflowRunId?: string;
  selectedBy?: string;
  now?: string;
}

export interface NodeFailureInput {
  reason: string;
  errorKind?: AgentWorkflowNodeRunErrorKind;
  now?: string;
}

export interface NodeSuccessInput {
  producedArtifactIds?: string[];
  checkpointId?: string;
  now?: string;
}

function nowIso(input?: string): string {
  return input ?? new Date().toISOString();
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function nextRunId(workflowId: string, featureId: string | undefined, now: string): string {
  const stamp = now.replace(/[^0-9]/g, '').slice(0, 14) || 'run';
  return `workflow-run-${safeId(featureId ?? 'feature')}-${safeId(workflowId)}-${stamp}`;
}

export function createAgentWorkflowRun(
  workflow: AgentWorkflowDagDefinition,
  input: CreateAgentWorkflowRunInput,
): AgentWorkflowRun {
  const createdAt = nowIso(input.now);
  const workflowRunId = input.workflowRunId ?? nextRunId(workflow.id, input.featureId, createdAt);

  const nodeRuns: AgentWorkflowNodeRun[] = workflow.nodes.map((node) => {
    const dependencies = [...(node.dependsOn ?? [])];
    const agentId = `${node.role}-${node.id}`;
    return {
      id: `${workflowRunId}:${node.id}`,
      workflowRunId,
      workflowId: workflow.id,
      nodeId: node.id,
      title: node.title,
      role: node.role,
      status: dependencies.length === 0 ? 'ready' : 'queued',
      attempts: 0,
      maxAttempts: node.retry.maxAttempts,
      retryOn: node.retry.retryOn,
      dependencies,
      parallelGroup: node.parallelGroup,
      sessionScope: buildAgentSessionScope({
        projectId: input.projectId,
        workflowId: workflow.id,
        workflowRunId,
        nodeId: node.id,
        agentId,
      }),
      runtime: node.runtime,
      model: node.model,
      outputArtifacts: node.outputContract.map((artifact) => ({
        artifactId: artifact.artifactId,
        nodeId: node.id,
        status: 'pending',
        required: artifact.required,
        description: artifact.description,
      })),
    };
  });

  return {
    id: workflowRunId,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    workflowTitle: workflow.title,
    projectId: input.projectId,
    featureId: input.featureId,
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    nodeRuns,
    selectedBy: input.selectedBy,
  };
}

export function listReadyWorkflowNodeRuns(run: AgentWorkflowRun): AgentWorkflowNodeRun[] {
  return run.nodeRuns.filter((nodeRun) => nodeRun.status === 'ready');
}

export function buildAgentWorkflowRunPrompt(
  workflow: AgentWorkflowDagDefinition,
  run: AgentWorkflowRun,
  feature: Feature,
  operatorPrompt: string,
): string {
  const nodeLines = run.nodeRuns.map((nodeRun) => {
    const dependencies = nodeRun.dependencies.length > 0 ? nodeRun.dependencies.join(', ') : 'none';
    const artifacts = nodeRun.outputArtifacts
      .filter((artifact) => artifact.required)
      .map((artifact) => artifact.artifactId)
      .join(', ') || 'none';
    return `- ${nodeRun.nodeId} [${nodeRun.role}] status=${nodeRun.status}; dependsOn=${dependencies}; requiredArtifacts=${artifacts}; sessionKey=node+agent isolated`;
  });

  return [
    `[Agent Workflow DAG: ${workflow.title}]`,
    `Workflow ID: ${workflow.id}@v${workflow.version}`,
    `WorkflowRun ID: ${run.id}`,
    `Run status: ${run.status}`,
    `Feature: [${feature.id}] ${feature.name}`,
    `Feature status: ${feature.status}`,
    `Feature progress: ${feature.progress}%`,
    '',
    'Coordinator instructions:',
    '- Treat this as a DAG-guided dispatch plan, not a hidden global chat memory.',
    '- Run ready nodes only after dependencies are satisfied.',
    '- Keep every worker session isolated by project + workflow + run + node + agent.',
    '- Downstream nodes should consume declared artifacts by default, not sibling worker transcripts.',
    '- Block before execution when a required tool, provider, model, permission, or memory scope is missing.',
    '',
    'Workflow nodes:',
    ...nodeLines,
    '',
    'Operator request:',
    operatorPrompt,
  ].join('\n');
}

export function startWorkflowNodeRun(
  run: AgentWorkflowRun,
  nodeId: string,
  now?: string,
): AgentWorkflowRun {
  const updatedAt = nowIso(now);
  return recomputeWorkflowRun({
    ...run,
    updatedAt,
    nodeRuns: run.nodeRuns.map((nodeRun) =>
      nodeRun.nodeId === nodeId
        ? {
            ...nodeRun,
            status: 'running',
            attempts: nodeRun.attempts + 1,
            startedAt: updatedAt,
            completedAt: undefined,
            blockedReason: undefined,
            errorKind: undefined,
          }
        : nodeRun,
    ),
  });
}

export function completeWorkflowNodeRun(
  run: AgentWorkflowRun,
  nodeId: string,
  input: NodeSuccessInput = {},
): AgentWorkflowRun {
  const updatedAt = nowIso(input.now);
  const produced = new Set(input.producedArtifactIds ?? []);
  return recomputeWorkflowRun({
    ...run,
    updatedAt,
    nodeRuns: run.nodeRuns.map((nodeRun) => {
      if (nodeRun.nodeId !== nodeId) return nodeRun;
      const missingRequired = produced.size > 0 && nodeRun.outputArtifacts.some(
        (artifact) => artifact.required && !produced.has(artifact.artifactId),
      );
      return {
        ...nodeRun,
        status: missingRequired ? 'blocked' : 'succeeded',
        completedAt: updatedAt,
        blockedReason: missingRequired ? 'Required output artifact was not produced.' : undefined,
        checkpointId: input.checkpointId ?? nodeRun.checkpointId,
        outputArtifacts: nodeRun.outputArtifacts.map((artifact) => {
          const shouldMarkProduced = produced.size === 0 || produced.has(artifact.artifactId);
          return shouldMarkProduced
            ? { ...artifact, status: 'produced', producedAt: updatedAt }
            : artifact.required
              ? { ...artifact, status: 'missing' }
              : artifact;
        }),
      };
    }),
  });
}

export function failWorkflowNodeRun(
  run: AgentWorkflowRun,
  nodeId: string,
  input: NodeFailureInput,
): AgentWorkflowRun {
  const updatedAt = nowIso(input.now);
  return recomputeWorkflowRun({
    ...run,
    updatedAt,
    nodeRuns: run.nodeRuns.map((nodeRun) => {
      if (nodeRun.nodeId !== nodeId) return nodeRun;
      const errorKind = input.errorKind ?? 'unknown';
      const retryable =
        nodeRun.attempts < nodeRun.maxAttempts &&
        nodeRun.retryOn.some((kind) => kind === errorKind);
      return {
        ...nodeRun,
        status: retryable ? 'ready' : 'failed',
        completedAt: retryable ? undefined : updatedAt,
        blockedReason: retryable ? undefined : input.reason,
        errorKind,
      };
    }),
  });
}

function recomputeWorkflowRun(run: AgentWorkflowRun): AgentWorkflowRun {
  const succeeded = new Set(
    run.nodeRuns
      .filter((nodeRun) => nodeRun.status === 'succeeded' || nodeRun.status === 'skipped')
      .map((nodeRun) => nodeRun.nodeId),
  );

  const nodeRuns = run.nodeRuns.map((nodeRun) => {
    if (nodeRun.status !== 'queued') return nodeRun;
    return nodeRun.dependencies.every((dependency) => succeeded.has(dependency))
      ? { ...nodeRun, status: 'ready' as const }
      : nodeRun;
  });

  const blocked = nodeRuns.find((nodeRun) => nodeRun.status === 'failed' || nodeRun.status === 'blocked');
  const status = computeRunStatus(nodeRuns, blocked);
  return {
    ...run,
    status,
    blockedReason: blocked?.blockedReason,
    nodeRuns,
  };
}

function computeRunStatus(
  nodeRuns: AgentWorkflowNodeRun[],
  blocked: AgentWorkflowNodeRun | undefined,
): AgentWorkflowRunStatus {
  if (blocked) return 'blocked';
  if (nodeRuns.every((nodeRun) => nodeRun.status === 'succeeded' || nodeRun.status === 'skipped')) {
    return 'completed';
  }
  if (nodeRuns.some((nodeRun) => nodeRun.status === 'running')) return 'running';
  return 'queued';
}
