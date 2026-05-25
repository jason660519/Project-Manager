import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../lib/i18n';
import React from 'react';

// ── Mock complex external deps ────────────────────────────────────────────────

vi.mock('../lib/bridge', () => ({
  augmentArgsWithMcp: vi.fn().mockResolvedValue([]),
  killProcess: vi.fn().mockResolvedValue(undefined),
  mcpInjectionFlag: vi.fn().mockReturnValue(null),
  onAgentExit: vi.fn().mockResolvedValue(vi.fn()),
  onAgentStdout: vi.fn().mockResolvedValue(vi.fn()),
  readFile: vi.fn().mockResolvedValue('mock spec content'),
  spawnAgent: vi.fn().mockResolvedValue(12345),
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

vi.mock('../lib/adapters/availability', () => ({
  checkCommandAvailability: vi.fn().mockResolvedValue({ status: 'available', canVerify: true }),
}));

// We only test TaskDispatchModal — import after mocks
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

const MOCK_ADAPTERS = [
  { id: 'claude-code', name: 'Claude Code', type: 'agent' as const, command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
  { id: 'codex', name: 'Codex', type: 'agent' as const, command: 'codex', argsTemplate: ['--cwd', '{root}', '{prompt}'] },
  { id: 'Cursor', name: 'Cursor', type: 'ide' as const, command: 'cursor' },
];

describe('TaskDispatchModal [render]', () => {
  const baseProps = {
    feature: MOCK_FEATURE,
    adapters: MOCK_ADAPTERS,
    projectRoot: '/Volumes/KLEVV-4T-1/Project-Manager',
    defaultIDE: 'Cursor' as const,
    onClose: vi.fn(),
    onExecuted: vi.fn(),
  };

  it('renders with I18nProvider without crashing', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    expect(screen.getByText('Task Dispatch')).toBeInTheDocument();
  });

  it('shows dispatch title with feature ID and name', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    expect(screen.getByText(/F13/)).toBeInTheDocument();
    expect(screen.getByText(/Dispatch UX Improvements/)).toBeInTheDocument();
  });

  it('renders the close button', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('renders execution target selector', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    // Should show the runtime label
    expect(screen.getByText('Execution Target')).toBeInTheDocument();
  });

  it('renders target hints for external IDE', () => {
    render(
      <I18nProvider>
        <TaskDispatchModal {...baseProps} />
      </I18nProvider>,
    );

    expect(screen.getByText(/External IDE/)).toBeInTheDocument();
  });
});
