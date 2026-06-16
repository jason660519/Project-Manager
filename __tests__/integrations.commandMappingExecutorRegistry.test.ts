import { describe, expect, it } from 'vitest';

import { buildExecutorRegistryFromCommandMappings } from '../lib/integrations/mappers/channels';
import { resolveProjectWorkflowDraftExecutor } from '../lib/project-workflows/projectWorkflowExecutionResolver';
import type { CommandMapping } from '../lib/types/channels';
import type { ProjectWorkflowExecutionDraft } from '../lib/project-workflows';

function draftWithCapability(capabilityId: string): ProjectWorkflowExecutionDraft {
  return {
    id: `draft:${capabilityId}`,
    workflowRunId: 'project-workflow-run-F54',
    nodeId: 'quality-gate',
    nodeTitle: 'Quality Gate',
    actorKind: 'tool',
    status: 'auto_run_allowed',
    riskLevel: 'medium',
    runModeAtCreation: 'auto_safe_nodes',
    systemPromptLabel: 'Cross-discipline tool runner',
    taskPromptLabel: 'Inspect supplied command candidate',
    memoryFiles: ['.project-manager/features/F54/'],
    allowedTools: ['approved command runner'],
    expectedHandoffArtifactId: 'quality-gate-report',
    expectedEvidenceIds: ['command-preview'],
    autoRunEligible: true,
    eligibilityReason: 'Run allows safe auto-run and node is low-risk with an agent/tool actor.',
    integrationPolicy: {
      requiresRegisteredCapability: true,
      capabilityId,
      policyState: 'ready',
    },
    createdAt: '2026-06-16T08:50:00.000Z',
  };
}

describe('command mapping executor registry', () => {
  it('builds Project Workflow executor registry entries from enabled command mappings with executor metadata', () => {
    const mappings: CommandMapping[] = [
      {
        id: 'inspection-daily-punch-list',
        trigger: '/inspect-daily',
        action: 'custom',
        description: 'Prepare construction QA punch-list verification',
        enabled: true,
        executor: {
          capabilityId: 'construction:qa:inspection-tool',
          command: { command: 'pm-inspection', args: ['verify', '--package', 'daily-punch-list'] },
          commandPreview: 'pm-inspection verify --package daily-punch-list',
          label: 'Daily punch-list inspection',
          safetyNotice: 'Dry-run executor candidate only; Project Manager has not executed this command.',
        },
      },
    ];

    const registry = buildExecutorRegistryFromCommandMappings(mappings);

    expect(registry).toEqual({
      'construction:qa:inspection-tool': {
        state: 'resolved',
        executionState: 'dry_run_only',
        integrationSheet: 'commands',
        sourceKind: 'command-mapping',
        sourceId: 'inspection-daily-punch-list',
        label: 'Daily punch-list inspection',
        commandPreview: 'pm-inspection verify --package daily-punch-list',
        command: { command: 'pm-inspection', args: ['verify', '--package', 'daily-punch-list'] },
        safetyNotice: 'Dry-run executor candidate only; Project Manager has not executed this command.',
      },
    });
  });

  it('ignores disabled mappings and mappings without complete executor metadata', () => {
    const mappings: CommandMapping[] = [
      {
        id: 'disabled-executor',
        trigger: '/disabled-executor',
        action: 'custom',
        description: 'Disabled executor',
        enabled: false,
        executor: {
          capabilityId: 'software:verification:tool',
          command: { command: 'npm', args: ['run', 'verify:baseline'] },
        },
      },
      {
        id: 'missing-command',
        trigger: '/missing-command',
        action: 'custom',
        description: 'Missing command',
        enabled: true,
        executor: {
          capabilityId: 'construction:qa:inspection-tool',
          command: { command: '', args: [] },
        },
      },
      {
        id: 'plain-status',
        trigger: '/status',
        action: 'get_status',
        description: 'Status only',
        enabled: true,
      },
    ];

    expect(buildExecutorRegistryFromCommandMappings(mappings)).toEqual({});
  });

  it('feeds command mapping registry entries into the Project Workflow resolver', () => {
    const registry = buildExecutorRegistryFromCommandMappings([
      {
        id: 'inspection-daily-punch-list',
        trigger: '/inspect-daily',
        action: 'custom',
        description: 'Prepare construction QA punch-list verification',
        enabled: true,
        executor: {
          capabilityId: 'construction:qa:inspection-tool',
          command: { command: 'pm-inspection', args: ['verify', '--package', 'daily-punch-list'] },
        },
      },
    ]);

    expect(
      resolveProjectWorkflowDraftExecutor(
        draftWithCapability('construction:qa:inspection-tool'),
        registry,
      ),
    ).toMatchObject({
      state: 'resolved',
      capabilityId: 'construction:qa:inspection-tool',
      sourceId: 'inspection-daily-punch-list',
      commandPreview: 'pm-inspection verify --package daily-punch-list',
    });
  });

  it('preserves explicit live command executor opt-in from command mapping metadata', () => {
    const registry = buildExecutorRegistryFromCommandMappings([
      {
        id: 'verify-baseline-live',
        trigger: '/verify-live',
        action: 'custom',
        description: 'Run verification baseline after human approval',
        enabled: true,
        executor: {
          capabilityId: 'software:verification:tool',
          executionState: 'live_command_allowed',
          command: { command: 'npm', args: ['run', 'verify:baseline'] },
          commandPreview: 'npm run verify:baseline',
          safetyNotice: 'Live command candidate; only run after explicit approval.',
        },
      },
    ]);

    expect(registry['software:verification:tool']).toMatchObject({
      executionState: 'live_command_allowed',
      command: { command: 'npm', args: ['run', 'verify:baseline'] },
      safetyNotice: 'Live command candidate; only run after explicit approval.',
    });
  });
});
