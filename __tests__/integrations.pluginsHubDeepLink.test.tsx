import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/bridge', async () => {
  const noopUnlisten = async () => {};
  return {
    getProjectManagerRoot: vi.fn(async () => '/repo/Project-Manager'),
    listProjectFiles: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(async () => {}),
    openPath: vi.fn(async () => {}),
    runDiscoveryPlan: vi.fn(async () => ({ items: [], warnings: [] })),
    listGlobalCliInventory: vi.fn(async () => []),
    resolveInstallPath: vi.fn(async () => null),
    probeCommandVersion: vi.fn(async () => ({ ok: false })),
    skillInstallFromUrl: vi.fn(async () => {}),
    skillList: vi.fn(async () => []),
    skillUninstall: vi.fn(async () => {}),
    telegramGetMe: vi.fn(async () => ({ username: 'pm_test_bot' })),
    telegramStartPoll: vi.fn(async () => {}),
    telegramStatusAll: vi.fn(async () => ({})),
    telegramStopPoll: vi.fn(async () => {}),
    scanMacosApplications: vi.fn(async () => ({ apps: [], warnings: [] })),
    spawnTerminal: vi.fn(async () => {}),
    mcpKill: vi.fn(async () => {}),
    mcpSpawn: vi.fn(async () => {}),
    mcpStatusAll: vi.fn(async () => ({})),
    onMcpStatus: vi.fn(async () => noopUnlisten),
    onTelegramMessage: vi.fn(async () => noopUnlisten),
    onTelegramStatus: vi.fn(async () => noopUnlisten),
    safeUnlisten: vi.fn(async (unlisten?: () => void | Promise<void>) => {
      if (unlisten) await unlisten();
    }),
  };
});

import { listProjectFiles, readFile } from '../lib/bridge';
import { I18nProvider } from '../lib/i18n';
import { PluginsHubView } from '../app/ui/views/Plugins/PluginsHubView';

const workflowRequestPackage = {
  schemaVersion: 1,
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
  createdAt: '2026-06-16T08:06:00.000Z',
  capabilityId: 'software:verification:tool',
  executorResolution: {
    state: 'resolved',
    executionState: 'dry_run_only',
    capabilityId: 'software:verification:tool',
    integrationSheet: 'commands',
    sourceKind: 'command-mapping',
    sourceId: 'npm:verify-baseline',
    commandPreview: 'npm run verify:baseline',
    command: { command: 'npm', args: ['run', 'verify:baseline'] },
  },
  command: { command: 'npm', args: ['run', 'verify:baseline'] },
  systemPromptLabel: 'System prompt',
  taskPromptLabel: 'Task prompt',
  memoryFiles: ['.project-manager/features/F54/feature-spec.md'],
  allowedTools: ['tool:verification'],
  expectedHandoffArtifactId: 'verification-results',
  expectedEvidenceIds: ['verification-log'],
  safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
};

const workflowRecordPackage = {
  schemaVersion: 1,
  id: 'record-1',
  requestId: 'request-1',
  workflowRunId: 'run-1',
  workItemId: 'F54',
  nodeId: 'verification',
  nodeTitle: 'Verification',
  draftId: 'draft-1',
  status: 'dry_run_completed',
  consumedBy: 'Integration Hub dry-run runner',
  consumedAt: '2026-06-16T08:07:00.000Z',
  executionState: 'dry_run_only',
  capabilityId: 'software:verification:tool',
  commandPreview: 'npm run verify:baseline',
  command: { command: 'npm', args: ['run', 'verify:baseline'] },
  policyDecision: {
    state: 'ready',
    requestId: 'request-1',
    executionState: 'dry_run_only',
    command: { command: 'npm', args: ['run', 'verify:baseline'] },
    reason: 'Approved dry-run request is ready for a future executor handoff.',
  },
  runnerResult: {
    state: 'completed',
    exitCode: 0,
    stdoutPreview: 'Dry-run executor validated the approved command package. No process was spawned.',
    stderrPreview: '',
  },
  safetyNotice: 'Dry-run executor result only; Project Manager did not spawn a process or execute the command.',
};

function renderWorkflowHub(initialSheet: 'workflow-execution-requests' | 'workflow-execution-records') {
  return render(
    <I18nProvider>
      <PluginsHubView
        projectRoot="/repo/Project-Manager"
        pmRepoRoot="/repo/Project-Manager"
        initialSheet={initialSheet}
      />
    </I18nProvider>,
  );
}

describe('PluginsHubView workflow execution deep links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the linked execution request detail after async sidecar rows load', async () => {
    window.history.pushState({}, '', '/integrations-hub/workflow-execution-requests?requestId=request-1');
    vi.mocked(listProjectFiles).mockResolvedValueOnce([
      {
        name: 'request.json',
        path: '/repo/Project-Manager/.project-manager/project-workflow-execution-requests/request.json',
        isDir: false,
        children: [],
      },
    ]);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(workflowRequestPackage));

    renderWorkflowHub('workflow-execution-requests');

    expect(await screen.findByText('Execution Request Package')).toBeInTheDocument();
    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('F54')).toBeInTheDocument();
    expect(screen.getByText('verification')).toBeInTheDocument();
    expect(screen.getByText('Human review is required before any external executor may consume this request.')).toBeInTheDocument();
    expect(screen.getByText('npm run verify:baseline')).toBeInTheDocument();
    await waitFor(() => {
      expect(listProjectFiles).toHaveBeenCalledWith(
        '/repo/Project-Manager/.project-manager/project-workflow-execution-requests',
        1,
      );
    });
  });

  it('updates deep-link selection when client-side navigation changes the execution sheet query', async () => {
    window.history.pushState({}, '', '/integrations-hub/workflow-execution-records?recordId=record-1');
    vi.mocked(listProjectFiles)
      .mockResolvedValueOnce([
        {
          name: 'record.json',
          path: '/repo/Project-Manager/.project-manager/project-workflow-execution-records/record.json',
          isDir: false,
          children: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          name: 'request.json',
          path: '/repo/Project-Manager/.project-manager/project-workflow-execution-requests/request.json',
          isDir: false,
          children: [],
        },
      ]);
    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(workflowRecordPackage))
      .mockResolvedValueOnce(JSON.stringify(workflowRequestPackage));

    const { rerender } = renderWorkflowHub('workflow-execution-records');

    expect(await screen.findByText('Execution Record')).toBeInTheDocument();
    expect(screen.getByText('Dry-run executor validated the approved command package. No process was spawned.')).toBeInTheDocument();

    window.history.pushState({}, '', '/integrations-hub/workflow-execution-requests?requestId=request-1');
    rerender(
      <I18nProvider>
        <PluginsHubView
          projectRoot="/repo/Project-Manager"
          pmRepoRoot="/repo/Project-Manager"
          initialSheet="workflow-execution-requests"
        />
      </I18nProvider>,
    );

    expect(await screen.findByText('Execution Request Package')).toBeInTheDocument();
    expect(screen.getByText('Human review is required before any external executor may consume this request.')).toBeInTheDocument();
  });
});
