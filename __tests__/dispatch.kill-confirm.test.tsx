import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../lib/i18n';
import React from 'react';

// ── Mock complex external deps ────────────────────────────────────────────────

const killProcessMock = vi.fn().mockResolvedValue(undefined);
const spawnAgentMock = vi.fn().mockResolvedValue(12345);
let agentExitHandler: ((event: { pid: number; code: number }) => void) | null = null;

vi.mock('../lib/bridge', () => ({
  augmentArgsWithMcp: vi.fn().mockResolvedValue([]),
  killProcess: killProcessMock,
  mcpInjectionFlag: vi.fn().mockReturnValue(null),
  onAgentExit: vi.fn().mockImplementation(async (handler) => {
    agentExitHandler = handler;
    return vi.fn();
  }),
  onAgentStdout: vi.fn().mockResolvedValue(vi.fn()),
  readFile: vi.fn().mockResolvedValue('mock spec content'),
  spawnAgent: spawnAgentMock,
  spawnTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/adapters/registry', () => ({
  createRuntimeAdapterFromConfig: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({
      success: true,
      command: 'mock-cmd',
      args: ['--arg1', '--arg2'],
    }),
  }),
  getAdapterExecutionKind: vi.fn((adapter: any) => {
    if (!adapter) return undefined;
    if (adapter.type === 'agent') return 'agent-cli';
    if (adapter.type === 'ide') return 'ide';
    return 'agent-app';
  }),
}));

vi.mock('../lib/agent-workflows', () => ({
  DEFAULT_AGENT_WORKFLOWS: [],
  buildAgentWorkflowPrompt: vi.fn().mockReturnValue(''),
  getAgentWorkflowById: vi.fn().mockReturnValue(null),
}));

vi.mock('../lib/keys/llmProviders', () => ({
  listLlmProviders: vi.fn().mockReturnValue([
    { id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-3-5-sonnet', availableModels: [] },
  ]),
}));

vi.mock('../lib/storage/plugins', () => ({
  collectEnabledMcpServers: vi.fn().mockReturnValue({}),
}));

// Import after mocks
const { TaskDispatchModal } = await import('../components/table/TaskDispatchModal');

const MOCK_FEATURE = {
  id: 'F13',
  name: 'Dispatch UX Improvements & Bug Fixes',
  status: 'in_progress' as const,
  progress: 50,
  category: 'Frontend/Dispatch',
  phase: 'development' as const,
  paths: {
    featureFolder: '.project-manager/features/F13/',
    spec: '.project-manager/features/F13/feature-spec.md',
    tdd: '.project-manager/features/F13/tdd-spec.md',
    implementation: 'components/table/TaskDispatchModal.tsx',
    developmentLogSummaryFolder: '.project-manager/features/F13/',
  },
  readmePath: '.project-manager/features/F13/README.md',
  createdAt: '2026-05-19T13:47:00.000Z',
  updatedAt: '2026-05-19T13:47:00.000Z',
  points: 1,
};

// Agent-only adapters (no IDE type) so default selection is agent-cli
const AGENT_ADAPTERS = [
  { id: 'claude-code', name: 'Claude Code', type: 'agent' as const, command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
  { id: 'codex', name: 'Codex', type: 'agent' as const, command: 'codex', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
];

describe('TaskDispatchModal [kill confirmation]', () => {
  const baseProps = {
    feature: MOCK_FEATURE,
    adapters: AGENT_ADAPTERS,
    projectRoot: '/Volumes/KLEVV-4T-1/Project-Manager',
    defaultIDE: 'Cursor' as const,
    onClose: vi.fn(),
    onExecuted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    agentExitHandler = null;
    spawnAgentMock.mockResolvedValue(12345);
  });

  it('shows pending preparation before PID, then live output after spawn', async () => {
    const user = userEvent.setup();
    let resolveSpawn: ((pid: number) => void) | null = null;
    spawnAgentMock.mockImplementationOnce(
      () => new Promise<number>((resolve) => {
        resolveSpawn = resolve;
      }),
    );

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('Run in Project Manager'));

    expect(await screen.findAllByText('Preparing dispatch command…')).toHaveLength(2);
    expect(screen.queryByText('Live Output')).not.toBeInTheDocument();
    expect(screen.queryByText('PID 12345')).not.toBeInTheDocument();

    await act(async () => {
      resolveSpawn?.(12345);
    });

    expect(await screen.findByText('Live Output')).toBeInTheDocument();
    expect(screen.getByText('PID 12345')).toBeInTheDocument();
    expect(screen.getByText('Kill')).toBeInTheDocument();
  });

  it('transitions running to done when the agent exits cleanly', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('Run in Project Manager'));
    expect(await screen.findByText('Live Output')).toBeInTheDocument();

    act(() => {
      agentExitHandler?.({ pid: 12345, code: 0 });
    });

    expect(screen.getByText('Execution Log')).toBeInTheDocument();
    expect(screen.getByText(/process exited \(PID 12345, code 0\)/)).toBeInTheDocument();
    expect(screen.queryByText('Kill')).not.toBeInTheDocument();
  });

  it('transitions running to error when the agent exits non-zero', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('Run in Project Manager'));
    expect(await screen.findByText('Live Output')).toBeInTheDocument();

    act(() => {
      agentExitHandler?.({ pid: 12345, code: 1 });
    });

    expect(screen.getByText('Execution Log')).toBeInTheDocument();
    expect(screen.getByText(/process exited \(PID 12345, code 1\)/)).toBeInTheDocument();
    expect(screen.queryByText('Kill')).not.toBeInTheDocument();
  });

  it('shows kill confirmation dialog with PID and feature name', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // Start dispatch to enter running phase
    const dispatchBtn = screen.getByText('Run in Project Manager');
    await user.click(dispatchBtn);

    // Kill button should now be visible
    const killBtn = await screen.findByText('Kill');
    await user.click(killBtn);

    // Kill confirmation dialog visible — use the dialog title text
    expect(screen.getByText('Kill this process?')).toBeInTheDocument();
    // The dialog body shows PID and feature name together
    expect(screen.getByText(/PID 12345 — Dispatch UX Improvements/)).toBeInTheDocument();
  });

  it('Cancel closes dialog, modal stays running', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // Start dispatch
    const dispatchBtn = screen.getByText('Run in Project Manager');
    await user.click(dispatchBtn);

    // Open kill confirmation
    const killBtn = await screen.findByText('Kill');
    await user.click(killBtn);

    // Confirm dialog is shown
    expect(screen.getByText('Kill this process?')).toBeInTheDocument();

    // Click Cancel
    await user.click(screen.getByText('Cancel'));

    // Dialog should close, modal should still be in running phase
    expect(screen.queryByText('Kill this process?')).not.toBeInTheDocument();
    expect(screen.getByText('Live Output')).toBeInTheDocument();
    // Kill button should still be present (modal is still running)
    expect(screen.getByText('Kill')).toBeInTheDocument();
  });

  it('Confirm kill calls killProcess bridge', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // Start dispatch
    const dispatchBtn = screen.getByText('Run in Project Manager');
    await user.click(dispatchBtn);

    // Open kill confirmation
    const killBtn = await screen.findByText('Kill');
    await user.click(killBtn);

    // Confirm kill
    const confirmBtn = screen.getByText('Confirm');
    await user.click(confirmBtn);

    // killProcess should have been called with the PID
    expect(killProcessMock).toHaveBeenCalledWith(12345);
  });

  it('failed dispatch shows error banner inline', async () => {
    const user = userEvent.setup();

    // Make spawnAgent fail
    spawnAgentMock.mockRejectedValueOnce(new Error('Process crashed with signal 9'));

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // Start dispatch — this will fail
    const dispatchBtn = screen.getByText('Run in Project Manager');
    await user.click(dispatchBtn);

    // Error should be shown in the post-run error banner
    await waitFor(() => {
      expect(screen.getByText('Process crashed with signal 9')).toBeInTheDocument();
    });
  });

  it('guard clause when no running process — Kill button not shown', async () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // In idle phase (before clicking dispatch), Kill button should not exist
    expect(screen.queryByText('Kill')).not.toBeInTheDocument();
  });
});
