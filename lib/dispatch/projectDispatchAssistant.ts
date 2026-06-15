import type { Feature } from '../types';

export type ProjectItemKind =
  | 'software_feature'
  | 'construction_task'
  | 'structural_review'
  | 'design_decision'
  | 'permit_item'
  | 'procurement_item'
  | 'inspection_item'
  | 'rfi'
  | 'change_order'
  | 'executive_report';

export type Discipline =
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

export type ActorKind =
  | 'human'
  | 'ai_agent'
  | 'tool'
  | 'review_queue'
  | 'vendor'
  | 'authority'
  | 'client';

export type DispatchPlanStatus = 'needs_review' | 'approved' | 'blocked';
export type AssignmentConfidence = 'high' | 'medium' | 'low' | 'none';
export type ExecutiveRelevance = 'low' | 'medium' | 'high';

export interface ActorProfile {
  id: string;
  kind: ActorKind;
  name: string;
  discipline?: Discipline;
  role: string;
  languages?: string[];
  capabilities: string[];
  approvalAuthority?: boolean;
}

export interface ProjectDispatchItem {
  id: string;
  kind: ProjectItemKind;
  title: string;
  discipline: Discipline;
  summary: string;
  requestedBy?: string;
  dependencies: string[];
  risks: string[];
  acceptanceCriteria: string[];
  expectedOutputs: string[];
  approvalRequired: boolean;
  executiveRelevance: ExecutiveRelevance;
}

export interface ProjectDispatchInput {
  item: ProjectDispatchItem;
  actors?: ActorProfile[];
}

export interface WorkPackage {
  id: string;
  title: string;
  discipline: Discipline;
  requiredRole: string;
  actorKindPreferred: ActorKind[];
  instructions: string;
  inputs: string[];
  expectedOutputs: string[];
  acceptanceCriteria: string[];
  dependencies: string[];
  risks: string[];
  approvalRequired: boolean;
  executiveRelevance: ExecutiveRelevance;
}

export interface ActorAssignment {
  workPackageId: string;
  actorId: string | null;
  actorKind: ActorKind;
  actorName?: string;
  confidence: AssignmentConfidence;
  reason: string;
}

export interface AssignmentGap {
  workPackageId: string;
  reason: string;
}

export interface ApprovalGate {
  workPackageId: string;
  required: boolean;
  approverRole: string;
  reason: string;
}

export interface ProjectDispatchPlan {
  id: string;
  itemId: string;
  status: DispatchPlanStatus;
  revision: number;
  workPackages: WorkPackage[];
  assignments: ActorAssignment[];
  assignmentGaps: AssignmentGap[];
  approvalGates: ApprovalGate[];
  reviewHistory: DispatchPlanReviewEvent[];
  executiveSummary: string;
  nextAction: string;
}

export interface FeatureDispatchPlanOptions {
  actors?: ActorProfile[];
}

export interface DispatchPlanReviewEvent {
  editedBy: string;
  editedAt: string;
  summary: string;
}

export interface WorkPackageEdit {
  id: string;
  title?: string;
  requiredRole?: string;
  actorKindPreferred?: ActorKind[];
  instructions?: string;
  inputs?: string[];
  expectedOutputs?: string[];
  acceptanceCriteria?: string[];
  dependencies?: string[];
  risks?: string[];
  approvalRequired?: boolean;
  executiveRelevance?: ExecutiveRelevance;
}

export interface ActorAssignmentEdit {
  workPackageId: string;
  actorId: string | null;
  actorKind: ActorKind;
  actorName?: string;
  confidence: AssignmentConfidence;
  reason: string;
}

export interface ProjectDispatchPlanEdits {
  editedBy: string;
  editedAt?: string;
  workPackages?: WorkPackageEdit[];
  assignments?: ActorAssignmentEdit[];
}

export interface ProjectDispatchPlanApproval {
  approvedBy: string;
  approvedAt?: string;
  approvalNote?: string;
}

export type ProjectDispatchApprovalResult =
  | {
      status: 'approved';
      plan: ProjectDispatchPlan;
      reason?: undefined;
    }
  | {
      status: 'blocked';
      plan: ProjectDispatchPlan;
      reason: string;
    };

const ROLE_BY_DISCIPLINE: Record<Discipline, string> = {
  software: 'Software implementation agent',
  product: 'Product lead',
  project_management: 'Project manager',
  architecture: 'Architect',
  structural: 'Structural engineer',
  civil: 'Civil engineer',
  mechanical: 'Mechanical engineer',
  electrical: 'Electrical engineer',
  plumbing: 'Plumbing engineer',
  construction: 'Site engineer',
  procurement: 'Procurement manager',
  legal: 'Legal / compliance reviewer',
  finance: 'Finance reviewer',
  qa: 'QA reviewer',
  operations: 'Operations lead',
};

const ACTOR_PREFERENCES_BY_DISCIPLINE: Record<Discipline, ActorKind[]> = {
  software: ['ai_agent', 'human', 'tool', 'review_queue'],
  product: ['human', 'ai_agent', 'review_queue'],
  project_management: ['human', 'ai_agent', 'review_queue'],
  architecture: ['human', 'tool', 'review_queue', 'ai_agent'],
  structural: ['human', 'tool', 'review_queue', 'ai_agent'],
  civil: ['human', 'tool', 'review_queue', 'ai_agent'],
  mechanical: ['human', 'tool', 'review_queue', 'ai_agent'],
  electrical: ['human', 'tool', 'review_queue', 'ai_agent'],
  plumbing: ['human', 'tool', 'review_queue', 'ai_agent'],
  construction: ['human', 'vendor', 'tool', 'review_queue'],
  procurement: ['human', 'vendor', 'review_queue', 'ai_agent'],
  legal: ['human', 'authority', 'review_queue'],
  finance: ['human', 'review_queue', 'ai_agent'],
  qa: ['human', 'tool', 'review_queue', 'ai_agent'],
  operations: ['human', 'tool', 'review_queue', 'ai_agent'],
};

function listText(values: string[]): string {
  return values.length > 0 ? values.map((value) => `  - ${value}`).join('\n') : '  - None recorded';
}

function slug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'work-package';
}

function includesToken(values: string[], token: string): boolean {
  const normalizedToken = token.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalizedToken));
}

function actorScore(actor: ActorProfile, item: ProjectDispatchItem, requiredRole: string): number {
  let score = 0;
  if (actor.discipline === item.discipline) score += 4;
  if (actor.role.toLowerCase() === requiredRole.toLowerCase()) score += 3;
  if (actor.role.toLowerCase().includes(requiredRole.toLowerCase())) score += 2;
  if (includesToken(actor.capabilities, item.discipline)) score += 1;
  if (score > 0 && item.approvalRequired && actor.approvalAuthority) score += 1;
  return score;
}

function confidenceForScore(score: number): AssignmentConfidence {
  if (score >= 4) return 'high';
  if (score >= 3) return 'medium';
  if (score >= 1) return 'low';
  return 'none';
}

function createWorkPackage(item: ProjectDispatchItem): WorkPackage {
  const requiredRole = ROLE_BY_DISCIPLINE[item.discipline];
  return {
    id: `wp-${slug(item.id || item.title)}`,
    title: item.title,
    discipline: item.discipline,
    requiredRole,
    actorKindPreferred: ACTOR_PREFERENCES_BY_DISCIPLINE[item.discipline],
    instructions: item.summary,
    inputs: item.dependencies,
    expectedOutputs: item.expectedOutputs,
    acceptanceCriteria: item.acceptanceCriteria,
    dependencies: item.dependencies,
    risks: item.risks,
    approvalRequired: item.approvalRequired,
    executiveRelevance: item.executiveRelevance,
  };
}

function assignActor(workPackage: WorkPackage, actors: ActorProfile[]): ActorAssignment {
  const ranked = actors
    .map((actor) => ({
      actor,
      score: actorScore(
        actor,
        {
          id: workPackage.id,
          kind: 'executive_report',
          title: workPackage.title,
          discipline: workPackage.discipline,
          summary: workPackage.instructions,
          dependencies: workPackage.dependencies,
          risks: workPackage.risks,
          acceptanceCriteria: workPackage.acceptanceCriteria,
          expectedOutputs: workPackage.expectedOutputs,
          approvalRequired: workPackage.approvalRequired,
          executiveRelevance: workPackage.executiveRelevance,
        },
        workPackage.requiredRole,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        workPackage.actorKindPreferred.indexOf(a.actor.kind) -
        workPackage.actorKindPreferred.indexOf(b.actor.kind)
      );
    });

  const selected = ranked[0];
  if (!selected) {
    return {
      workPackageId: workPackage.id,
      actorId: null,
      actorKind: 'review_queue',
      confidence: 'none',
      reason: `No actor matched discipline "${workPackage.discipline}" and role "${workPackage.requiredRole}".`,
    };
  }

  return {
    workPackageId: workPackage.id,
    actorId: selected.actor.id,
    actorKind: selected.actor.kind,
    actorName: selected.actor.name,
    confidence: confidenceForScore(selected.score),
    reason: `Matched ${selected.actor.name} by discipline "${workPackage.discipline}" and role "${workPackage.requiredRole}".`,
  };
}

function createApprovalGate(workPackage: WorkPackage): ApprovalGate {
  return {
    workPackageId: workPackage.id,
    required: workPackage.approvalRequired,
    approverRole: workPackage.requiredRole,
    reason: workPackage.approvalRequired
      ? `Approval required before dispatching ${workPackage.title}.`
      : `No explicit approval required for ${workPackage.title}.`,
  };
}

function createExecutiveSummary(
  itemTitle: string,
  itemSummary: string,
  itemDependencies: string[],
  itemRisks: string[],
  workPackages: WorkPackage[],
  assignments: ActorAssignment[],
  approvalGates: ApprovalGate[],
): string {
  const workPackageRisks = workPackages.flatMap((workPackage) => workPackage.risks);
  const riskSource = workPackageRisks.length > 0 ? workPackageRisks : itemRisks;
  const riskText = riskSource.length > 0 ? riskSource.join('; ') : 'No material risks recorded';
  const workPackageDependencies = workPackages.flatMap((workPackage) => workPackage.dependencies);
  const dependencySource = workPackageDependencies.length > 0 ? workPackageDependencies : itemDependencies;
  const dependencyText =
    dependencySource.length > 0 ? dependencySource.join('; ') : 'No upstream dependencies recorded';
  const actorText = assignments
    .map((assignment) => assignment.actorName ?? assignment.reason)
    .join('; ');
  const decisionText = approvalGates.some((gate) => gate.required)
    ? 'Decision needed: review and approve the dispatch package before execution.'
    : 'Decision needed: confirm the dispatch package is ready for execution.';

  return [
    `${itemTitle}: ${itemSummary}`,
    `Work packages: ${workPackages.length}.`,
    `Recommended actors: ${actorText || 'No actor recommendation available'}.`,
    `Dependencies: ${dependencyText}.`,
    `Risks: ${riskText}.`,
    decisionText,
  ].join(' ');
}

function disciplineFromFeature(feature: Feature): Discipline {
  const text = `${feature.category} ${feature.name} ${feature.locatedSection ?? ''}`.toLowerCase();
  if (/\b(structural|load|beam|slab)\b/.test(text)) return 'structural';
  if (/\b(construction|site|inspection|field)\b/.test(text)) return 'construction';
  if (/\b(procurement|vendor|lead[- ]time|purchase)\b/.test(text)) return 'procurement';
  if (/\b(permit|legal|compliance|authority)\b/.test(text)) return 'legal';
  if (/\b(pm|project management|orchestration|dispatch|dashboard|executive)\b/.test(text)) return 'project_management';
  if (/\b(qa|quality|test|e2e)\b/.test(text)) return 'qa';
  if (/\b(operations|ops|runtime|monitor)\b/.test(text)) return 'operations';
  return 'software';
}

function kindFromFeature(feature: Feature, discipline: Discipline): ProjectItemKind {
  if (discipline === 'structural') return 'structural_review';
  if (discipline === 'construction') return 'construction_task';
  if (discipline === 'procurement') return 'procurement_item';
  if (discipline === 'legal') return 'permit_item';
  if (discipline === 'project_management') return 'executive_report';
  if (discipline === 'qa') return 'inspection_item';
  return 'software_feature';
}

export function projectDispatchItemFromFeature(feature: Feature): ProjectDispatchItem {
  const discipline = disciplineFromFeature(feature);
  const testPath = feature.paths?.test ?? feature.paths?.unitIntegrationTest;
  const dependencies =
    feature.upstreamDependencies?.map((dependency) =>
      [
        dependency.kind === 'soft' ? 'Soft dependency' : 'Hard dependency',
        dependency.featureId,
        dependency.reason,
      ]
        .filter(Boolean)
        .join(': '),
    ) ?? [];

  return {
    id: feature.id,
    kind: kindFromFeature(feature, discipline),
    title: `${feature.id} ${feature.name}`,
    discipline,
    summary: feature.notes?.trim() || `Prepare dispatch package for ${feature.name}.`,
    dependencies,
    risks:
      feature.status === 'done'
        ? []
        : [`Current feature status is ${feature.status} at ${feature.progress}% progress.`],
    acceptanceCriteria: [
      feature.paths?.spec ? `Review feature spec: ${feature.paths.spec}` : 'Feature scope is confirmed.',
      feature.paths?.tdd ? `Review TDD spec: ${feature.paths.tdd}` : 'Verification approach is confirmed.',
      testPath ? `Relevant test path is ${testPath}.` : 'Relevant verification path is identified.',
    ],
    expectedOutputs: [
      feature.paths?.implementation
        ? `Implementation update in ${feature.paths.implementation}`
        : 'Reviewed work package',
      'Verification evidence',
      'Dispatch result summary',
    ],
    approvalRequired: true,
    executiveRelevance: feature.progress < 50 ? 'medium' : 'high',
  };
}

export function createProjectDispatchPlan(input: ProjectDispatchInput): ProjectDispatchPlan {
  const actors = input.actors ?? [];
  const workPackages = [createWorkPackage(input.item)];
  const assignments = workPackages.map((workPackage) => assignActor(workPackage, actors));
  const assignmentGaps = assignments
    .filter((assignment) => assignment.confidence === 'none')
    .map((assignment) => ({
      workPackageId: assignment.workPackageId,
      reason: assignment.reason,
    }));
  const approvalGates = workPackages.map(createApprovalGate);

  return {
    id: `dispatch-${slug(input.item.id || input.item.title)}`,
    itemId: input.item.id,
    status: 'needs_review',
    revision: 1,
    workPackages,
    assignments,
    assignmentGaps,
    approvalGates,
    reviewHistory: [],
    executiveSummary: createExecutiveSummary(
      input.item.title,
      input.item.summary,
      input.item.dependencies,
      input.item.risks,
      workPackages,
      assignments,
      approvalGates,
    ),
    nextAction: 'Human lead reviews and edits the dispatch plan before execution.',
  };
}

function mergeWorkPackage(workPackage: WorkPackage, edit: WorkPackageEdit | undefined): WorkPackage {
  if (!edit) return workPackage;
  return {
    ...workPackage,
    title: edit.title ?? workPackage.title,
    requiredRole: edit.requiredRole ?? workPackage.requiredRole,
    actorKindPreferred: edit.actorKindPreferred ?? workPackage.actorKindPreferred,
    instructions: edit.instructions ?? workPackage.instructions,
    inputs: edit.inputs ?? workPackage.inputs,
    expectedOutputs: edit.expectedOutputs ?? workPackage.expectedOutputs,
    acceptanceCriteria: edit.acceptanceCriteria ?? workPackage.acceptanceCriteria,
    dependencies: edit.dependencies ?? workPackage.dependencies,
    risks: edit.risks ?? workPackage.risks,
    approvalRequired: edit.approvalRequired ?? workPackage.approvalRequired,
    executiveRelevance: edit.executiveRelevance ?? workPackage.executiveRelevance,
  };
}

function summarizeEdits(workPackageCount: number, assignmentCount: number): string {
  const workPackageText = `${workPackageCount} work package${workPackageCount === 1 ? '' : 's'}`;
  const assignmentText = `${assignmentCount} assignment${assignmentCount === 1 ? '' : 's'}`;
  return `Updated ${workPackageText} and ${assignmentText}.`;
}

export function applyProjectDispatchPlanEdits(
  plan: ProjectDispatchPlan,
  edits: ProjectDispatchPlanEdits,
): ProjectDispatchPlan {
  const workPackageEdits = edits.workPackages ?? [];
  const assignmentEdits = edits.assignments ?? [];
  const nextWorkPackages = plan.workPackages.map((workPackage) =>
    mergeWorkPackage(
      workPackage,
      workPackageEdits.find((edit) => edit.id === workPackage.id),
    ),
  );
  const nextAssignments = plan.assignments.map((assignment) => {
    const edit = assignmentEdits.find((item) => item.workPackageId === assignment.workPackageId);
    return edit ? { ...assignment, ...edit } : assignment;
  });
  const nextApprovalGates = nextWorkPackages.map(createApprovalGate);

  return {
    ...plan,
    status: 'needs_review',
    revision: plan.revision + 1,
    workPackages: nextWorkPackages,
    assignments: nextAssignments,
    assignmentGaps: nextAssignments
      .filter((assignment) => assignment.confidence === 'none')
      .map((assignment) => ({
        workPackageId: assignment.workPackageId,
        reason: assignment.reason,
      })),
    approvalGates: nextApprovalGates,
    reviewHistory: [
      ...plan.reviewHistory,
      {
        editedBy: edits.editedBy,
        editedAt: edits.editedAt ?? new Date().toISOString(),
        summary: summarizeEdits(workPackageEdits.length, assignmentEdits.length),
      },
    ],
    executiveSummary: createExecutiveSummary(
      nextWorkPackages[0]?.title ?? plan.itemId,
      nextWorkPackages[0]?.instructions ?? plan.executiveSummary,
      nextWorkPackages.flatMap((workPackage) => workPackage.dependencies),
      nextWorkPackages.flatMap((workPackage) => workPackage.risks),
      nextWorkPackages,
      nextAssignments,
      nextApprovalGates,
    ),
    nextAction: 'Human lead reviews and edits the dispatch plan before execution.',
  };
}

export function approveProjectDispatchPlan(
  plan: ProjectDispatchPlan,
  approval: ProjectDispatchPlanApproval,
): ProjectDispatchApprovalResult {
  if (plan.assignmentGaps.length > 0) {
    return {
      status: 'blocked',
      reason: `Cannot approve dispatch plan with ${plan.assignmentGaps.length} assignment gap${plan.assignmentGaps.length === 1 ? '' : 's'}.`,
      plan: {
        ...plan,
        status: 'needs_review',
        nextAction: 'Resolve assignment gaps before approval.',
      },
    };
  }

  const requiredGateCount = plan.approvalGates.filter((gate) => gate.required).length;
  if (requiredGateCount > 0) {
    return {
      status: 'blocked',
      reason: `Cannot approve dispatch plan with ${requiredGateCount} unresolved approval gate${requiredGateCount === 1 ? '' : 's'}.`,
      plan: {
        ...plan,
        status: 'needs_review',
        nextAction: 'Resolve approval gates before final dispatch approval.',
      },
    };
  }

  const approvedPlan: ProjectDispatchPlan = {
    ...plan,
    status: 'approved',
    revision: plan.revision + 1,
    reviewHistory: [
      ...plan.reviewHistory,
      {
        editedBy: approval.approvedBy,
        editedAt: approval.approvedAt ?? new Date().toISOString(),
        summary: `Approved for dispatch. ${approval.approvalNote ?? 'No approval note provided.'}`,
      },
    ],
    nextAction: 'Dispatch can be handed to selected execution adapters when the human lead starts it.',
  };

  return {
    status: 'approved',
    plan: approvedPlan,
  };
}

export function createProjectDispatchPlanForFeature(
  feature: Feature,
  options: FeatureDispatchPlanOptions = {},
): ProjectDispatchPlan {
  return createProjectDispatchPlan({
    item: projectDispatchItemFromFeature(feature),
    actors: options.actors,
  });
}

export function renderProjectDispatchDecisionPackage(plan: ProjectDispatchPlan): string {
  const workPackageSections = plan.workPackages.map((workPackage) => {
    const assignment = plan.assignments.find((item) => item.workPackageId === workPackage.id);
    return [
      `### ${workPackage.id}: ${workPackage.title}`,
      `- Discipline: ${workPackage.discipline}`,
      `- Required role: ${workPackage.requiredRole}`,
      `- Recommended actor: ${assignment?.actorName ?? assignment?.reason ?? 'Unassigned'}`,
      `- Assignment confidence: ${assignment?.confidence ?? 'none'}`,
      `- Approval required: ${workPackage.approvalRequired ? 'yes' : 'no'}`,
      '',
      'Inputs / dependencies:',
      listText(workPackage.dependencies),
      '',
      'Expected outputs:',
      listText(workPackage.expectedOutputs),
      '',
      'Acceptance criteria:',
      listText(workPackage.acceptanceCriteria),
      '',
      'Risks:',
      listText(workPackage.risks),
    ].join('\n');
  });

  const approvalGateLines = plan.approvalGates.map((gate) =>
    `- ${gate.workPackageId}: ${gate.required ? 'required' : 'not required'} by ${gate.approverRole}. ${gate.reason}`,
  );
  const assignmentGapLines = plan.assignmentGaps.map((gap) => `- ${gap.workPackageId}: ${gap.reason}`);

  return [
    '# Dispatch Decision Package',
    '',
    `- Plan ID: ${plan.id}`,
    `- Item ID: ${plan.itemId}`,
    `- Status: ${plan.status}`,
    `- Revision: ${plan.revision}`,
    `- Next action: ${plan.nextAction}`,
    '',
    '## Executive Summary',
    '',
    plan.executiveSummary,
    '',
    '## Work Packages',
    '',
    ...workPackageSections,
    '',
    '## Approval Gates',
    '',
    approvalGateLines.length > 0 ? approvalGateLines.join('\n') : '- None recorded',
    '',
    '## Assignment Gaps',
    '',
    assignmentGapLines.length > 0 ? assignmentGapLines.join('\n') : '- None',
  ].join('\n');
}
