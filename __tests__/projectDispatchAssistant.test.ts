import { describe, expect, it } from 'vitest';

import {
  applyProjectDispatchPlanEdits,
  approveProjectDispatchPlan,
  createProjectDispatchPlan,
  renderProjectDispatchDecisionPackage,
} from '../lib/dispatch/projectDispatchAssistant';
import type { ActorProfile, ProjectDispatchInput } from '../lib/dispatch/projectDispatchAssistant';

const actors: ActorProfile[] = [
  {
    id: 'structural-lead',
    kind: 'human',
    name: 'Structural Lead',
    discipline: 'structural',
    role: 'Structural engineer',
    languages: ['en', 'zh-Hant'],
    capabilities: ['load review', 'calculation review', 'drawing review'],
    approvalAuthority: true,
  },
  {
    id: 'codex-worker',
    kind: 'ai_agent',
    name: 'Codex',
    discipline: 'software',
    role: 'Software implementation agent',
    languages: ['en'],
    capabilities: ['typescript', 'tests', 'refactoring'],
  },
];

describe('createProjectDispatchPlan', () => {
  it('turns structural project work into a review-first role-ready dispatch plan', () => {
    const input: ProjectDispatchInput = {
      item: {
        id: 'S-203-review',
        kind: 'structural_review',
        title: 'Review Level 3 transfer slab beam load assumptions',
        discipline: 'structural',
        summary: 'Validate beam load assumptions against the latest architectural revision.',
        requestedBy: 'Project Manager',
        dependencies: ['Architectural revision A-117', 'Load schedule LS-03'],
        risks: ['Incorrect load path could affect downstream MEP coordination'],
        acceptanceCriteria: [
          'Load paths are verified',
          'Discrepancies are listed with drawing references',
          'Decision points are identified for PM approval',
        ],
        expectedOutputs: ['Signed review note', 'Risk and clarification list'],
        approvalRequired: true,
        executiveRelevance: 'high',
      },
      actors,
    };

    const plan = createProjectDispatchPlan(input);

    expect(plan.status).toBe('needs_review');
    expect(plan.workPackages).toHaveLength(1);
    expect(plan.workPackages[0]).toMatchObject({
      discipline: 'structural',
      requiredRole: 'Structural engineer',
      approvalRequired: true,
      dependencies: ['Architectural revision A-117', 'Load schedule LS-03'],
      expectedOutputs: ['Signed review note', 'Risk and clarification list'],
    });
    expect(plan.assignments[0]).toMatchObject({
      workPackageId: plan.workPackages[0].id,
      actorId: 'structural-lead',
      actorKind: 'human',
      confidence: 'high',
    });
    expect(plan.approvalGates[0]).toMatchObject({
      required: true,
      approverRole: 'Structural engineer',
    });
    expect(plan.executiveSummary).toContain('Review Level 3 transfer slab beam load assumptions');
    expect(plan.executiveSummary).toContain('Decision needed');
    expect(plan.executiveSummary).not.toMatch(/\bPR\b|repo|coding agent/i);
  });

  it('uses the same API for software work without making software the domain boundary', () => {
    const input: ProjectDispatchInput = {
      item: {
        id: 'F51-core',
        kind: 'software_feature',
        title: 'Implement Project Dispatch Assistant planner core',
        discipline: 'software',
        summary: 'Add a typed planner module and tests for cross-discipline dispatch packages.',
        dependencies: ['F49 dependency graph dispatch guards'],
        risks: ['Accidentally narrowing the product model to coding agents only'],
        acceptanceCriteria: ['Focused tests pass', 'Plan remains review-first'],
        expectedOutputs: ['Typed planner module', 'Integration test'],
        approvalRequired: true,
        executiveRelevance: 'medium',
      },
      actors,
    };

    const plan = createProjectDispatchPlan(input);

    expect(plan.workPackages[0]).toMatchObject({
      discipline: 'software',
      requiredRole: 'Software implementation agent',
      expectedOutputs: ['Typed planner module', 'Integration test'],
    });
    expect(plan.assignments[0]).toMatchObject({
      actorId: 'codex-worker',
      actorKind: 'ai_agent',
      confidence: 'high',
    });
    expect(plan.status).toBe('needs_review');
    expect(plan.nextAction).toBe('Human lead reviews and edits the dispatch plan before execution.');
  });

  it('records an assignment gap instead of silently choosing a wrong actor', () => {
    const input: ProjectDispatchInput = {
      item: {
        id: 'permit-001',
        kind: 'permit_item',
        title: 'Confirm permit resubmission requirements',
        discipline: 'legal',
        summary: 'Check whether the revised drawing package requires a permit resubmission.',
        dependencies: [],
        risks: ['Authority review delay'],
        acceptanceCriteria: ['Required submission path is documented'],
        expectedOutputs: ['Permit decision note'],
        approvalRequired: true,
        executiveRelevance: 'high',
      },
      actors,
    };

    const plan = createProjectDispatchPlan(input);

    expect(plan.assignments[0]).toMatchObject({
      actorId: null,
      actorKind: 'review_queue',
      confidence: 'none',
    });
    expect(plan.assignmentGaps).toEqual([
      {
        workPackageId: plan.workPackages[0].id,
        reason: 'No actor matched discipline "legal" and role "Legal / compliance reviewer".',
      },
    ]);
    expect(plan.status).toBe('needs_review');
  });

  it('renders a human-reviewable dispatch decision package', () => {
    const plan = createProjectDispatchPlan({
      item: {
        id: 'PM-weekly',
        kind: 'executive_report',
        title: 'Prepare weekly stakeholder dispatch',
        discipline: 'project_management',
        summary: 'Summarize blockers, decisions needed, and next actions for leadership.',
        dependencies: ['Open RFIs', 'Procurement lead-time update'],
        risks: ['Delayed client decision'],
        acceptanceCriteria: ['Status is concise', 'Decision needed is explicit'],
        expectedOutputs: ['One-page executive dispatch'],
        approvalRequired: true,
        executiveRelevance: 'high',
      },
      actors: [
        {
          id: 'pm-lead',
          kind: 'human',
          name: 'PM Lead',
          discipline: 'project_management',
          role: 'Project manager',
          capabilities: ['stakeholder reporting'],
          approvalAuthority: true,
        },
      ],
    });

    const rendered = renderProjectDispatchDecisionPackage(plan);

    expect(rendered).toContain('# Dispatch Decision Package');
    expect(rendered).toContain('Status: needs_review');
    expect(rendered).toContain('## Work Packages');
    expect(rendered).toContain('Prepare weekly stakeholder dispatch');
    expect(rendered).toContain('PM Lead');
    expect(rendered).toContain('## Approval Gates');
    expect(rendered).toContain('Decision needed');
    expect(rendered).toContain('Human lead reviews and edits the dispatch plan before execution.');
    expect(rendered).not.toContain('Auto-execute');
  });

  it('applies human review edits without approving or auto-executing the plan', () => {
    const plan = createProjectDispatchPlan({
      item: {
        id: 'site-inspection',
        kind: 'inspection_item',
        title: 'Inspect waterproofing completion at Level 2',
        discipline: 'construction',
        summary: 'Confirm waterproofing completion before the next trade starts.',
        dependencies: ['Waterproofing subcontractor completion notice'],
        risks: ['Covering incomplete waterproofing creates rework risk'],
        acceptanceCriteria: ['Inspection photos attached', 'Defects listed before handover'],
        expectedOutputs: ['Inspection note'],
        approvalRequired: true,
        executiveRelevance: 'medium',
      },
      actors: [
        {
          id: 'site-engineer',
          kind: 'human',
          name: 'Site Engineer',
          discipline: 'construction',
          role: 'Site engineer',
          capabilities: ['inspection', 'handover'],
          approvalAuthority: true,
        },
      ],
    });

    const edited = applyProjectDispatchPlanEdits(plan, {
      editedBy: 'PM Lead',
      workPackages: [
        {
          id: plan.workPackages[0].id,
          expectedOutputs: ['Inspection note', 'Photo log', 'Defect punch list'],
          risks: ['Covering incomplete waterproofing creates rework risk', 'Rain forecast may delay inspection'],
          approvalRequired: false,
        },
      ],
      assignments: [
        {
          workPackageId: plan.workPackages[0].id,
          actorId: 'site-engineer',
          actorName: 'Site Engineer',
          actorKind: 'human',
          confidence: 'medium',
          reason: 'PM confirmed site engineer availability for tomorrow morning.',
        },
      ],
    });

    expect(edited.id).toBe(plan.id);
    expect(edited.status).toBe('needs_review');
    expect(edited.revision).toBe(2);
    expect(edited.reviewHistory).toEqual([
      expect.objectContaining({
        editedBy: 'PM Lead',
        summary: 'Updated 1 work package and 1 assignment.',
      }),
    ]);
    expect(edited.workPackages[0]).toMatchObject({
      expectedOutputs: ['Inspection note', 'Photo log', 'Defect punch list'],
      risks: ['Covering incomplete waterproofing creates rework risk', 'Rain forecast may delay inspection'],
      approvalRequired: false,
    });
    expect(edited.approvalGates[0]).toMatchObject({
      required: false,
      approverRole: 'Site engineer',
    });
    expect(edited.assignments[0]).toMatchObject({
      actorId: 'site-engineer',
      confidence: 'medium',
      reason: 'PM confirmed site engineer availability for tomorrow morning.',
    });
    expect(edited.nextAction).toBe('Human lead reviews and edits the dispatch plan before execution.');

    const rendered = renderProjectDispatchDecisionPackage(edited);
    expect(rendered).toContain('Revision: 2');
    expect(rendered).toContain('Photo log');
    expect(rendered).toContain('Rain forecast may delay inspection');
    expect(rendered).toContain('Approval required: no');
    expect(rendered).not.toContain('Auto-execute');
  });

  it('blocks approval while assignment gaps remain', () => {
    const plan = createProjectDispatchPlan({
      item: {
        id: 'permit-approval',
        kind: 'permit_item',
        title: 'Approve permit resubmission path',
        discipline: 'legal',
        summary: 'Confirm whether the revised package needs resubmission.',
        dependencies: [],
        risks: ['Authority delay'],
        acceptanceCriteria: ['Decision path documented'],
        expectedOutputs: ['Permit decision package'],
        approvalRequired: true,
        executiveRelevance: 'high',
      },
      actors: [],
    });

    const approval = approveProjectDispatchPlan(plan, {
      approvedBy: 'PM Lead',
      approvalNote: 'Ready to dispatch.',
    });

    expect(approval.status).toBe('blocked');
    expect(approval.reason).toContain('assignment gap');
    expect(approval.plan.status).toBe('needs_review');
    expect(approval.plan.revision).toBe(1);
    expect(approval.plan.nextAction).toBe('Resolve assignment gaps before approval.');
  });

  it('approves a reviewed plan without auto-executing it', () => {
    const plan = createProjectDispatchPlan({
      item: {
        id: 'weekly-dispatch',
        kind: 'executive_report',
        title: 'Prepare weekly executive dispatch',
        discipline: 'project_management',
        summary: 'Prepare the weekly dispatch package for leadership.',
        dependencies: ['Open blockers list'],
        risks: [],
        acceptanceCriteria: ['Decision needed is explicit'],
        expectedOutputs: ['Executive dispatch summary'],
        approvalRequired: true,
        executiveRelevance: 'high',
      },
      actors: [
        {
          id: 'pm-lead',
          kind: 'human',
          name: 'PM Lead',
          discipline: 'project_management',
          role: 'Project manager',
          capabilities: ['reporting'],
          approvalAuthority: true,
        },
      ],
    });
    const reviewed = applyProjectDispatchPlanEdits(plan, {
      editedBy: 'PM Lead',
      editedAt: '2026-06-15T05:00:00.000Z',
      workPackages: [{ id: plan.workPackages[0].id, approvalRequired: false }],
    });

    const approval = approveProjectDispatchPlan(reviewed, {
      approvedBy: 'PM Lead',
      approvedAt: '2026-06-15T05:01:00.000Z',
      approvalNote: 'Approved for dispatch.',
    });

    expect(approval.status).toBe('approved');
    expect(approval.reason).toBeUndefined();
    expect(approval.plan.status).toBe('approved');
    expect(approval.plan.revision).toBe(3);
    expect(approval.plan.reviewHistory.at(-1)).toMatchObject({
      editedBy: 'PM Lead',
      editedAt: '2026-06-15T05:01:00.000Z',
      summary: 'Approved for dispatch. Approved for dispatch.',
    });
    expect(approval.plan.nextAction).toBe('Dispatch can be handed to selected execution adapters when the human lead starts it.');
    expect(renderProjectDispatchDecisionPackage(approval.plan)).toContain('Status: approved');
    expect(renderProjectDispatchDecisionPackage(approval.plan)).not.toContain('Auto-execute');
  });
});
