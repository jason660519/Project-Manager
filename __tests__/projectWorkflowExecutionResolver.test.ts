import { describe, expect, it } from 'vitest';
import {
  resolveProjectWorkflowDraftExecutor,
  type ProjectWorkflowExecutorCandidate,
} from '../lib/project-workflows/projectWorkflowExecutionResolver';
import type { ProjectWorkflowExecutionDraft } from '../lib/project-workflows';

function draftWithCapability(capabilityId: string): ProjectWorkflowExecutionDraft {
  return {
    id: `draft:${capabilityId}`,
    workflowRunId: 'project-workflow-run-F54',
    nodeId: 'verification',
    nodeTitle: 'Verification',
    actorKind: 'tool',
    status: 'auto_run_allowed',
    riskLevel: 'medium',
    runModeAtCreation: 'auto_safe_nodes',
    systemPromptLabel: 'Software PM workflow tool runner',
    taskPromptLabel: 'Verification task prompt for F54',
    memoryFiles: ['.project-manager/features/F54/'],
    allowedTools: ['approved command runner', 'verification logs', 'evidence capture'],
    expectedHandoffArtifactId: 'verification-results',
    expectedEvidenceIds: ['focused-tests'],
    autoRunEligible: true,
    eligibilityReason: 'Run allows safe auto-run and node is low-risk with an agent/tool actor.',
    integrationPolicy: {
      requiresRegisteredCapability: true,
      capabilityId,
      policyState: 'ready',
    },
    createdAt: '2026-06-16T07:10:00.000Z',
  };
}

describe('project workflow execution resolver', () => {
  it('maps software verification drafts to an Integration Hub dry-run command candidate', () => {
    const candidate = resolveProjectWorkflowDraftExecutor(
      draftWithCapability('software:verification:tool'),
    ) as ProjectWorkflowExecutorCandidate;

    expect(candidate).toMatchObject({
      state: 'resolved',
      executionState: 'dry_run_only',
      integrationSheet: 'commands',
      sourceKind: 'command-mapping',
      sourceId: 'npm:verify-baseline',
      label: 'Run Project Manager verification baseline',
      commandPreview: 'npm run verify:baseline',
      safetyNotice: 'Executor candidate only; Project Manager does not run this command in F54.',
    });
    expect(candidate.command).toEqual({ command: 'npm', args: ['run', 'verify:baseline'] });
  });

  it('keeps unknown capability ids unresolved instead of guessing an executor', () => {
    expect(resolveProjectWorkflowDraftExecutor(draftWithCapability('software:unknown:tool'))).toMatchObject({
      state: 'unresolved',
      executionState: 'dry_run_only',
      capabilityId: 'software:unknown:tool',
      safetyNotice: 'No Integration Hub executor candidate is registered for this capability.',
    });
  });

  it('can resolve cross-discipline capabilities from a supplied Integration Hub executor registry', () => {
    const candidate = resolveProjectWorkflowDraftExecutor(
      draftWithCapability('construction:qa:inspection-tool'),
      {
        'construction:qa:inspection-tool': {
          state: 'resolved',
          executionState: 'dry_run_only',
          integrationSheet: 'commands',
          sourceKind: 'command-mapping',
          sourceId: 'inspection:daily-punch-list',
          label: 'Prepare construction QA punch-list verification',
          commandPreview: 'pm-inspection verify --package daily-punch-list',
          command: { command: 'pm-inspection', args: ['verify', '--package', 'daily-punch-list'] },
          safetyNotice: 'Executor candidate only; Project Manager does not run this command in F54.',
        },
      },
    ) as ProjectWorkflowExecutorCandidate;

    expect(candidate).toMatchObject({
      state: 'resolved',
      capabilityId: 'construction:qa:inspection-tool',
      integrationSheet: 'commands',
      sourceKind: 'command-mapping',
      sourceId: 'inspection:daily-punch-list',
      label: 'Prepare construction QA punch-list verification',
      commandPreview: 'pm-inspection verify --package daily-punch-list',
    });
    expect(candidate.command).toEqual({
      command: 'pm-inspection',
      args: ['verify', '--package', 'daily-punch-list'],
    });
  });
});
