import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';

const spawnAgentMock = vi.fn();
const augmentArgsWithMcpMock = vi.fn().mockImplementation((_command, args) => Promise.resolve(args));
let exitHandler: ((event: { pid: number; spawnToken: number; code: number }) => void) | null = null;
let stdoutHandler: ((event: { pid: number; spawnToken: number; line: string }) => void) | null = null;

vi.mock('../lib/bridge', () => ({
  augmentArgsWithMcp: augmentArgsWithMcpMock,
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
  spawnAgent: spawnAgentMock,
}));

vi.mock('../lib/agent-workflows', () => ({
  DEFAULT_AGENT_WORKFLOWS: [],
  buildAgentWorkflowRunPrompt: vi.fn((_workflow, _run, _feature, prompt) => prompt),
  buildAgentWorkflowPrompt: vi.fn((_workflow, _feature, prompt) => prompt),
  createAgentWorkflowRun: vi.fn((_workflow) => ({ id: 'run-1', status: 'queued', nodeRuns: [] })),
  getAgentWorkflowDagById: vi.fn().mockReturnValue(null),
  getAgentWorkflowById: vi.fn().mockReturnValue(null),
  listAgentWorkflowDags: vi.fn().mockReturnValue([]),
  saveAgentWorkflowRun: vi.fn().mockResolvedValue('/tmp/project/.project-manager/workflow-runs/run-1.json'),
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
    stdoutHandler = null;
    spawnAgentMock.mockResolvedValue({ pid: 101, spawnToken: 101 });
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
    spawnAgentMock
      .mockResolvedValueOnce({ pid: 201, spawnToken: 201 })
      .mockResolvedValueOnce({ pid: 202, spawnToken: 202 });

    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));
    await waitFor(() => expect(exitHandler).not.toBeNull());

    act(() => {
      exitHandler?.({ pid: 201, spawnToken: 201, code: 0 });
      exitHandler?.({ pid: 202, spawnToken: 202, code: 1 });
    });

    expect(await screen.findByText('1 完成')).toBeInTheDocument();
    expect(screen.getByText('1 失敗')).toBeInTheDocument();
  });

  it('keeps successful batch items independent when one spawn fails', async () => {
    const user = userEvent.setup();
    spawnAgentMock
      .mockRejectedValueOnce(new Error('first failed'))
      .mockResolvedValueOnce({ pid: 302, spawnToken: 302 });

    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));

    expect(await screen.findByText(/Error: Error: first failed/)).toBeInTheDocument();
    expect(await screen.findByText('PID 302')).toBeInTheDocument();
  });

  // Regression: the PID-reuse race class (PR #15, ADR-014). An exit stamped with
  // the SAME OS PID but a DIFFERENT spawn token — what happens when the OS
  // recycles a PID onto an unrelated process — must never be cross-correlated
  // onto a live run. Only the matching token completes it.
  it('ignores a reused PID with a different spawn token', async () => {
    const user = userEvent.setup();
    spawnAgentMock.mockResolvedValueOnce({ pid: 500, spawnToken: 42 });

    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} features={[makeFeature('F1')]} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));
    await waitFor(() => expect(exitHandler).not.toBeNull());
    expect(await screen.findByText('PID 500')).toBeInTheDocument();

    // Same PID, stale token from a since-dead process — must be ignored.
    act(() => {
      exitHandler?.({ pid: 500, spawnToken: 41, code: 0 });
    });
    expect(screen.queryByText('1 完成')).not.toBeInTheDocument();
    expect(screen.getByText('PID 500')).toBeInTheDocument(); // still running

    // Matching token completes the run.
    act(() => {
      exitHandler?.({ pid: 500, spawnToken: 42, code: 0 });
    });
    expect(await screen.findByText('1 完成')).toBeInTheDocument();
  });

  // Regression (PR #16): Rust starts the emit tasks before returning the spawn
  // token (ADR-014), so a fast feature's events can arrive BEFORE spawnAgent
  // resolves — while tokenToFeatureId has no mapping. They must be staged and
  // replayed on claim, or the item is stranded in "running" forever.
  it('replays events that arrive before the spawn token is mapped', async () => {
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
        <BatchDispatchModal {...baseProps} features={[makeFeature('F1')]} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));
    // Listeners are registered before the spawn is awaited.
    await waitFor(() => expect(exitHandler).not.toBeNull());

    // Stdout + exit land BEFORE the spawn resolves (token not yet mapped). The
    // stdout exercises the staging path; the exit is the correctness case —
    // without staging it is dropped and the item is stuck "running" forever.
    act(() => {
      stdoutHandler?.({ pid: 700, spawnToken: 700, line: 'early output' });
      exitHandler?.({ pid: 700, spawnToken: 700, code: 0 });
    });

    // The spawn resolves and claims the token → staged events replay.
    await act(async () => {
      resolveSpawn?.({ pid: 700, spawnToken: 700 });
    });

    // Completed (not stranded in "running") — proves the early exit was replayed.
    expect(await screen.findByText('1 完成')).toBeInTheDocument();
  });

  // Regression (PR #16 re-review): a batch larger than the foreign-token cap
  // whose processes all exit before any spawn resolves must NOT evict its own
  // staged exits. The cap scales with batch size, so every item still completes.
  it('does not evict staged exits for a batch larger than the cap', async () => {
    const user = userEvent.setup();
    const COUNT = 70; // > the 64 foreign-token headroom
    const features = Array.from({ length: COUNT }, (_, i) => makeFeature(`F${i + 1}`));

    // Defer every spawn; assign a unique token per call so exits can arrive first.
    const resolvers: Array<(v: { pid: number; spawnToken: number }) => void> = [];
    let nextToken = 0;
    spawnAgentMock.mockImplementation(() => {
      nextToken += 1;
      const token = nextToken;
      return new Promise<{ pid: number; spawnToken: number }>((resolve) => {
        resolvers.push((v) => resolve(v ?? { pid: token, spawnToken: token }));
      });
    });

    render(
      <I18nProvider>
        <BatchDispatchModal {...baseProps} features={features} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));
    // Wait until all spawns are in flight (tokens 1..COUNT assigned).
    await waitFor(() => expect(resolvers.length).toBe(COUNT));

    // Every exit lands before any spawn resolves — all staged at once.
    act(() => {
      for (let token = 1; token <= COUNT; token += 1) {
        exitHandler?.({ pid: token, spawnToken: token, code: 0 });
      }
    });

    // Now resolve every spawn → each token maps and drains its staged exit.
    await act(async () => {
      resolvers.forEach((resolve, i) => resolve({ pid: i + 1, spawnToken: i + 1 }));
    });

    // All complete — none evicted/stranded.
    expect(await screen.findByText(`${COUNT} 完成`)).toBeInTheDocument();
  });

  // Regression (PR #16 re-review, TaskDispatchModal.tsx:409 thread): a staged
  // EXIT must never be FIFO-evicted by a flood of unrelated stdout tokens from
  // concurrent runs (gates / other dispatches). Losing stdout is cosmetic;
  // losing the exit strands the item in "running".
  it('keeps a staged exit when foreign stdout tokens overflow the cap', async () => {
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
        <BatchDispatchModal {...baseProps} features={[makeFeature('F1')]} />
      </I18nProvider>,
    );

    await user.click(screen.getByText('開始批次派遣'));
    await waitFor(() => expect(exitHandler).not.toBeNull());

    act(() => {
      // This item's own exit lands first (token 900), before the spawn resolves.
      exitHandler?.({ pid: 900, spawnToken: 900, code: 0 });
      // Then a flood of foreign stdout-only tokens (never mapped) far exceeds the
      // cap. Old FIFO policy would evict token 900's exit; the fix sheds only
      // stdout-only tokens, preserving the exit.
      for (let t = 1000; t < 1100; t += 1) {
        stdoutHandler?.({ pid: t, spawnToken: t, line: `foreign ${t}` });
      }
    });

    await act(async () => {
      resolveSpawn?.({ pid: 900, spawnToken: 900 });
    });

    // The item completed → its staged exit survived the foreign-stdout flood.
    expect(await screen.findByText('1 完成')).toBeInTheDocument();
  });
});
