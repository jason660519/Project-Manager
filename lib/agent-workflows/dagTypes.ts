export type AgentWorkflowDagKind = 'software-development' | 'deep-research';

export type AgentWorkflowNodeRole =
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'evaluator'
  | 'tester'
  | 'researcher'
  | 'writer'
  | 'summarizer';

export type AgentWorkflowRuntimeProvider =
  | 'local-process'
  | 'xmux'
  | 'e2b'
  | 'cube-sandbox'
  | 'hermes'
  | 'openclaw';

export type AgentWorkflowRuntimeIsolation = 'host-process' | 'container' | 'microvm';

export interface AgentWorkflowRuntimeProfile {
  provider: AgentWorkflowRuntimeProvider;
  isolation: AgentWorkflowRuntimeIsolation;
  templateId?: string;
  workingDirectoryMode: 'project-root' | 'ephemeral-copy' | 'mounted-worktree';
  pauseOnExit?: boolean;
}

export type AgentWorkflowModelSelection =
  | { mode: 'inherit-engineer-role' }
  | { mode: 'auto' }
  | { mode: 'explicit'; providerId: string; modelId: string };

export type AgentWorkflowToolSourceKind =
  | 'capability-candidate'
  | 'skill'
  | 'memory'
  | 'mcp'
  | 'command'
  | 'plugin'
  | 'adapter';

export interface AgentWorkflowToolRef {
  sourceKind: AgentWorkflowToolSourceKind;
  sourceId: string;
  required?: boolean;
  reason?: string;
}

export interface AgentWorkflowToolBundle {
  refs: AgentWorkflowToolRef[];
}

export interface AgentWorkflowSessionPolicy {
  isolation: 'per-node-agent';
  restore: 'new' | 'resume-latest' | 'resume-from-checkpoint';
  allowCrossNodeTranscriptRead?: boolean;
}

export interface AgentWorkflowRetryPolicy {
  maxAttempts: number;
  retryOn: ReadonlyArray<'runtime-error' | 'tool-unavailable' | 'validation-failed'>;
}

export interface AgentWorkflowOutputContract {
  artifactId: string;
  description: string;
  required: boolean;
}

export interface AgentWorkflowNodeDefinition {
  id: string;
  title: string;
  role: AgentWorkflowNodeRole;
  summary: string;
  dependsOn?: string[];
  parallelGroup?: string;
  runtime: AgentWorkflowRuntimeProfile;
  model: AgentWorkflowModelSelection;
  session: AgentWorkflowSessionPolicy;
  tools: AgentWorkflowToolBundle;
  retry: AgentWorkflowRetryPolicy;
  outputContract: AgentWorkflowOutputContract[];
}

export interface AgentWorkflowEdgeDefinition {
  from: string;
  to: string;
  label?: string;
}

export interface AgentWorkflowDagDefinition {
  id: string;
  title: string;
  version: number;
  kind: AgentWorkflowDagKind;
  summary: string;
  trigger: string;
  defaultRuntime: AgentWorkflowRuntimeProfile;
  nodes: AgentWorkflowNodeDefinition[];
  edges: AgentWorkflowEdgeDefinition[];
}

export interface AgentSessionScope {
  projectId: string;
  workflowId: string;
  workflowRunId: string;
  nodeId: string;
  agentId: string;
}

export type AgentWorkflowValidationCode =
  | 'empty_nodes'
  | 'duplicate_node_id'
  | 'dangling_edge'
  | 'dangling_dependency'
  | 'cycle_detected';

export interface AgentWorkflowValidationError {
  code: AgentWorkflowValidationCode;
  message: string;
  nodeId?: string;
  edge?: AgentWorkflowEdgeDefinition;
}

export interface AgentWorkflowValidationResult {
  valid: boolean;
  errors: AgentWorkflowValidationError[];
}
