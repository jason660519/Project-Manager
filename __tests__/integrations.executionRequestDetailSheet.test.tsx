import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IntegrationsDetailSheet } from '../app/ui/views/Plugins/_shared/IntegrationsDetailSheet';
import { I18nProvider } from '../lib/i18n';
import type { IntegrationRow } from '../lib/integrations/types';
import type { PluginCatalog } from '../lib/types/plugins';

const emptyCatalog: PluginCatalog = { schemaVersion: 2, plugins: [] };

function renderDetail(
  row: IntegrationRow,
  props: Partial<React.ComponentProps<typeof IntegrationsDetailSheet>> = {},
) {
  return render(
    <I18nProvider>
      <IntegrationsDetailSheet
        row={row}
        onClose={vi.fn()}
        catalog={emptyCatalog}
        apiKeys={{}}
        providers={[]}
        onCatalogChange={vi.fn()}
        onApiKeyChange={vi.fn()}
        {...props}
      />
    </I18nProvider>,
  );
}

describe('IntegrationsDetailSheet workflow execution request inspector', () => {
  it('lets command mappings save dry-run executor metadata for workflow registry use', async () => {
    const onCommandMappingUpdate = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'channels:cmd:inspection-daily',
      sheet: 'commands',
      sourceKind: 'command-mapping',
      sourceId: 'inspection-daily',
      enabled: true,
      category1: 'Channels',
      category2: 'Command Mapping',
      githubUrl: '',
      company: 'Project Manager',
      name: '/inspect-daily',
      version: '',
      license: '',
      scope: 'project',
      port: '',
      installPath: '',
      installMethod: 'local_file',
      status: 'connected',
      statusLabel: 'Active',
      lastUpdated: '',
      notes: 'Prepare construction QA punch-list verification',
      lv: null,
      badges: ['custom'],
      payload: {
        mapping: {
          id: 'inspection-daily',
          trigger: '/inspect-daily',
          action: 'custom',
          description: 'Prepare construction QA punch-list verification',
          enabled: true,
        },
      },
    }, {
      onCommandMappingUpdate,
      otherCommandTriggers: () => [],
      isDefaultCommandMapping: () => false,
    });

    await user.type(screen.getByLabelText('Executor capability'), 'construction:qa:inspection-tool');
    await user.type(screen.getByLabelText('Executor command'), 'pm-inspection');
    await user.type(screen.getByLabelText('Executor args'), 'verify --package daily-punch-list');
    await user.type(
      screen.getByLabelText('Executor preview'),
      'pm-inspection verify --package daily-punch-list',
    );
    await user.click(screen.getByRole('button', { name: 'Save mapping' }));

    expect(onCommandMappingUpdate).toHaveBeenCalledWith('inspection-daily', {
      trigger: '/inspect-daily',
      description: 'Prepare construction QA punch-list verification',
      action: 'custom',
      enabled: true,
      executor: {
        capabilityId: 'construction:qa:inspection-tool',
        command: {
          command: 'pm-inspection',
          args: ['verify', '--package', 'daily-punch-list'],
        },
        commandPreview: 'pm-inspection verify --package daily-punch-list',
        label: '',
        safetyNotice: '',
      },
    });
  });

  it('lets command mappings opt into an approved live command executor path', async () => {
    const onCommandMappingUpdate = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'channels:cmd:verify-live',
      sheet: 'commands',
      sourceKind: 'command-mapping',
      sourceId: 'verify-live',
      enabled: true,
      category1: 'Channels',
      category2: 'Command Mapping',
      githubUrl: '',
      company: 'Project Manager',
      name: '/verify-live',
      version: '',
      license: '',
      scope: 'project',
      port: '',
      installPath: '',
      installMethod: 'local_file',
      status: 'connected',
      statusLabel: 'Active',
      lastUpdated: '',
      notes: 'Run the approved verification executor',
      lv: null,
      badges: ['custom'],
      payload: {
        mapping: {
          id: 'verify-live',
          trigger: '/verify-live',
          action: 'custom',
          description: 'Run the approved verification executor',
          enabled: true,
        },
      },
    }, {
      onCommandMappingUpdate,
      otherCommandTriggers: () => [],
      isDefaultCommandMapping: () => false,
    });

    await user.type(screen.getByLabelText('Executor capability'), 'software:verification:tool');
    await user.selectOptions(screen.getByLabelText('Executor execution mode'), 'live_command_allowed');
    await user.type(screen.getByLabelText('Executor command'), 'npm');
    await user.type(screen.getByLabelText('Executor args'), 'run verify:baseline');
    await user.type(screen.getByLabelText('Executor preview'), 'npm run verify:baseline');
    await user.click(screen.getByRole('button', { name: 'Save mapping' }));

    expect(onCommandMappingUpdate).toHaveBeenCalledWith('verify-live', expect.objectContaining({
      executor: expect.objectContaining({
        capabilityId: 'software:verification:tool',
        executionState: 'live_command_allowed',
        command: {
          command: 'npm',
          args: ['run', 'verify:baseline'],
        },
        commandPreview: 'npm run verify:baseline',
      }),
    }));
  });

  it('shows the dry-run execution package details without runtime execution controls', () => {
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'dry_run_only',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'PM Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline Dry-run execution request only; Project Manager did not execute the command.',
      lv: null,
      badges: ['dry_run_only', 'commands', 'software:verification:tool'],
      payload: {
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        actorKind: 'tool',
        status: 'pending_external_executor',
        executionState: 'dry_run_only',
        reviewStatus: 'review_required',
        policyGate: {
          state: 'review_required',
          reason: 'Human review is required before any external executor may consume this request.',
        },
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        capabilityId: 'software:verification:tool',
        commandPreview: 'npm run verify:baseline',
        systemPromptLabel: 'Software PM workflow tool runner',
        taskPromptLabel: 'Verification task prompt for F54',
        memoryFiles: ['.project-manager/features/F54/feature-spec.md'],
        allowedTools: ['tool:verification'],
        expectedHandoffArtifactId: 'verification-results',
        expectedEvidenceIds: ['verification-log'],
        safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
      },
    });

    expect(screen.getByText('Execution Request Package')).toBeInTheDocument();
    expect(screen.getByText('review_required')).toBeInTheDocument();
    expect(screen.getByText('Human review is required before any external executor may consume this request.')).toBeInTheDocument();
    expect(screen.getByText('npm run verify:baseline')).toBeInTheDocument();
    expect(screen.getByText('Software PM workflow tool runner')).toBeInTheDocument();
    expect(screen.getByText('Verification task prompt for F54')).toBeInTheDocument();
    expect(screen.getByText('.project-manager/features/F54/feature-spec.md')).toBeInTheDocument();
    expect(screen.getByText('tool:verification')).toBeInTheDocument();
    expect(screen.getByText('verification-results')).toBeInTheDocument();
    expect(screen.getByText('verification-log')).toBeInTheDocument();
    expect(screen.getByText('Dry-run execution request only; Project Manager did not execute the command.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open terminal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
  });

  it('lets a PM navigate from an execution request back to the workflow run without executing it', async () => {
    const onOpenWorkflowRun = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'approved_for_executor',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'Human Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline',
      lv: null,
      badges: ['approved_for_executor', 'dry_run_only', 'commands', 'software:verification:tool'],
      payload: {
        id: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        status: 'pending_external_executor',
        executionState: 'dry_run_only',
        reviewStatus: 'approved_for_executor',
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        capabilityId: 'software:verification:tool',
        commandPreview: 'npm run verify:baseline',
      },
    }, { onOpenWorkflowRun });

    await user.click(screen.getByRole('button', { name: 'Open workflow run' }));

    expect(onOpenWorkflowRun).toHaveBeenCalledWith({
      workItemId: 'F54',
      workflowRunId: 'run-1',
      nodeId: 'verification',
    });
    expect(screen.queryByRole('button', { name: /^Run$/i })).not.toBeInTheDocument();
  });

  it('lets a lead approve a review-required request without running it', async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'review_required',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'PM Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline Dry-run execution request only; Project Manager did not execute the command.',
      lv: null,
      badges: ['review_required', 'dry_run_only', 'commands', 'software:verification:tool'],
      payload: {
        id: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        actorKind: 'tool',
        status: 'pending_external_executor',
        executionState: 'dry_run_only',
        reviewStatus: 'review_required',
        policyGate: {
          state: 'review_required',
          reason: 'Human review is required before any external executor may consume this request.',
        },
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        capabilityId: 'software:verification:tool',
        commandPreview: 'npm run verify:baseline',
        safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
      },
    }, { onApproveWorkflowExecutionRequest: onApprove });

    const approve = screen.getByRole('button', { name: 'Approve for executor' });
    await user.click(approve);

    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({
      rowKey: 'workflow-execution-request:request-1',
      sourceId: 'request-1',
    }));
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
  });

  it('shows the future executor gate as blocked for review-required requests', () => {
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'review_required',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'PM Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline Dry-run execution request only; Project Manager did not execute the command.',
      lv: null,
      badges: ['review_required', 'dry_run_only', 'commands', 'software:verification:tool'],
      payload: {
        id: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        actorKind: 'tool',
        status: 'pending_external_executor',
        executionState: 'dry_run_only',
        reviewStatus: 'review_required',
        policyGate: {
          state: 'review_required',
          reason: 'Human review is required before any external executor may consume this request.',
        },
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        capabilityId: 'software:verification:tool',
        executorResolution: {
          state: 'resolved',
          executionState: 'dry_run_only',
          capabilityId: 'software:verification:tool',
          integrationSheet: 'commands',
          sourceKind: 'command-mapping',
          sourceId: 'npm:verify-baseline',
          commandPreview: 'npm run verify:baseline',
          label: 'Run Project Manager verification baseline',
          command: { command: 'npm', args: ['run', 'verify:baseline'] },
          safetyNotice: 'Executor candidate only; Project Manager does not run this command in F54.',
        },
        command: { command: 'npm', args: ['run', 'verify:baseline'] },
        systemPromptLabel: 'Software PM workflow tool runner',
        taskPromptLabel: 'Verification task prompt for F54',
        memoryFiles: ['.project-manager/features/F54/feature-spec.md'],
        allowedTools: ['tool:verification'],
        expectedHandoffArtifactId: 'verification-results',
        expectedEvidenceIds: ['verification-log'],
        safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
      },
    });

    expect(screen.getByText('Executor gate')).toBeInTheDocument();
    expect(screen.getByText('blocked')).toBeInTheDocument();
    expect(screen.getByText('Execution request must be approved_for_executor before any executor may consume it.')).toBeInTheDocument();
  });

  it('shows the future executor gate as ready for approved resolved dry-run requests', () => {
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'approved_for_executor',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'PM Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline Dry-run execution request only; Project Manager did not execute the command.',
      lv: null,
      badges: ['approved_for_executor', 'dry_run_only', 'commands', 'software:verification:tool'],
      payload: {
        id: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        actorKind: 'tool',
        status: 'pending_external_executor',
        executionState: 'dry_run_only',
        reviewStatus: 'approved_for_executor',
        policyGate: {
          state: 'approved_for_executor',
          reason: 'Human approved this dry-run request for a future executor handoff.',
        },
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        approvedBy: 'Lead PM',
        approvedAt: '2026-06-16T08:07:00.000Z',
        capabilityId: 'software:verification:tool',
        executorResolution: {
          state: 'resolved',
          executionState: 'dry_run_only',
          capabilityId: 'software:verification:tool',
          integrationSheet: 'commands',
          sourceKind: 'command-mapping',
          sourceId: 'npm:verify-baseline',
          commandPreview: 'npm run verify:baseline',
          label: 'Run Project Manager verification baseline',
          command: { command: 'npm', args: ['run', 'verify:baseline'] },
          safetyNotice: 'Executor candidate only; Project Manager does not run this command in F54.',
        },
        command: { command: 'npm', args: ['run', 'verify:baseline'] },
        systemPromptLabel: 'Software PM workflow tool runner',
        taskPromptLabel: 'Verification task prompt for F54',
        memoryFiles: ['.project-manager/features/F54/feature-spec.md'],
        allowedTools: ['tool:verification'],
        expectedHandoffArtifactId: 'verification-results',
        expectedEvidenceIds: ['verification-log'],
        safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
      },
    });

    expect(screen.getByText('Executor gate')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('Approved dry-run request is ready for a future executor handoff.')).toBeInTheDocument();
    expect(screen.getByText('npm run verify:baseline')).toBeInTheDocument();
  });

  it('lets a lead record a dry-run executor handoff attempt without running it', async () => {
    const onRecordHandoff = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'approved_for_executor',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'PM Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline Dry-run execution request only; Project Manager did not execute the command.',
      lv: null,
      badges: ['approved_for_executor', 'dry_run_only', 'commands', 'software:verification:tool'],
      payload: {
        id: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        actorKind: 'tool',
        status: 'pending_external_executor',
        executionState: 'dry_run_only',
        reviewStatus: 'approved_for_executor',
        policyGate: {
          state: 'approved_for_executor',
          reason: 'Human approved this dry-run request for a future executor handoff.',
        },
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        approvedBy: 'Lead PM',
        approvedAt: '2026-06-16T08:07:00.000Z',
        capabilityId: 'software:verification:tool',
        executorResolution: {
          state: 'resolved',
          executionState: 'dry_run_only',
          capabilityId: 'software:verification:tool',
          integrationSheet: 'commands',
          sourceKind: 'command-mapping',
          sourceId: 'npm:verify-baseline',
          commandPreview: 'npm run verify:baseline',
          label: 'Run Project Manager verification baseline',
          command: { command: 'npm', args: ['run', 'verify:baseline'] },
          safetyNotice: 'Executor candidate only; Project Manager does not run this command in F54.',
        },
        command: { command: 'npm', args: ['run', 'verify:baseline'] },
        safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
      },
    }, { onRecordWorkflowExecutionHandoff: onRecordHandoff });

    await user.click(screen.getByRole('button', { name: 'Record executor handoff' }));

    expect(onRecordHandoff).toHaveBeenCalledWith(expect.objectContaining({
      rowKey: 'workflow-execution-request:request-1',
      sourceId: 'request-1',
    }));
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
  });

  it('lets a lead run the approved dry-run executor and records the result without spawning a process', async () => {
    const onRunDryRunExecutor = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'approved_for_executor',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'PM Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline Dry-run execution request only; Project Manager did not execute the command.',
      lv: null,
      badges: ['approved_for_executor', 'dry_run_only', 'commands', 'software:verification:tool'],
      payload: {
        id: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        actorKind: 'tool',
        status: 'pending_external_executor',
        executionState: 'dry_run_only',
        reviewStatus: 'approved_for_executor',
        policyGate: {
          state: 'approved_for_executor',
          reason: 'Human approved this dry-run request for a future executor handoff.',
        },
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        approvedBy: 'Lead PM',
        approvedAt: '2026-06-16T08:07:00.000Z',
        capabilityId: 'software:verification:tool',
        executorResolution: {
          state: 'resolved',
          executionState: 'dry_run_only',
          capabilityId: 'software:verification:tool',
          integrationSheet: 'commands',
          sourceKind: 'command-mapping',
          sourceId: 'npm:verify-baseline',
          commandPreview: 'npm run verify:baseline',
          label: 'Run Project Manager verification baseline',
          command: { command: 'npm', args: ['run', 'verify:baseline'] },
          safetyNotice: 'Executor candidate only; Project Manager does not run this command in F54.',
        },
        command: { command: 'npm', args: ['run', 'verify:baseline'] },
        safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
      },
    }, { onRunWorkflowExecutionDryRun: onRunDryRunExecutor });

    await user.click(screen.getByRole('button', { name: 'Run dry-run executor' }));

    expect(onRunDryRunExecutor).toHaveBeenCalledWith(expect.objectContaining({
      rowKey: 'workflow-execution-request:request-1',
      sourceId: 'request-1',
    }));
    expect(screen.queryByRole('button', { name: /^Run$/i })).not.toBeInTheDocument();
  });

  it('offers an explicit live executor action for approved live-command requests', async () => {
    const onRunLiveExecutor = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'workflow-execution-request:request-1',
      sheet: 'workflow-execution-requests',
      sourceKind: 'workflow-execution-request',
      sourceId: 'request-1',
      enabled: false,
      category1: 'Workflow Execution',
      category2: 'approved_for_executor',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
      installMethod: 'PM Lead',
      status: 'idle',
      statusLabel: 'pending_external_executor',
      lastUpdated: '2026-06-16T08:06:00.000Z',
      notes: 'Command preview: npm run verify:baseline',
      lv: null,
      badges: ['approved_for_executor', 'live_command_allowed', 'commands', 'software:verification:tool'],
      payload: {
        id: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        actorKind: 'tool',
        status: 'pending_external_executor',
        executionState: 'live_command_allowed',
        reviewStatus: 'approved_for_executor',
        policyGate: {
          state: 'approved_for_executor',
          reason: 'Human approved this request for live executor spawn.',
        },
        requestedBy: 'PM Lead',
        requestedAt: '2026-06-16T08:06:00.000Z',
        approvedBy: 'Lead PM',
        approvedAt: '2026-06-16T08:07:00.000Z',
        capabilityId: 'software:verification:tool',
        executorResolution: {
          state: 'resolved',
          executionState: 'live_command_allowed',
          capabilityId: 'software:verification:tool',
          integrationSheet: 'commands',
          sourceKind: 'command-mapping',
          sourceId: 'npm:verify-baseline-live',
          commandPreview: 'npm run verify:baseline',
          label: 'Run Project Manager verification baseline live',
          command: { command: 'npm', args: ['run', 'verify:baseline'] },
          safetyNotice: 'Live command candidate; only run after explicit approval.',
        },
        command: { command: 'npm', args: ['run', 'verify:baseline'] },
        safetyNotice: 'Live command request; Project Manager may spawn this command only after explicit approval.',
      },
    }, { onRunWorkflowExecutionLive: onRunLiveExecutor });

    await user.click(screen.getByRole('button', { name: 'Run live executor' }));

    expect(onRunLiveExecutor).toHaveBeenCalledWith(expect.objectContaining({
      rowKey: 'workflow-execution-request:request-1',
      sourceId: 'request-1',
    }));
  });

  it('shows dry-run executor handoff record details without runtime execution controls', () => {
    renderDetail({
      rowKey: 'workflow-execution-record:record-1',
      sheet: 'workflow-execution-records',
      sourceKind: 'workflow-execution-record',
      sourceId: 'record-1',
      enabled: false,
      category1: 'Workflow Execution Audit',
      category2: 'ready_for_executor',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-records/record.json',
      installMethod: 'Dry Run Executor',
      status: 'idle',
      statusLabel: 'ready_for_executor',
      lastUpdated: '2026-06-16T09:34:00.000Z',
      notes: 'Command preview: npm run verify:baseline Handoff record only; Project Manager did not execute the command.',
      lv: null,
      badges: ['ready_for_executor', 'dry_run_only', 'ready', 'software:verification:tool'],
      payload: {
        requestId: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        status: 'ready_for_executor',
        consumedBy: 'Dry Run Executor',
        consumedAt: '2026-06-16T09:34:00.000Z',
        executionState: 'dry_run_only',
        capabilityId: 'software:verification:tool',
        commandPreview: 'npm run verify:baseline',
        policyDecision: {
          state: 'ready',
          reason: 'Approved dry-run request is ready for a future executor handoff.',
        },
        runnerResult: {
          state: 'completed',
          exitCode: 0,
          stdoutPreview: 'Dry-run executor validated the approved command package. No process was spawned.',
          stderrPreview: '',
        },
        safetyNotice: 'Handoff record only; Project Manager did not execute the command.',
      },
    });

    expect(screen.getByText('Execution Record')).toBeInTheDocument();
    expect(screen.getByText('request-1')).toBeInTheDocument();
    expect(screen.getAllByText('ready_for_executor').length).toBeGreaterThan(0);
    expect(screen.getByText('Dry Run Executor')).toBeInTheDocument();
    expect(screen.getByText('Approved dry-run request is ready for a future executor handoff.')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Dry-run executor validated the approved command package. No process was spawned.')).toBeInTheDocument();
    expect(screen.getByText('Handoff record only; Project Manager did not execute the command.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
  });

  it('shows live executor spawn evidence in execution record details', () => {
    renderDetail({
      rowKey: 'workflow-execution-record:record-live-1',
      sheet: 'workflow-execution-records',
      sourceKind: 'workflow-execution-record',
      sourceId: 'record-live-1',
      enabled: false,
      category1: 'Workflow Execution Audit',
      category2: 'live_spawned',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-records/record-live.json',
      installMethod: 'Integration Hub live runner',
      status: 'idle',
      statusLabel: 'live_spawned',
      lastUpdated: '2026-06-16T09:40:00.000Z',
      notes: 'Live executor spawn record only; process output is tracked by spawnToken events.',
      lv: null,
      badges: ['live_spawned', 'live_command_allowed', 'spawned', 'software:verification:tool'],
      payload: {
        requestId: 'request-live-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        status: 'live_spawned',
        consumedBy: 'Integration Hub live runner',
        consumedAt: '2026-06-16T09:40:00.000Z',
        executionState: 'live_command_allowed',
        capabilityId: 'software:verification:tool',
        workingDir: '/repo/Project-Manager',
        commandPreview: 'npm run verify:baseline',
        policyDecision: {
          state: 'ready',
          reason: 'Approved live command request is ready for a guarded executor spawn.',
        },
        runnerResult: {
          state: 'spawned',
          pid: 1234,
          spawnToken: 5678,
        },
        safetyNotice: 'Live executor spawn record only; process output is tracked by spawnToken events.',
      },
    });

    expect(screen.getAllByText('live_spawned').length).toBeGreaterThan(0);
    expect(screen.getByText('spawned')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('5678')).toBeInTheDocument();
    expect(screen.getByText('/repo/Project-Manager')).toBeInTheDocument();
    expect(screen.getByText('Approved live command request is ready for a guarded executor spawn.')).toBeInTheDocument();
    expect(
      screen.getAllByText('Live executor spawn record only; process output is tracked by spawnToken events.').length,
    ).toBeGreaterThan(0);
  });

  it('lets a PM navigate from an execution record back to the workflow run without executing it', async () => {
    const onOpenWorkflowRun = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'workflow-execution-record:record-1',
      sheet: 'workflow-execution-records',
      sourceKind: 'workflow-execution-record',
      sourceId: 'record-1',
      enabled: false,
      category1: 'Workflow Execution Audit',
      category2: 'dry_run_completed',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-records/record.json',
      installMethod: 'Integration Hub dry-run runner',
      status: 'idle',
      statusLabel: 'dry_run_completed',
      lastUpdated: '2026-06-16T09:34:00.000Z',
      notes: 'Dry-run executor validated the approved command package. No process was spawned.',
      lv: null,
      badges: ['dry_run_completed', 'dry_run_only', 'ready', 'completed', 'software:verification:tool'],
      payload: {
        id: 'record-1',
        requestId: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        status: 'dry_run_completed',
        consumedBy: 'Integration Hub dry-run runner',
        consumedAt: '2026-06-16T09:34:00.000Z',
        executionState: 'dry_run_only',
        capabilityId: 'software:verification:tool',
        commandPreview: 'npm run verify:baseline',
      },
    }, { onOpenWorkflowRun });

    await user.click(screen.getByRole('button', { name: 'Open workflow run' }));

    expect(onOpenWorkflowRun).toHaveBeenCalledWith({
      workItemId: 'F54',
      workflowRunId: 'run-1',
      nodeId: 'verification',
    });
    expect(screen.queryByRole('button', { name: /^Run$/i })).not.toBeInTheDocument();
  });

  it('lets a PM navigate from an execution record back to the source execution request without executing it', async () => {
    const onOpenWorkflowExecutionRequest = vi.fn();
    const user = userEvent.setup();
    renderDetail({
      rowKey: 'workflow-execution-record:record-1',
      sheet: 'workflow-execution-records',
      sourceKind: 'workflow-execution-record',
      sourceId: 'record-1',
      enabled: false,
      category1: 'Workflow Execution Audit',
      category2: 'dry_run_completed',
      githubUrl: '',
      company: 'Project Manager',
      name: 'F54 · Verification',
      version: 'schema v1',
      license: '',
      scope: 'project',
      port: '',
      installPath: '/repo/.project-manager/project-workflow-execution-records/record.json',
      installMethod: 'Integration Hub dry-run runner',
      status: 'idle',
      statusLabel: 'dry_run_completed',
      lastUpdated: '2026-06-16T09:34:00.000Z',
      notes: 'Dry-run executor validated the approved command package. No process was spawned.',
      lv: null,
      badges: ['dry_run_completed', 'dry_run_only', 'ready', 'completed', 'software:verification:tool'],
      payload: {
        id: 'record-1',
        requestId: 'request-1',
        workflowRunId: 'run-1',
        workItemId: 'F54',
        nodeId: 'verification',
        nodeTitle: 'Verification',
        draftId: 'draft-1',
        status: 'dry_run_completed',
        consumedBy: 'Integration Hub dry-run runner',
        consumedAt: '2026-06-16T09:34:00.000Z',
        executionState: 'dry_run_only',
        capabilityId: 'software:verification:tool',
        commandPreview: 'npm run verify:baseline',
      },
    }, { onOpenWorkflowExecutionRequest });

    await user.click(screen.getByRole('button', { name: 'Open execution request' }));

    expect(onOpenWorkflowExecutionRequest).toHaveBeenCalledWith('request-1');
    expect(screen.queryByRole('button', { name: /^Run$/i })).not.toBeInTheDocument();
  });
});
