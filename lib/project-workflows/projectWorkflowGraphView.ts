import type {
  ProjectWorkflowActorKind,
  ProjectWorkflowApprovalGateDefinition,
  ProjectWorkflowEvidenceRequirement,
  ProjectWorkflowNodeDefinition,
  ProjectWorkflowNodeRun,
  ProjectWorkflowRun,
  ProjectWorkflowScorecardDefinition,
  ProjectWorkflowScorecardStatus,
  ProjectWorkflowTemplate,
} from './projectWorkflowEngine';

export interface ProjectWorkflowGraphRunSummary {
  id: string;
  title: string;
  templateId: string;
  templateVersion: number;
  workItemId: string;
  status: ProjectWorkflowRun['status'];
  nextAction: string;
}

export interface ProjectWorkflowGraphNode {
  id: string;
  nodeId: string;
  title: string;
  actorKind: ProjectWorkflowActorKind;
  discipline: ProjectWorkflowNodeDefinition['discipline'];
  status: ProjectWorkflowNodeRun['status'];
  highRiskAction: boolean;
  attempts: number;
  maxAttempts: number;
  dependencies: string[];
  summary: string;
  systemPromptLabel: string;
  taskPromptLabel: string;
  tools: string[];
  memoryFiles: string[];
  inputArtifacts: string[];
  outputArtifact: string;
  evidenceRequirements: ProjectWorkflowEvidenceRequirement[];
  approvalGate?: ProjectWorkflowGraphApprovalGate;
}

export interface ProjectWorkflowGraphEdge {
  id: string;
  source: string;
  target: string;
  label: 'handoff' | 'approval';
}

export interface ProjectWorkflowGraphApprovalGate {
  gateId: string;
  title: string;
  approverRole: string;
  reason: string;
  requiredBeforeNodeId: string;
}

export interface ProjectWorkflowGraphScorecard extends ProjectWorkflowScorecardDefinition {
  status: ProjectWorkflowScorecardStatus;
  summary?: string;
}

export interface ProjectWorkflowGraphInspector extends ProjectWorkflowGraphNode {
  scorecards: ProjectWorkflowGraphScorecard[];
  reviewFirstActionLabel: string;
}

export interface ProjectWorkflowGraphMetrics {
  nodes: number;
  readyNodes: number;
  runningNodes: number;
  blockedNodes: number;
  completedNodes: number;
  approvalGates: number;
}

export interface ProjectWorkflowGraphView {
  run: ProjectWorkflowGraphRunSummary;
  metrics: ProjectWorkflowGraphMetrics;
  nodes: ProjectWorkflowGraphNode[];
  edges: ProjectWorkflowGraphEdge[];
  selectedNode?: ProjectWorkflowGraphNode;
  inspector?: ProjectWorkflowGraphInspector;
  safetyNotice: string;
}

export interface BuildProjectWorkflowGraphViewOptions {
  selectedNodeId?: string;
}

export function buildProjectWorkflowGraphView(
  template: ProjectWorkflowTemplate,
  run: ProjectWorkflowRun,
  options: BuildProjectWorkflowGraphViewOptions = {},
): ProjectWorkflowGraphView {
  const nodes = template.nodes.map((definition) => projectGraphNode(template, run, definition));
  const selectedNode =
    nodes.find((node) => node.nodeId === options.selectedNodeId) ??
    nodes.find((node) => node.status === 'ready') ??
    nodes[0];

  return {
    run: {
      id: run.id,
      title: template.title,
      templateId: template.id,
      templateVersion: template.version,
      workItemId: run.workItemId,
      status: run.status,
      nextAction: run.nextAction,
    },
    metrics: {
      nodes: nodes.length,
      readyNodes: nodes.filter((node) => node.status === 'ready').length,
      runningNodes: nodes.filter((node) => node.status === 'running').length,
      blockedNodes: nodes.filter((node) => node.status === 'blocked').length,
      completedNodes: nodes.filter((node) => node.status === 'succeeded').length,
      approvalGates: template.approvalGates.length,
    },
    nodes,
    edges: buildGraphEdges(template),
    selectedNode,
    inspector: selectedNode ? buildInspector(template, run, selectedNode) : undefined,
    safetyNotice: 'No actor or command is executed by this graph view. Nodes remain review-first until a human explicitly starts execution.',
  };
}

function projectGraphNode(
  template: ProjectWorkflowTemplate,
  run: ProjectWorkflowRun,
  definition: ProjectWorkflowNodeDefinition,
): ProjectWorkflowGraphNode {
  const nodeRun = run.nodeRuns.find((candidate) => candidate.nodeId === definition.id);
  if (!nodeRun) {
    throw new Error(`Project workflow run is missing node state for ${definition.id}.`);
  }
  return {
    id: nodeRun.id,
    nodeId: definition.id,
    title: definition.title,
    actorKind: definition.actorKind,
    discipline: definition.discipline,
    status: nodeRun.status,
    highRiskAction: definition.highRiskAction === true,
    attempts: nodeRun.attempts,
    maxAttempts: template.stopPolicy.maxNodeAttempts,
    dependencies: [...definition.dependsOn],
    summary: definition.summary,
    systemPromptLabel: systemPromptLabel(definition),
    taskPromptLabel: definition.summary,
    tools: toolsForNode(definition),
    memoryFiles: memoryFilesForRun(run),
    inputArtifacts: inputArtifactsForNode(template, definition),
    outputArtifact: definition.handoffContract.artifactId,
    evidenceRequirements: definition.evidenceRequirements,
    approvalGate: graphApprovalGateForNode(template.approvalGates, definition.id),
  };
}

function buildGraphEdges(template: ProjectWorkflowTemplate): ProjectWorkflowGraphEdge[] {
  return template.nodes.flatMap((node) =>
    node.dependsOn.map((dependency) => ({
      id: `${dependency}->${node.id}`,
      source: dependency,
      target: node.id,
      label: 'handoff' as const,
    })),
  );
}

function buildInspector(
  template: ProjectWorkflowTemplate,
  run: ProjectWorkflowRun,
  node: ProjectWorkflowGraphNode,
): ProjectWorkflowGraphInspector {
  const definition = template.nodes.find((candidate) => candidate.id === node.nodeId);
  if (!definition) throw new Error(`Unknown graph node definition: ${node.nodeId}`);
  return {
    ...node,
    scorecards: definition.scorecards.map((scorecard) => {
      const result = run.scorecardResults.find(
        (candidate) => candidate.nodeId === node.nodeId && candidate.scorecardId === scorecard.scorecardId,
      );
      return {
        ...scorecard,
        status: result?.status ?? 'missing',
        summary: result?.summary,
      };
    }),
    reviewFirstActionLabel:
      node.status === 'ready' || node.status === 'running' || node.highRiskAction
        ? 'Prepare manual start package'
        : 'Review node contract',
  };
}

function graphApprovalGateForNode(
  gates: ProjectWorkflowApprovalGateDefinition[],
  nodeId: string,
): ProjectWorkflowGraphApprovalGate | undefined {
  const gate = gates.find((candidate) => candidate.requiredBeforeNodeId === nodeId);
  if (!gate) return undefined;
  return {
    gateId: gate.gateId,
    title: gate.title,
    approverRole: gate.approverRole,
    reason: gate.reason,
    requiredBeforeNodeId: gate.requiredBeforeNodeId,
  };
}

function systemPromptLabel(node: ProjectWorkflowNodeDefinition): string {
  if (node.id === 'analysis') {
    return `${capitalize(node.discipline)} PM workflow analyst`;
  }
  if (node.actorKind === 'ai_agent') {
    return `${capitalize(node.discipline)} PM workflow agent`;
  }
  if (node.actorKind === 'tool') return `${capitalize(node.discipline)} PM workflow tool runner`;
  if (node.actorKind === 'review_queue') return `${capitalize(node.discipline)} PM review queue`;
  return `${capitalize(node.discipline)} PM workflow ${node.actorKind}`;
}

function toolsForNode(node: ProjectWorkflowNodeDefinition): string[] {
  if (node.actorKind === 'tool') return ['approved command runner', 'verification logs', 'evidence capture'];
  if (node.actorKind === 'ai_agent') return ['project files', 'feature docs', 'workflow memory'];
  if (node.actorKind === 'review_queue') return ['evidence ledger', 'scorecards', 'approval records'];
  return ['handoff forms', 'evidence upload'];
}

function memoryFilesForRun(run: ProjectWorkflowRun): string[] {
  return [`.project-manager/features/${run.workItemId}/`];
}

function inputArtifactsForNode(
  template: ProjectWorkflowTemplate,
  node: ProjectWorkflowNodeDefinition,
): string[] {
  return node.dependsOn.map((dependency) => {
    const dependencyNode = template.nodes.find((candidate) => candidate.id === dependency);
    return dependencyNode?.handoffContract.artifactId ?? dependency;
  });
}

function capitalize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
