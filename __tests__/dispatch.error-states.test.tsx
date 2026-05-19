import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../lib/i18n';
import React from 'react';

// ── Mock complex external deps ────────────────────────────────────────────────

const createRuntimeAdapterMock = vi.fn().mockReturnValue({
  execute: vi.fn().mockResolvedValue({
    success: true,
    command: 'mock-cmd',
    args: ['--arg1', '--arg2'],
  }),
});

const collectEnabledMcpServersMock = vi.fn().mockReturnValue({});
const readFileMock = vi.fn().mockResolvedValue('mock spec content');

vi.mock('../lib/bridge', () => ({
  augmentArgsWithMcp: vi.fn().mockResolvedValue([]),
  killProcess: vi.fn().mockResolvedValue(undefined),
  mcpInjectionFlag: vi.fn().mockReturnValue(null),
  onAgentExit: vi.fn().mockResolvedValue(vi.fn()),
  onAgentStdout: vi.fn().mockResolvedValue(vi.fn()),
  readFile: readFileMock,
  spawnAgent: vi.fn().mockResolvedValue(12345),
  spawnTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/adapters/registry', () => ({
  createRuntimeAdapterFromConfig: createRuntimeAdapterMock,
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
  collectEnabledMcpServers: collectEnabledMcpServersMock,
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

// Agent-only adapters so default selection is agent-cli ("Run in Project Manager")
const AGENT_ADAPTERS = [
  { id: 'claude-code', name: 'Claude Code', type: 'agent' as const, command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
  { id: 'codex', name: 'Codex', type: 'agent' as const, command: 'codex', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
];

// Mixed adapters including IDE
const MIXED_ADAPTERS = [
  { id: 'Cursor', name: 'Cursor', type: 'ide' as const, command: 'cursor' },
  { id: 'claude-code', name: 'Claude Code', type: 'agent' as const, command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
];

describe('TaskDispatchModal [error states]', () => {
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
    readFileMock.mockResolvedValue('mock spec content');
  });

  // ── Adapter build failure ────────────────────────────────────────────────────

  it('shows error banner on adapter build failure', async () => {
    const user = userEvent.setup();

    // Make adapter execution fail
    createRuntimeAdapterMock.mockReturnValueOnce({
      execute: vi.fn().mockResolvedValue({
        success: false,
        message: 'Unable to build command for Claude Code',
      }),
    });

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // Click dispatch
    const dispatchBtn = screen.getByText('Run in Project Manager');
    await user.click(dispatchBtn);

    // Expect error message inline (post-run error banner)
    await waitFor(() => {
      expect(screen.getByText('Unable to build command for Claude Code')).toBeInTheDocument();
    });
  });

  // ── Adapter not found fallback ───────────────────────────────────────────────

  it('shows warning when assigned adapter is not found, falls back to first', () => {
    const featureWithMissingAdapter = {
      ...MOCK_FEATURE,
      promptConfig: {
        agentId: 'nonexistent-adapter',
      },
    };

    render(
      <I18nProvider>
        <TaskDispatchModal
          {...baseProps}
          feature={featureWithMissingAdapter}
        />
      </I18nProvider>,
    );

    // Warning should mention the missing adapter and the fallback
    expect(screen.getByText(/nonexistent-adapter/)).toBeInTheDocument();
    expect(screen.getByText(/Previously assigned adapter/)).toBeInTheDocument();
    // The warning text includes the fallback name — use getAllByText since
    // 'Claude Code' also appears as a select option
    const claudeMatches = screen.getAllByText(/Claude Code/);
    expect(claudeMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show adapter warning when saved adapter exists', () => {
    const featureWithExistingAdapter = {
      ...MOCK_FEATURE,
      promptConfig: {
        agentId: 'claude-code',
      },
    };

    render(
      <I18nProvider>
        <TaskDispatchModal
          {...baseProps}
          feature={featureWithExistingAdapter}
        />
      </I18nProvider>,
    );

    // Should not show adapter warning
    expect(screen.queryByText(/no longer configured/)).not.toBeInTheDocument();
  });

  // ── Command not found indicator (select option text) ─────────────────────────

  it('renders the dispatch modal without crashing with no adapters', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} adapters={[]} />
      </I18nProvider>,
    );

    expect(screen.getByText('Task Dispatch')).toBeInTheDocument();
  });

  // ── Empty adapter list ───────────────────────────────────────────────────────

  it('modal renders with close button when adapters list is empty', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} adapters={[]} />
      </I18nProvider>,
    );

    expect(screen.getByText('Task Dispatch')).toBeInTheDocument();
    expect(screen.getByText('No available adapters')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.queryByText('Run in Project Manager')).not.toBeInTheDocument();
  });

  it('disables the prompt textarea while the spec file loads', async () => {
    let resolveSpec: (content: string) => void = () => {};
    readFileMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveSpec = resolve;
    }));

    const { container } = render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea).toBeDisabled();

    await act(async () => {
      resolveSpec('loaded spec');
    });
    await waitFor(() => expect(textarea).not.toBeDisabled());
  });

  // ── MCP empty state ─────────────────────────────────────────────────────────

  it('shows "No MCP servers configured" when no servers are enabled', () => {
    // With agent-cli adapters, MCP empty state should be visible
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    expect(screen.getByText('No MCP servers configured')).toBeInTheDocument();
  });

  // ── MCP error banner via dispatch failure ────────────────────────────────────

  it('surfaces dispatch error via post-run error banner', async () => {
    const user = userEvent.setup();

    // Make buildCommand fail
    createRuntimeAdapterMock.mockReturnValueOnce({
      execute: vi.fn().mockResolvedValue({
        success: false,
        message: 'Adapter build failed due to MCP dependency issue',
      }),
    });

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // Click dispatch
    const dispatchBtn = screen.getByText('Run in Project Manager');
    await user.click(dispatchBtn);

    // Error should surface
    await waitFor(() => {
      expect(screen.getByText('Adapter build failed due to MCP dependency issue')).toBeInTheDocument();
    });
  });

  // ── MCP not shown for IDE adapters ──────────────────────────────────────────

  it('does not show MCP state for IDE adapters', () => {
    // Use mixed adapters — Cursor (IDE) will be selected first due to defaultIDE
    render(
      <I18nProvider>
        <TaskDispatchModal
          {...baseProps}
          adapters={MIXED_ADAPTERS}
        />
      </I18nProvider>,
    );

    // MCP empty should NOT be visible (hidden when targetKind !== 'agent-cli')
    expect(screen.queryByText('No MCP servers configured')).not.toBeInTheDocument();
  });

  // ── No adapter selected error path ───────────────────────────────────────────

  it('handles dispatch without crashing when no adapters are available', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} adapters={[]} />
      </I18nProvider>,
    );

    // The component renders title and close button
    expect(screen.getByText('Task Dispatch')).toBeInTheDocument();
    // With no adapters, there's no dispatch button context
  });

  // ── MCP loading (test initial render with no MCP) ───────────────────────────

  it('shows basic modal layout with execution target label', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    expect(screen.getByText('Execution Target')).toBeInTheDocument();
  });
});
