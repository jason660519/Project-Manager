import type { AgentSessionScope } from './dagTypes';

function safeSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized.length > 0 ? normalized : 'unknown';
}

export function buildAgentSessionScope(scope: AgentSessionScope): AgentSessionScope {
  return {
    projectId: scope.projectId,
    workflowId: scope.workflowId,
    workflowRunId: scope.workflowRunId,
    nodeId: scope.nodeId,
    agentId: scope.agentId,
  };
}

export function agentSessionStoreKey(scope: AgentSessionScope): string {
  const segments = [
    ['project', scope.projectId],
    ['workflow', scope.workflowId],
    ['run', scope.workflowRunId],
    ['node', scope.nodeId],
    ['agent', scope.agentId],
  ].map(([label, value]) => `${label}-${safeSegment(value)}`);

  return `pm-agent-session__${segments.join('__')}`;
}

export function agentSessionDirectorySegments(scope: AgentSessionScope): string[] {
  return [
    safeSegment(scope.projectId),
    safeSegment(scope.workflowId),
    safeSegment(scope.workflowRunId),
    safeSegment(scope.nodeId),
    safeSegment(scope.agentId),
  ];
}
