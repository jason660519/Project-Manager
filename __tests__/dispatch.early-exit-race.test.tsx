import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../lib/i18n';
import React from 'react';

// Regression harness for the ADR-014 early-event race in TaskDispatchModal:
// Rust starts the stdout/exit emit tasks BEFORE returning the spawn token, so a
// fast process's exit can arrive while `activeSpawnToken` is still null. The
// modal must stage and replay it — otherwise the role is stranded in "running".

let exitHandler: ((event: { pid: number; spawnToken: number; code: number }) => void) | null = null;
let stdoutHandler: ((event: { pid: number; spawnToken: number; line: string }) => void) | null = null;
const spawnAgentMock = vi.fn();

vi.mock('../lib/bridge', () => ({
  augmentArgsWithMcp: vi.fn().mockImplementation((_command, args) => Promise.resolve(args)),
  augmentArgsWithFileAccessPolicy: vi
    .fn()
    .mockImplementation((_command, args) => Promise.resolve(args)),
  killProcess: vi.fn().mockResolvedValue(undefined),
  mcpInjectionFlag: vi.fn().mockReturnValue(null),
  onAgentExit: vi.fn().mockImplementation(async (handler) => {
    exitHandler = handler;
    return vi.fn();
  }),
  onAgentStdout: vi.fn().mockImplementation(async (handler) => {
    stdoutHandler = handler;
    return vi.fn();
  }),
  readFile: vi.fn().mockResolvedValue('mock spec content'),
  spawnAgent: spawnAgentMock,
  spawnTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/adapters/registry', () => ({
  createRuntimeAdapterFromConfig: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({ success: true, command: 'mock-cmd', args: ['--arg1'] }),
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
  buildAgentWorkflowRunPrompt: vi.fn((_workflow, _run, _feature, prompt) => prompt),
  buildAgentWorkflowPrompt: vi.fn().mockReturnValue(''),
  createAgentWorkflowRun: vi.fn((_workflow) => ({ id: 'run-1', status: 'queued', nodeRuns: [] })),
  getAgentWorkflowDagById: vi.fn().mockReturnValue(null),
  getAgentWorkflowById: vi.fn().mockReturnValue(null),
  listAgentWorkflowDags: vi.fn().mockReturnValue([]),
  saveAgentWorkflowRun: vi.fn().mockResolvedValue('/tmp/project/.project-manager/workflow-runs/run-1.json'),
}));

vi.mock('../lib/keys/llmProviders', () => ({
  listLlmProviders: vi.fn().mockReturnValue([
    { id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-3-5-sonnet', availableModels: [] },
  ]),
}));

vi.mock('../lib/storage/plugins', () => ({
  collectEnabledMcpServers: vi.fn().mockReturnValue({}),
}));

const { TaskDispatchModal } = await import('../components/table/TaskDispatchModal');

const MOCK_FEATURE = {
  id: 'F13',
  name: 'Dispatch UX',
  status: 'in_progress' as const,
  progress: 50,
  category: 'Frontend/Dispatch',
  phase: 'development' as const,
  paths: {
    featureFolder: '.project-manager/features/F13/',
    implementation: 'components/table/TaskDispatchModal.tsx',
    developmentLogSummaryFolder: '.project-manager/features/F13/',
  },
  readmePath: '.project-manager/features/F13/README.md',
  createdAt: '2026-05-19T13:47:00.000Z',
  updatedAt: '2026-05-19T13:47:00.000Z',
  points: 1,
};

const AGENT_ADAPTERS = [
  { id: 'claude-code', name: 'Claude Code', type: 'agent' as const, command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
  { id: 'codex', name: 'Codex', type: 'agent' as const, command: 'codex', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
];

describe('TaskDispatchModal [early-exit race]', () => {
  const baseProps = {
    feature: MOCK_FEATURE,
    adapters: AGENT_ADAPTERS,
    projectRoot: '/tmp/project',
    defaultIDE: 'Cursor' as const,
    onClose: vi.fn(),
    onExecuted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    exitHandler = null;
    stdoutHandler = null;
  });

  it('replays an exit that fires before the spawn token is claimed', async () => {
    const user = userEvent.setup();
    let resolveSpawn: ((v: { pid: number; spawnToken: number }) => void) | null = null;
    spawnAgentMock.mockImplementationOnce(
      () =>
        new Promise<{ pid: number; spawnToken: number }>((resolve) => {
          resolveSpawn = resolve;
        }),
    );

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.selectOptions(screen.getAllByRole('combobox')[2], 'claude-code');
    await user.click(screen.getByRole('button', { name: 'Dispatch W' }));

    // Listeners are registered before the spawn is awaited.
    await waitFor(() => expect(exitHandler).not.toBeNull());

    // Exit lands BEFORE the spawn resolves (token not yet claimed). Without
    // staging it is dropped and the worker is stranded in "running".
    act(() => {
      stdoutHandler?.({ pid: 700, spawnToken: 700, line: 'early output' });
      exitHandler?.({ pid: 700, spawnToken: 700, code: 0 });
    });

    await act(async () => {
      resolveSpawn?.({ pid: 700, spawnToken: 700 });
    });

    // The exit log line only appears if the staged exit was replayed.
    expect(await screen.findByText(/exited \(PID 700, code 0\)/)).toBeInTheDocument();
  });
});
