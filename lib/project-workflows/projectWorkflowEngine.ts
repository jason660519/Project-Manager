export type ProjectWorkflowDiscipline =
  | 'software'
  | 'product'
  | 'project_management'
  | 'architecture'
  | 'structural'
  | 'civil'
  | 'mechanical'
  | 'electrical'
  | 'plumbing'
  | 'construction'
  | 'procurement'
  | 'legal'
  | 'finance'
  | 'qa'
  | 'operations';

export type ProjectWorkflowActorKind =
  | 'human'
  | 'ai_agent'
  | 'tool'
  | 'review_queue'
  | 'vendor'
  | 'authority'
  | 'client';

export type ProjectWorkflowNodeStatus = 'queued' | 'ready' | 'running' | 'succeeded' | 'blocked' | 'skipped';
export type ProjectWorkflowRunStatus = 'draft' | 'queued' | 'running' | 'blocked' | 'completed' | 'cancelled';
export type ProjectWorkflowEvidenceKind = 'document' | 'test_result' | 'command_output' | 'approval' | 'artifact';
export type ProjectWorkflowScorecardStatus = 'passed' | 'failed' | 'missing';
export type ProjectWorkflowExecutionMode = 'manual_only' | 'auto_safe_nodes' | 'paused';
export type ProjectWorkflowExecutionDraftStatus =
  | 'manual_run_required'
  | 'auto_run_allowed'
  | 'blocked_needs_approval'
  | 'policy_blocked'
  | 'run_requested';
export type ProjectWorkflowRiskLevel = 'low' | 'medium' | 'high';
export type ProjectWorkflowEventType =
  | 'run_created'
  | 'node_started'
  | 'node_completed'
  | 'node_ready'
  | 'approval_recorded'
  | 'stop_policy_blocked'
  | 'execution_draft_created'
  | 'execution_draft_blocked'
  | 'execution_mode_changed'
  | 'execution_draft_run_requested';

export interface ProjectWorkflowRuntimeHint {
  mode: 'manual' | 'agent' | 'tool' | 'external';
  actorKind: ProjectWorkflowActorKind;
  isolation: 'per-node-context' | 'worktree' | 'document-package' | 'shared-review-queue';
  execution: 'human-start-required' | 'eligible-for-safe-auto-run';
}

export interface ProjectWorkflowHandoffContract {
  artifactId: string;
  description: string;
  requiredFields: string[];
}

export interface ProjectWorkflowEvidenceRequirement {
  evidenceId: string;
  kind: ProjectWorkflowEvidenceKind;
  description: string;
  required: boolean;
}

export interface ProjectWorkflowScorecardDefinition {
  scorecardId: string;
  description: string;
  required: boolean;
}

export interface ProjectWorkflowApprovalGateDefinition {
  gateId: string;
  title: string;
  requiredBeforeNodeId: string;
  approverRole: string;
  reason: string;
}

export interface ProjectWorkflowStopPolicy {
  maxNodeAttempts: number;
  maxRunIterations: number;
  budgetLabel: string;
  scopeLock: string;
}

export interface ProjectWorkflowNodeDefinition {
  id: string;
  title: string;
  discipline: ProjectWorkflowDiscipline;
  actorKind: ProjectWorkflowActorKind;
  summary: string;
  dependsOn: string[];
  highRiskAction?: boolean;
  runtime: ProjectWorkflowRuntimeHint;
  handoffContract: ProjectWorkflowHandoffContract;
  evidenceRequirements: ProjectWorkflowEvidenceRequirement[];
  scorecards: ProjectWorkflowScorecardDefinition[];
}

export interface ProjectWorkflowTemplate {
  id: string;
  kind: 'project-workflow-loop';
  title: string;
  version: number;
  discipline: ProjectWorkflowDiscipline;
  isExampleTemplate: boolean;
  summary: string;
  trigger: 'manual' | 'heartbeat' | 'event';
  nodes: ProjectWorkflowNodeDefinition[];
  approvalGates: ProjectWorkflowApprovalGateDefinition[];
  stopPolicy: ProjectWorkflowStopPolicy;
}

export interface ProjectWorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CreateProjectWorkflowRunInput {
  projectId: string;
  workItemId: string;
  createdBy?: string;
  now?: string;
}

export interface ProjectWorkflowNodeRun {
  id: string;
  workflowRunId: string;
  nodeId: string;
  title: string;
  status: ProjectWorkflowNodeStatus;
  attempts: number;
  dependencies: string[];
  actorKind: ProjectWorkflowActorKind;
  highRiskAction: boolean;
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
}

export interface ProjectWorkflowHandoffArtifact {
  artifactId: string;
  nodeId: string;
  summary: string;
  fields: Record<string, string>;
  producedAt: string;
}

export interface ProjectWorkflowEvidenceRecord {
  evidenceId: string;
  nodeId: string;
  kind: ProjectWorkflowEvidenceKind;
  summary: string;
  uri?: string;
  recordedAt: string;
}

export interface ProjectWorkflowScorecardResult {
  scorecardId: string;
  nodeId?: string;
  status: ProjectWorkflowScorecardStatus;
  summary: string;
  evaluatedAt?: string;
}

export interface ProjectWorkflowApprovalRecord {
  gateId: string;
  approvedBy: string;
  approvedAt: string;
}

export interface ProjectWorkflowEvent {
  type: ProjectWorkflowEventType;
  occurredAt: string;
  summary: string;
  nodeId?: string;
  gateId?: string;
}

export interface ProjectWorkflowExecutionDraft {
  id: string;
  workflowRunId: string;
  nodeId: string;
  nodeTitle: string;
  actorKind: ProjectWorkflowActorKind;
  status: ProjectWorkflowExecutionDraftStatus;
  riskLevel: ProjectWorkflowRiskLevel;
  runModeAtCreation: ProjectWorkflowExecutionMode;
  systemPromptLabel: string;
  taskPromptLabel: string;
  memoryFiles: string[];
  allowedTools: string[];
  expectedHandoffArtifactId: string;
  expectedEvidenceIds: string[];
  autoRunEligible: boolean;
  eligibilityReason: string;
  integrationPolicy: {
    requiresRegisteredCapability: boolean;
    capabilityId?: string;
    policyState: 'not_required' | 'pending_integration_hub' | 'ready';
  };
  runRequestedBy?: string;
  runRequestedAt?: string;
  executionResult?: 'pending_external_executor';
  createdAt: string;
}

export interface ProjectWorkflowRun {
  id: string;
  templateId: string;
  templateVersion: number;
  projectId: string;
  workItemId: string;
  status: ProjectWorkflowRunStatus;
  executionMode: ProjectWorkflowExecutionMode;
  executionStarted: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  nodeRuns: ProjectWorkflowNodeRun[];
  executionDrafts: ProjectWorkflowExecutionDraft[];
  handoffArtifacts: ProjectWorkflowHandoffArtifact[];
  evidenceLedger: ProjectWorkflowEvidenceRecord[];
  scorecardResults: ProjectWorkflowScorecardResult[];
  approvals: ProjectWorkflowApprovalRecord[];
  events: ProjectWorkflowEvent[];
  nextAction: string;
  blockedReason?: string;
}

export interface CompleteProjectWorkflowNodeInput {
  completedAt?: string;
  handoff: {
    artifactId: string;
    summary: string;
    fields: Record<string, string>;
  };
  evidence: Array<{
    evidenceId: string;
    kind: ProjectWorkflowEvidenceKind;
    summary: string;
    uri?: string;
  }>;
  scorecardResults: Array<{
    scorecardId: string;
    status: ProjectWorkflowScorecardStatus;
    summary: string;
  }>;
}

export interface ProjectWorkflowApprovalInput {
  gateId: string;
  approvedBy: string;
  approvedAt?: string;
}

export type ProjectWorkflowApprovalResult =
  | { status: 'approved'; run: ProjectWorkflowRun; reason?: undefined }
  | { status: 'blocked'; run: ProjectWorkflowRun; reason: string };

const SOFTWARE_ENGINEERING_LOOP: ProjectWorkflowTemplate = {
  id: 'software-engineering-loop',
  kind: 'project-workflow-loop',
  title: 'Software Engineering Loop',
  version: 1,
  discipline: 'software',
  isExampleTemplate: true,
  summary:
    'Software Engineering Loop is the first built-in template and not the engine boundary for Project Workflow loops.',
  trigger: 'manual',
  stopPolicy: {
    maxNodeAttempts: 2,
    maxRunIterations: 8,
    budgetLabel: 'bounded PM-approved loop budget',
    scopeLock: 'Declared work package, required outputs, and approval policy only.',
  },
  approvalGates: [
    {
      gateId: 'human-pr-approval',
      title: 'Human PR Preparation Approval',
      requiredBeforeNodeId: 'pr-preparation',
      approverRole: 'Human lead',
      reason: 'PR preparation is a high-risk external project action and must be explicitly approved.',
    },
  ],
  nodes: [
    projectNode({
      id: 'intake',
      title: 'Intake',
      actorKind: 'human',
      summary: 'Confirm work item scope, constraints, required outputs, and approval policy.',
      dependsOn: [],
      handoffArtifactId: 'intake-brief',
      evidence: [{ evidenceId: 'feature-spec', kind: 'document', description: 'Approved feature or work spec.' }],
    }),
    projectNode({
      id: 'analysis',
      title: 'Analysis',
      actorKind: 'ai_agent',
      summary: 'Analyze the work item and produce bounded implementation packages.',
      dependsOn: ['intake'],
      handoffArtifactId: 'analysis-plan',
      evidence: [{ evidenceId: 'implementation-plan', kind: 'document', description: 'Scoped plan and risk matrix.' }],
    }),
    projectNode({
      id: 'implementation',
      title: 'Implementation',
      actorKind: 'ai_agent',
      summary: 'Implement the approved work package inside isolated context.',
      dependsOn: ['analysis'],
      handoffArtifactId: 'implementation-handoff',
      evidence: [{ evidenceId: 'changed-files', kind: 'artifact', description: 'Changed files and implementation summary.' }],
    }),
    projectNode({
      id: 'verification',
      title: 'Verification',
      actorKind: 'tool',
      summary: 'Run focused checks and collect test evidence.',
      dependsOn: ['implementation'],
      handoffArtifactId: 'verification-results',
      evidence: [{ evidenceId: 'focused-tests', kind: 'test_result', description: 'Focused test command and output.' }],
    }),
    projectNode({
      id: 'quality-gate',
      title: 'Quality Gate',
      actorKind: 'review_queue',
      summary: 'Review evidence, scope lock, risk controls, and scorecards.',
      dependsOn: ['verification'],
      handoffArtifactId: 'quality-gate-report',
      evidence: [{ evidenceId: 'quality-review', kind: 'document', description: 'Quality gate review result.' }],
    }),
    projectNode({
      id: 'human-approval',
      title: 'Human Approval',
      actorKind: 'human',
      summary: 'Human lead decides whether the loop may prepare an external PR handoff.',
      dependsOn: ['quality-gate'],
      handoffArtifactId: 'human-approval-note',
      evidence: [{ evidenceId: 'human-approval', kind: 'approval', description: 'Explicit approval note.' }],
    }),
    projectNode({
      id: 'pr-preparation',
      title: 'PR Preparation',
      actorKind: 'ai_agent',
      summary: 'Prepare PR materials after human approval; do not push without the shipping workflow.',
      dependsOn: ['human-approval'],
      highRiskAction: true,
      handoffArtifactId: 'pr-prep-package',
      evidence: [{ evidenceId: 'pr-readiness', kind: 'document', description: 'PR body and verification summary.' }],
    }),
    projectNode({
      id: 'report',
      title: 'Report',
      actorKind: 'human',
      summary: 'Summarize loop outcomes, evidence, remaining risks, and next decisions.',
      dependsOn: ['pr-preparation'],
      handoffArtifactId: 'loop-report',
      evidence: [{ evidenceId: 'final-report', kind: 'document', description: 'Final loop report.' }],
    }),
  ],
};

const CONSTRUCTION_QUALITY_LOOP: ProjectWorkflowTemplate = {
  id: 'construction-quality-loop',
  kind: 'project-workflow-loop',
  title: 'Construction Quality Loop',
  version: 1,
  discipline: 'construction',
  isExampleTemplate: false,
  summary:
    'Construction Quality Loop coordinates site intake, inspection, QA review, procurement impact, PM approval, and operations handoff.',
  trigger: 'manual',
  stopPolicy: {
    maxNodeAttempts: 2,
    maxRunIterations: 6,
    budgetLabel: 'bounded site-quality loop budget',
    scopeLock: 'Declared inspection package, defect evidence, procurement impact, and PM approval only.',
  },
  approvalGates: [
    {
      gateId: 'pm-closeout-approval',
      title: 'PM Closeout Approval',
      requiredBeforeNodeId: 'operations-handoff',
      approverRole: 'Project manager',
      reason: 'Site quality closeout changes downstream trade sequencing and needs explicit PM approval.',
    },
  ],
  nodes: [
    projectNode({
      id: 'site-intake',
      title: 'Site Intake',
      discipline: 'construction',
      actorKind: 'human',
      summary: 'Confirm inspection scope, location, drawings, constraints, and affected trades.',
      dependsOn: [],
      isolation: 'document-package',
      handoffArtifactId: 'site-intake-brief',
      evidence: [{ evidenceId: 'inspection-scope', kind: 'document', description: 'Inspection scope and location package.' }],
    }),
    projectNode({
      id: 'field-inspection',
      title: 'Field Inspection',
      discipline: 'construction',
      actorKind: 'vendor',
      summary: 'Capture field observations, defects, photos, and immediate safety constraints.',
      dependsOn: ['site-intake'],
      isolation: 'document-package',
      handoffArtifactId: 'field-inspection-report',
      evidence: [{ evidenceId: 'photo-log', kind: 'artifact', description: 'Photo log and defect observations.' }],
    }),
    projectNode({
      id: 'qa-review',
      title: 'QA Review',
      discipline: 'qa',
      actorKind: 'review_queue',
      summary: 'Review field evidence against checklist and acceptance criteria.',
      dependsOn: ['field-inspection'],
      isolation: 'shared-review-queue',
      handoffArtifactId: 'qa-review-note',
      evidence: [{ evidenceId: 'qa-checklist', kind: 'document', description: 'Completed QA checklist.' }],
    }),
    projectNode({
      id: 'procurement-impact',
      title: 'Procurement Impact',
      discipline: 'procurement',
      actorKind: 'human',
      summary: 'Assess whether defects affect lead times, replacements, vendors, or cost risk.',
      dependsOn: ['qa-review'],
      isolation: 'document-package',
      handoffArtifactId: 'procurement-impact-note',
      evidence: [{ evidenceId: 'vendor-impact', kind: 'document', description: 'Vendor and material impact note.' }],
    }),
    projectNode({
      id: 'pm-approval',
      title: 'PM Approval',
      discipline: 'project_management',
      actorKind: 'human',
      summary: 'Approve closeout, rework, or escalation path.',
      dependsOn: ['procurement-impact'],
      isolation: 'per-node-context',
      handoffArtifactId: 'pm-approval-note',
      evidence: [{ evidenceId: 'pm-decision', kind: 'approval', description: 'PM decision record.' }],
    }),
    projectNode({
      id: 'operations-handoff',
      title: 'Operations Handoff',
      discipline: 'operations',
      actorKind: 'human',
      summary: 'Hand approved outcome to operations or next trade sequencing.',
      dependsOn: ['pm-approval'],
      highRiskAction: true,
      isolation: 'document-package',
      handoffArtifactId: 'operations-handoff',
      evidence: [{ evidenceId: 'handoff-record', kind: 'document', description: 'Operations handoff record.' }],
    }),
  ],
};

const PROJECT_WORKFLOW_TEMPLATES: ProjectWorkflowTemplate[] = [SOFTWARE_ENGINEERING_LOOP, CONSTRUCTION_QUALITY_LOOP];

function projectNode(input: {
  id: string;
  title: string;
  discipline?: ProjectWorkflowDiscipline;
  actorKind: ProjectWorkflowActorKind;
  summary: string;
  dependsOn: string[];
  handoffArtifactId: string;
  evidence: Array<{ evidenceId: string; kind: ProjectWorkflowEvidenceKind; description: string }>;
  highRiskAction?: boolean;
  isolation?: ProjectWorkflowRuntimeHint['isolation'];
}): ProjectWorkflowNodeDefinition {
  return {
    id: input.id,
    title: input.title,
    discipline: input.discipline ?? 'software',
    actorKind: input.actorKind,
    summary: input.summary,
    dependsOn: input.dependsOn,
    highRiskAction: input.highRiskAction,
    runtime: {
      mode: input.actorKind === 'human' ? 'manual' : input.actorKind === 'tool' ? 'tool' : 'agent',
      actorKind: input.actorKind,
      isolation: input.isolation ?? (input.id === 'implementation' ? 'worktree' : 'per-node-context'),
      execution: 'human-start-required',
    },
    handoffContract: {
      artifactId: input.handoffArtifactId,
      description: `${input.title} structured handoff artifact.`,
      requiredFields: ['summary'],
    },
    evidenceRequirements: input.evidence.map((evidence) => ({ ...evidence, required: true })),
    scorecards: [
      {
        scorecardId: 'required-handoff',
        description: 'Required structured handoff artifact is present.',
        required: true,
      },
    ],
  };
}

function nowIso(input?: string): string {
  return input ?? new Date().toISOString();
}

function runId(templateId: string, workItemId: string, now: string): string {
  const stamp = now.replace(/[^0-9]/g, '').slice(0, 14) || 'run';
  const safeWorkItem = workItemId.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `project-workflow-run-${safeWorkItem}-${templateId}-${stamp}`;
}

export function listProjectWorkflowTemplates(): ProjectWorkflowTemplate[] {
  return PROJECT_WORKFLOW_TEMPLATES;
}

export function getProjectWorkflowTemplateById(id: string): ProjectWorkflowTemplate | undefined {
  return PROJECT_WORKFLOW_TEMPLATES.find((template) => template.id === id);
}

export function validateProjectWorkflowTemplate(template: ProjectWorkflowTemplate): ProjectWorkflowValidationResult {
  const errors: string[] = [];
  if (template.kind !== 'project-workflow-loop') errors.push('Template kind must be project-workflow-loop.');
  if (template.nodes.length === 0) errors.push('Template must include at least one node.');
  if (template.stopPolicy.maxNodeAttempts < 1) errors.push('Stop policy must allow at least one node attempt.');
  if (!template.stopPolicy.scopeLock.trim()) errors.push('Stop policy must include a scope lock.');

  const nodeIds = new Set<string>();
  for (const node of template.nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    if (!node.handoffContract.artifactId) errors.push(`Node ${node.id} is missing a handoff contract.`);
    if (node.scorecards.some((scorecard) => scorecard.required) === false) {
      errors.push(`Node ${node.id} must include at least one required scorecard.`);
    }
  }
  for (const node of template.nodes) {
    for (const dependency of node.dependsOn) {
      if (!nodeIds.has(dependency)) errors.push(`Node ${node.id} depends on missing node ${dependency}.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function createProjectWorkflowRun(
  template: ProjectWorkflowTemplate,
  input: CreateProjectWorkflowRunInput,
): ProjectWorkflowRun {
  const createdAt = nowIso(input.now);
  const id = runId(template.id, input.workItemId, createdAt);
  return {
    id,
    templateId: template.id,
    templateVersion: template.version,
    projectId: input.projectId,
    workItemId: input.workItemId,
    status: 'queued',
    executionMode: 'manual_only',
    executionStarted: false,
    createdAt,
    updatedAt: createdAt,
    createdBy: input.createdBy,
    nodeRuns: template.nodes.map((node) => ({
      id: `${id}:${node.id}`,
      workflowRunId: id,
      nodeId: node.id,
      title: node.title,
      status: node.dependsOn.length === 0 ? 'ready' : 'queued',
      attempts: 0,
      dependencies: [...node.dependsOn],
      actorKind: node.actorKind,
      highRiskAction: node.highRiskAction === true,
    })),
    executionDrafts: [],
    handoffArtifacts: [],
    evidenceLedger: [],
    scorecardResults: [],
    approvals: [],
    events: [
      {
        type: 'run_created',
        occurredAt: createdAt,
        summary: 'Workflow run created; no actor or command executed.',
      },
    ],
    nextAction: 'Human lead reviews ready nodes and starts execution explicitly.',
  };
}

export function startProjectWorkflowNode(
  template: ProjectWorkflowTemplate,
  run: ProjectWorkflowRun,
  nodeId: string,
  now?: string,
): ProjectWorkflowRun {
  const node = requireNode(template, nodeId);
  const occurredAt = nowIso(now);
  const current = run.nodeRuns.find((nodeRun) => nodeRun.nodeId === nodeId);
  if (!current) throw new Error(`Unknown project workflow node: ${nodeId}`);
  const executionMode = run.executionMode ?? 'manual_only';
  if (executionMode === 'paused') {
    const reason = `Execution mode is paused; node ${nodeId} cannot start.`;
    return blockRun({
      ...run,
      executionMode,
      executionDrafts: run.executionDrafts ?? [],
      updatedAt: occurredAt,
      events: [
        ...run.events,
        {
          type: 'execution_draft_blocked',
          occurredAt,
          nodeId,
          summary: reason,
        },
      ],
    }, reason);
  }
  if (current.attempts >= template.stopPolicy.maxNodeAttempts) {
    const reason = `Stop policy reached max attempts for node ${nodeId}.`;
    return blockRun({
      ...run,
      executionMode,
      executionDrafts: run.executionDrafts ?? [],
      updatedAt: occurredAt,
      nodeRuns: run.nodeRuns.map((nodeRun) =>
        nodeRun.nodeId === nodeId
          ? { ...nodeRun, status: 'blocked', blockedReason: reason }
          : nodeRun,
      ),
      events: [
        ...run.events,
        {
          type: 'stop_policy_blocked',
          occurredAt,
          nodeId,
          summary: reason,
        },
      ],
    }, reason);
  }
  const nextAttempt = current.attempts + 1;
  const draft = createExecutionDraft(template, run, node, executionMode, nextAttempt, occurredAt);

  return {
    ...run,
    status: 'running',
    executionMode,
    executionStarted: true,
    updatedAt: occurredAt,
    nodeRuns: run.nodeRuns.map((nodeRun) =>
      nodeRun.nodeId === nodeId
        ? {
            ...nodeRun,
            status: 'running',
            attempts: nextAttempt,
            startedAt: occurredAt,
            blockedReason: undefined,
          }
        : nodeRun,
    ),
    executionDrafts: [...(run.executionDrafts ?? []), draft],
    events: [
      ...run.events,
      {
        type: 'node_started',
        occurredAt,
        nodeId: node.id,
        summary: `${node.title} started.`,
      },
      {
        type: 'execution_draft_created',
        occurredAt,
        nodeId: node.id,
        summary: `Execution draft created for ${node.title}: ${draft.eligibilityReason}`,
      },
    ],
  };
}

export function setProjectWorkflowExecutionMode(
  run: ProjectWorkflowRun,
  executionMode: ProjectWorkflowExecutionMode,
  changedBy: string,
  now?: string,
): ProjectWorkflowRun {
  const occurredAt = nowIso(now);
  return {
    ...run,
    executionMode,
    updatedAt: occurredAt,
    events: [
      ...run.events,
      {
        type: 'execution_mode_changed',
        occurredAt,
        summary: `Execution mode changed to ${executionMode} by ${changedBy}.`,
      },
    ],
    nextAction: executionMode === 'paused'
      ? 'Workflow run is paused. Human lead may inspect drafts but cannot start nodes until resumed.'
      : executionMode === 'auto_safe_nodes'
        ? 'Safe low-risk agent/tool nodes may create auto-run eligible drafts; high-risk nodes remain approval-gated.'
        : 'Human lead reviews ready nodes and starts execution explicitly.',
  };
}

export function requestProjectWorkflowDraftRun(
  run: ProjectWorkflowRun,
  draftId: string,
  requestedBy: string,
  now?: string,
): ProjectWorkflowRun {
  const occurredAt = nowIso(now);
  const draft = (run.executionDrafts ?? []).find((candidate) => candidate.id === draftId);
  if (!draft) throw new Error(`Unknown project workflow execution draft: ${draftId}`);
  if (draft.status === 'blocked_needs_approval' || draft.status === 'policy_blocked') {
    return blockRun({
      ...run,
      updatedAt: occurredAt,
      events: [
        ...run.events,
        {
          type: 'execution_draft_blocked',
          occurredAt,
          nodeId: draft.nodeId,
          summary: `Execution draft ${draftId} cannot run: ${draft.eligibilityReason}`,
        },
      ],
    }, draft.eligibilityReason);
  }

  return {
    ...run,
    updatedAt: occurredAt,
    executionDrafts: (run.executionDrafts ?? []).map((candidate) =>
      candidate.id === draftId
        ? {
            ...candidate,
            status: 'run_requested',
            runRequestedBy: requestedBy,
            runRequestedAt: occurredAt,
            executionResult: 'pending_external_executor',
          }
        : candidate,
    ),
    events: [
      ...run.events,
      {
        type: 'execution_draft_run_requested',
        occurredAt,
        nodeId: draft.nodeId,
        summary: `Execution draft requested by ${requestedBy}; no external actor or tool was executed by Project Manager.`,
      },
    ],
    nextAction: 'Execution draft run request recorded. External executor integration remains pending.',
  };
}

export function autoRequestEligibleProjectWorkflowDrafts(
  run: ProjectWorkflowRun,
  requestedBy: string,
  now?: string,
): ProjectWorkflowRun {
  const occurredAt = nowIso(now);
  const eligibleDrafts = (run.executionDrafts ?? []).filter((draft) => draft.status === 'auto_run_allowed');
  if (eligibleDrafts.length === 0) return run;

  const eligibleDraftIds = new Set(eligibleDrafts.map((draft) => draft.id));
  return {
    ...run,
    updatedAt: occurredAt,
    executionDrafts: (run.executionDrafts ?? []).map((draft) =>
      eligibleDraftIds.has(draft.id)
        ? {
            ...draft,
            status: 'run_requested',
            runRequestedBy: requestedBy,
            runRequestedAt: occurredAt,
            executionResult: 'pending_external_executor',
          }
        : draft,
    ),
    events: [
      ...run.events,
      ...eligibleDrafts.map((draft) => ({
        type: 'execution_draft_run_requested' as const,
        occurredAt,
        nodeId: draft.nodeId,
        summary: `Execution draft auto-requested by ${requestedBy}; no external actor or tool was executed by Project Manager.`,
      })),
    ],
    nextAction: 'Auto-run eligible execution draft request recorded. External executor integration remains pending.',
  };
}

export function completeProjectWorkflowNode(
  run: ProjectWorkflowRun,
  nodeId: string,
  input: CompleteProjectWorkflowNodeInput,
): ProjectWorkflowRun {
  const template = requireTemplate(run.templateId);
  const node = requireNode(template, nodeId);
  const completedAt = nowIso(input.completedAt);
  const missingEvidence = node.evidenceRequirements
    .filter((requirement) => requirement.required)
    .filter((requirement) => !input.evidence.some((record) => record.evidenceId === requirement.evidenceId));
  const missingScorecards = node.scorecards
    .filter((scorecard) => scorecard.required)
    .filter((scorecard) => !input.scorecardResults.some((result) => result.scorecardId === scorecard.scorecardId && result.status === 'passed'));
  const failedScorecards = input.scorecardResults.filter((result) => result.status === 'failed');
  const blockedReasons = [
    ...missingEvidence.map((requirement) => `Missing required evidence: ${requirement.evidenceId}`),
    ...missingScorecards.map((scorecard) => `Missing required scorecard: ${scorecard.scorecardId}`),
    ...failedScorecards.map((scorecard) => `Failed scorecard: ${scorecard.scorecardId}`),
  ];
  const isBlocked = blockedReasons.length > 0;

  const nextRun: ProjectWorkflowRun = {
    ...run,
    updatedAt: completedAt,
    handoffArtifacts: [
      ...run.handoffArtifacts,
      {
        artifactId: input.handoff.artifactId,
        nodeId,
        summary: input.handoff.summary,
        fields: input.handoff.fields,
        producedAt: completedAt,
      },
    ],
    evidenceLedger: [
      ...run.evidenceLedger,
      ...input.evidence.map((evidence) => ({
        ...evidence,
        nodeId,
        recordedAt: completedAt,
      })),
    ],
    scorecardResults: [
      ...run.scorecardResults,
      ...input.scorecardResults.map((scorecard) => ({
        ...scorecard,
        nodeId,
        evaluatedAt: completedAt,
      })),
    ],
    events: [
      ...run.events,
      {
        type: 'node_completed',
        occurredAt: completedAt,
        nodeId,
        summary: isBlocked ? `Node ${nodeId} blocked: ${blockedReasons.join('; ')}` : `Node ${nodeId} completed.`,
      },
    ],
    nodeRuns: run.nodeRuns.map((nodeRun) =>
      nodeRun.nodeId === nodeId
        ? {
            ...nodeRun,
            status: isBlocked ? 'blocked' : 'succeeded',
            completedAt,
            blockedReason: blockedReasons.join('; ') || undefined,
          }
        : nodeRun,
    ),
  };

  return recomputeRun(nextRun);
}

export function approveProjectWorkflowRun(
  run: ProjectWorkflowRun,
  input: ProjectWorkflowApprovalInput,
): ProjectWorkflowApprovalResult {
  const template = requireTemplate(run.templateId);
  const gate = template.approvalGates.find((approvalGate) => approvalGate.gateId === input.gateId);
  if (!gate) {
    const blocked = blockRun(run, `Unknown approval gate: ${input.gateId}`);
    return { status: 'blocked', run: blocked, reason: blocked.blockedReason ?? 'Unknown approval gate.' };
  }

  const targetNode = run.nodeRuns.find((nodeRun) => nodeRun.nodeId === gate.requiredBeforeNodeId);
  const dependenciesReady = targetNode
    ? targetNode.dependencies.every((dependency) =>
        run.nodeRuns.some((nodeRun) => nodeRun.nodeId === dependency && nodeRun.status === 'succeeded'),
      )
    : false;

  if (!dependenciesReady) {
    const blocked = blockRun(run, `approval gate is not ready: ${gate.title}.`);
    return { status: 'blocked', run: blocked, reason: blocked.blockedReason ?? 'Approval gate is not ready.' };
  }

  const approvedAt = nowIso(input.approvedAt);
  return {
    status: 'approved',
    run: {
      ...run,
      updatedAt: approvedAt,
      approvals: [
        ...run.approvals,
        {
          gateId: input.gateId,
          approvedBy: input.approvedBy,
          approvedAt,
        },
      ],
      events: [
        ...run.events,
        {
          type: 'approval_recorded',
          occurredAt: approvedAt,
          gateId: input.gateId,
          nodeId: gate.requiredBeforeNodeId,
          summary: `${gate.title} approved by ${input.approvedBy}.`,
        },
      ],
      nextAction: 'Approved gate recorded. Human lead may start the next ready node explicitly.',
    },
  };
}

export function renderProjectWorkflowDecisionPackage(
  template: ProjectWorkflowTemplate,
  run: ProjectWorkflowRun,
): string {
  const nodeLines = run.nodeRuns.map((nodeRun) => {
    const dependencies = nodeRun.dependencies.length > 0 ? nodeRun.dependencies.join(', ') : 'none';
    return `- ${nodeRun.title} (${nodeRun.nodeId}): ${nodeRun.status}; actor=${nodeRun.actorKind}; dependsOn=${dependencies}`;
  });
  const scorecards = template.nodes.flatMap((node) =>
    node.scorecards.map((scorecard) => `- ${node.id}/${scorecard.scorecardId}: ${scorecard.description}`),
  );
  const gates = template.approvalGates.map((gate) => `- ${gate.title}: ${gate.reason}`);

  return [
    '# Project Workflow Loop Decision Package',
    '',
    `Template: ${template.title}`,
    `Run status: ${run.status}`,
    `Next action: ${run.nextAction}`,
    '',
    'Persistent memory: handoff artifacts and evidence ledger live outside the chat transcript.',
    '',
    '## Nodes',
    ...nodeLines,
    '',
    '## Handoff Contracts',
    ...template.nodes.map((node) => `- ${node.id}: ${node.handoffContract.artifactId}`),
    '',
    '## Scorecards',
    ...scorecards,
    '',
    '## Human approval gates',
    ...gates,
    '',
    '## Stop policy',
    `- Max node attempts: ${template.stopPolicy.maxNodeAttempts}`,
    `- Max run iterations: ${template.stopPolicy.maxRunIterations}`,
    `- Scope lock: ${template.stopPolicy.scopeLock}`,
    '',
    'No actor or command is executed by this package.',
  ].join('\n');
}

function createExecutionDraft(
  template: ProjectWorkflowTemplate,
  run: ProjectWorkflowRun,
  node: ProjectWorkflowNodeDefinition,
  executionMode: ProjectWorkflowExecutionMode,
  attempt: number,
  createdAt: string,
): ProjectWorkflowExecutionDraft {
  const highRisk = node.highRiskAction === true;
  const riskLevel: ProjectWorkflowRiskLevel = highRisk ? 'high' : node.actorKind === 'tool' ? 'medium' : 'low';
  const canAutoRunActor = node.actorKind === 'ai_agent' || node.actorKind === 'tool';
  const autoRunEligible = executionMode === 'auto_safe_nodes' && !highRisk && canAutoRunActor;
  const status: ProjectWorkflowExecutionDraftStatus =
    highRisk
      ? 'blocked_needs_approval'
      : autoRunEligible
        ? 'auto_run_allowed'
        : 'manual_run_required';
  const eligibilityReason = highRisk
    ? 'High-risk nodes cannot auto-run and require explicit approval/manual execution.'
    : executionMode === 'manual_only'
      ? 'Run is manual-only; human must run the draft explicitly.'
      : executionMode === 'auto_safe_nodes' && canAutoRunActor
        ? 'Run allows safe auto-run and node is low-risk with an agent/tool actor.'
        : 'Node actor is not eligible for auto-run; human must run the draft explicitly.';
  const capabilityId = node.actorKind === 'tool'
    ? `${template.discipline}:${node.id}:tool`
    : node.actorKind === 'ai_agent'
      ? `${template.discipline}:${node.id}:agent`
      : undefined;

  return {
    id: `${run.id}:${node.id}:draft-${attempt}`,
    workflowRunId: run.id,
    nodeId: node.id,
    nodeTitle: node.title,
    actorKind: node.actorKind,
    status,
    riskLevel,
    runModeAtCreation: executionMode,
    systemPromptLabel: systemPromptLabel(node),
    taskPromptLabel: `${node.title} task prompt for ${run.workItemId}`,
    memoryFiles: memoryFilesForRun(run),
    allowedTools: toolsForNode(node),
    expectedHandoffArtifactId: node.handoffContract.artifactId,
    expectedEvidenceIds: node.evidenceRequirements.filter((evidence) => evidence.required).map((evidence) => evidence.evidenceId),
    autoRunEligible,
    eligibilityReason,
    integrationPolicy: {
      requiresRegisteredCapability: node.actorKind === 'tool' || node.actorKind === 'ai_agent',
      capabilityId,
      policyState: node.actorKind === 'tool' ? 'pending_integration_hub' : capabilityId ? 'ready' : 'not_required',
    },
    createdAt,
  };
}

function systemPromptLabel(node: ProjectWorkflowNodeDefinition): string {
  const discipline = capitalize(node.discipline);
  if (node.actorKind === 'ai_agent') return `${discipline} PM workflow AI agent`;
  if (node.actorKind === 'tool') return `${discipline} PM workflow tool runner`;
  if (node.actorKind === 'review_queue') return `${discipline} PM review queue`;
  return `${discipline} PM workflow ${node.actorKind}`;
}

function toolsForNode(node: ProjectWorkflowNodeDefinition): string[] {
  if (node.actorKind === 'tool') return ['approved command runner', 'verification logs', 'evidence capture'];
  if (node.actorKind === 'ai_agent') return ['project files', 'feature docs', 'workflow memory'];
  if (node.actorKind === 'review_queue') return ['evidence ledger', 'scorecards', 'approval records'];
  return ['handoff form', 'evidence upload'];
}

function memoryFilesForRun(run: ProjectWorkflowRun): string[] {
  return [
    `.project-manager/features/${run.workItemId}/`,
    '.project-manager/project-workflow-runs/',
    'AGENTS.md',
  ];
}

function capitalize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function requireTemplate(templateId: string): ProjectWorkflowTemplate {
  const template = getProjectWorkflowTemplateById(templateId);
  if (!template) throw new Error(`Unknown project workflow template: ${templateId}`);
  return template;
}

function requireNode(template: ProjectWorkflowTemplate, nodeId: string): ProjectWorkflowNodeDefinition {
  const node = template.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Unknown project workflow node: ${nodeId}`);
  return node;
}

function blockRun(run: ProjectWorkflowRun, reason: string): ProjectWorkflowRun {
  return {
    ...run,
    status: 'blocked',
    blockedReason: reason,
    nextAction: `Human lead resolves blocked loop: ${reason}`,
  };
}

function recomputeRun(run: ProjectWorkflowRun): ProjectWorkflowRun {
  const blocked = run.nodeRuns.find((nodeRun) => nodeRun.status === 'blocked');
  if (blocked) {
    return blockRun(run, blocked.blockedReason ?? `Node ${blocked.nodeId} is blocked.`);
  }

  const succeeded = new Set(
    run.nodeRuns.filter((nodeRun) => nodeRun.status === 'succeeded' || nodeRun.status === 'skipped').map((nodeRun) => nodeRun.nodeId),
  );
  const readyEvents: ProjectWorkflowEvent[] = [];
  const nodeRuns = run.nodeRuns.map((nodeRun) => {
    if (nodeRun.status !== 'queued') return nodeRun;
    if (!nodeRun.dependencies.every((dependency) => succeeded.has(dependency))) return nodeRun;
    readyEvents.push({
      type: 'node_ready',
      occurredAt: run.updatedAt,
      nodeId: nodeRun.nodeId,
      summary: `Node ${nodeRun.nodeId} is ready after dependencies completed.`,
    });
    return { ...nodeRun, status: 'ready' as const };
  });

  const completed = nodeRuns.every((nodeRun) => nodeRun.status === 'succeeded' || nodeRun.status === 'skipped');
  return {
    ...run,
    status: completed ? 'completed' : nodeRuns.some((nodeRun) => nodeRun.status === 'running') ? 'running' : 'queued',
    nodeRuns,
    events: [...run.events, ...readyEvents],
    blockedReason: undefined,
    nextAction: completed
      ? 'Workflow loop completed. Human lead reviews final report and closes or starts the next loop.'
      : 'Human lead reviews ready nodes and starts execution explicitly.',
  };
}
