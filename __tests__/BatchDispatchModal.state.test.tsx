import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';

const spawnAgentMock = vi.fn();
const augmentArgsWithMcpMock = vi.fn().mockImplementation((_command, args) => Promise.resolve(args));
let exitHandler: ((event: { pid: number; code: number }) => void) | null = null;

vi.mock('../lib/bridge', () => ({
  augmentArgsWithMcp: augmentArgsWithMcpMock,
  killProcess: vi.fn().mockResolvedValue(undefined),
  mcpInjectionFlag: vi.fn().mockReturnValue(null),
  onAgentExit: vi.fn().mockImplementation(async (handler) => {
    exitHandler = handler;
    return vi.fn();
  }),
  onAgentStdout: vi.fn().mockResolvedValue(vi.fn()),
  spawnAgent: spawnAgentMock,
}));

vi.mock('../lib/agent-workflows', () => ({
  DEFAULT_AGENT_WORKFLOWS: [],
  buildAgentWorkflowPrompt: vi.fn((_workflow, _feature, prompt) => prompt),
  getAgentWorkflowById: vi.fn().mockReturnValue(null),
}));

vi.mock('../lib/storage/plugins', () => ({
  collectEnabledMcpServers: vi.fn().mockReturnValue({}),
}));

const { BatchDispatchModal } = await import('../components/table/BatchDispatchModal');

const makeFeature = (id: string, name = `Feature ${id}`) => ({
  id,
  name,
  status: 'todo' as const,
  progress: 0,
  category: 'Test',
  phase: 'development' as const,
  paths: {
    featureFolder: `.project-manager/features/${id}/`,
    implementation: `components/${id}.tsx`,
    developmentLogSummaryFolder: `.project-manager/features/${id}/`,
  },
  readmePath: `.project-manager/features/${id}/README.md`,
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
  points: 1,
});

const agentAdapter = {
  id: 'codex',
  name: 'Codex',
  type: 'agent' as const,
  command: 'codex',
  argsTemplate: ['--cwd', '{root}', '{prompt}'],
};

const baseProps = {
  features: [makeFeature('F1'), makeFeature('F2')],
  adapters: [agentAdapter],
  projectRoot: '/tmp/project',
  onClose: vi.fn(),
};

describe('BatchDispatchModal state handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exitHandler = null;
    spawnAgentMock.mockResolvedValue(101);
  });

  it('renders a close-only modal for an empty features list', () => {
    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} features={[]} />
      </I18nProvider>,
    );

    expect(screen.getByText('No features to dispatch')).toBeInTheDocument();
    expect(screen.queryByText('開始批次派遣')).not.toBeInTheDocument();
    expect(screen.getByText('關閉')).toBeInTheDocument();
  });

  it('shows the no-agent-adapters state', () => {
    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} adapters={[]} />
      </I18nProvider>,
    );

    expect(screen.getAllByText('Need at least one agent').length).toBeGreaterThan(0);
    expect(screen.queryByText('開始批次派遣')).not.toBeInTheDocument();
  });

  it('shows per-item spawn errors inline', async () => {
    const user = userEvent.setup();
    spawnAgentMock.mockRejectedValueOnce(new Error('spawn ENOENT'));

    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} features={[makeFeature('F1')]} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));

    await waitFor(() => {
      expect(screen.getByText(/Error: Error: spawn ENOENT/)).toBeInTheDocument();
    });
  });

  it('renders completed and failed summary counts', async () => {
    const user = userEvent.setup();
    spawnAgentMock.mockResolvedValueOnce(201).mockResolvedValueOnce(202);

    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));
    await waitFor(() => expect(exitHandler).not.toBeNull());

    act(() => {
      exitHandler?.({ pid: 201, code: 0 });
      exitHandler?.({ pid: 202, code: 1 });
    });

    expect(await screen.findByText('1 完成')).toBeInTheDocument();
    expect(screen.getByText('1 失敗')).toBeInTheDocument();
  });

  it('keeps successful batch items independent when one spawn fails', async () => {
    const user = userEvent.setup();
    spawnAgentMock
      .mockRejectedValueOnce(new Error('first failed'))
      .mockResolvedValueOnce(302);

    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));

    expect(await screen.findByText(/Error: Error: first failed/)).toBeInTheDocument();
    expect(await screen.findByText('PID 302')).toBeInTheDocument();
  });
});
