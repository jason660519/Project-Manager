import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/terminal/TerminalSlot', () => ({
  TerminalSlot: () => <div data-testid="terminal-slot-mock" className="h-full min-h-0" />,
}));

import { createRuntimeAdapter, listAdapters } from '../lib/adapters/registry';
import { BUILT_IN_ADAPTER_SUPPORTS } from '../lib/capabilities/registry';
import { CURRENT_SCHEMA_VERSION } from '../lib/storage/migrate';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';
import { XmuxView } from '../app/ui/views/XmuxView';

const feature: Feature = {
  id: 'F27',
  name: 'xmux Coding Tool Sidebar Entry',
  category: 'Execution',
  status: 'in_progress',
  progress: 10,
  paths: {},
};

const baseConfig: ProjectManagerConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'project-manager',
  createdAt: '2026-05-25T00:00:00.000Z',
  updatedAt: '2026-05-25T00:00:00.000Z',
  project: {
    name: 'Project Manager',
    root: '/tmp/project-manager',
    defaultIDE: 'Cursor',
  },
  features: [feature],
  adapters: {
    ides: [],
    agents: [],
  },
  engineerRoles: [],
};

function createProjectEntry(id: string, name: string): ProjectEntry {
  return {
    id,
    config: {
      ...baseConfig,
      id,
      project: {
        ...baseConfig.project,
        name,
        root: `/tmp/${id}`,
      },
      features: [],
    },
    configPath: `/tmp/${id}/.project-manager/config.json`,
  };
}

describe('xmux registry integration', () => {
  it('exposes xmux as the built-in cmux-backed agent CLI target', async () => {
    const adapters = listAdapters(baseConfig);
    const xmux = adapters.find((adapter) => adapter.id === 'xmux');

    expect(xmux).toMatchObject({
      id: 'xmux',
      name: 'xmux',
      type: 'agent',
      targetKind: 'agent-cli',
      command: 'cmux',
    });
    expect(adapters.some((adapter) => adapter.id === 'cmux')).toBe(false);

    const runtime = createRuntimeAdapter(baseConfig, 'xmux');
    expect(runtime).not.toBeNull();

    const result = await runtime!.execute({
      feature,
      prompt: 'Open the xmux workspace',
      projectRoot: '/tmp/project-manager',
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe('cmux');
  });

  it('normalizes a legacy configured cmux adapter into the xmux built-in slot', () => {
    const config: ProjectManagerConfig = {
      ...baseConfig,
      adapters: {
        ides: [],
        agents: [
          {
            id: 'cmux',
            name: 'Cmux CLI',
            type: 'agent',
            targetKind: 'agent-cli',
            command: '/custom/bin/cmux',
            argsTemplate: ['send', '{prompt}'],
          },
        ],
      },
    };

    const adapters = listAdapters(config);
    const xmux = adapters.find((adapter) => adapter.id === 'xmux');

    expect(adapters.filter((adapter) => adapter.id === 'xmux')).toHaveLength(1);
    expect(adapters.some((adapter) => adapter.id === 'cmux')).toBe(false);
    expect(xmux).toMatchObject({
      id: 'xmux',
      command: '/custom/bin/cmux',
      argsTemplate: ['send', '{prompt}'],
    });
  });

  it('grants xmux the agent capability preset', () => {
    expect(BUILT_IN_ADAPTER_SUPPORTS.xmux).toEqual(
      expect.arrayContaining(['eyes', 'voice-tts', 'voice-stt', 'hands', 'recording']),
    );
  });

  it('renders the xmux operational view with workspaces and per-pane controls', () => {
    render(<XmuxView />);

    expect(screen.getAllByText('Realestate_Management_Apps').length).toBeGreaterThan(0);
    expect(screen.getByText('Project Management')).toBeInTheDocument();
    // F29: TerminalSlot is stubbed in setup.ts; assert the mock placeholder.
    expect(screen.getAllByTestId('terminal-slot-mock').length).toBeGreaterThan(0);
    expect(screen.getByTitle('xmux browser pane')).toBeInTheDocument();
    expect(screen.getByLabelText('Notification panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Close pane')).toBeInTheDocument();
    expect(screen.getAllByLabelText('New terminal in this pane').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('New browser tab').length).toBeGreaterThanOrEqual(1);
  });

  it('makes the xmux pane controls interactive', async () => {
    const user = userEvent.setup();
    render(<XmuxView />);

    expect(screen.getAllByTitle('xmux browser pane').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('Browser URL').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByLabelText('Notification panel'));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getAllByText('Codex waiting for input').length).toBeGreaterThan(0);

    await user.click(screen.getAllByLabelText('New browser tab')[0]);
    expect(screen.getAllByLabelText('Browser URL').length).toBeGreaterThanOrEqual(2);
  });

  it('only shows dashboard-selected projects when project data is provided', () => {
    const projects = [
      createProjectEntry('project-a', 'Project A'),
      createProjectEntry('project-b', 'Project B'),
      createProjectEntry('project-c', 'Project C'),
    ];

    render(<XmuxView projects={projects} selectedDashboardProjectIds={['project-b']} />);

    expect(screen.getByText('Project B')).toBeInTheDocument();
    expect(screen.queryByText('Project A')).not.toBeInTheDocument();
    expect(screen.queryByText('Project C')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /顯示全部專案/i })).not.toBeInTheDocument();
  });
});
