import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/terminal/TerminalSlot', () => ({
  TerminalSlot: () => <div data-testid="terminal-slot-mock" className="h-full min-h-0" />,
}));

import { createRuntimeAdapter, listAdapters } from '../lib/adapters/registry';
import { BUILT_IN_ADAPTER_SUPPORTS } from '../lib/capabilities/registry';
import { CURRENT_SCHEMA_VERSION } from '../lib/storage/migrate';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';
import { XmuxView } from '../app/ui/views/XmuxView';
import { __resetForTests as resetBrowserRegistry } from '../components/browser/BrowserRegistry';

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
  afterEach(() => {
    resetBrowserRegistry();
  });

  it('exposes cmux as the built-in agent CLI target', async () => {
    const adapters = listAdapters(baseConfig);
    const cmux = adapters.find((adapter) => adapter.id === 'cmux');

    expect(cmux).toMatchObject({
      id: 'cmux',
      name: 'cmux',
      type: 'agent',
      targetKind: 'agent-cli',
      command: 'cmux',
    });
    expect(adapters.some((adapter) => adapter.id === 'xmux')).toBe(false);

    const runtime = createRuntimeAdapter(baseConfig, 'cmux');
    expect(runtime).not.toBeNull();

    const result = await runtime!.execute({
      feature,
      prompt: 'Open the xmux workspace',
      projectRoot: '/tmp/project-manager',
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe('cmux');
  });

  it('normalizes a legacy configured xmux adapter into the cmux built-in slot', () => {
    const config: ProjectManagerConfig = {
      ...baseConfig,
      adapters: {
        ides: [],
        agents: [
          {
            id: 'xmux',
            name: 'xmux CLI',
            type: 'agent',
            targetKind: 'agent-cli',
            command: '/custom/bin/cmux',
            argsTemplate: ['send', '{prompt}'],
          },
        ],
      },
    };

    const adapters = listAdapters(config);
    const cmux = adapters.find((adapter) => adapter.id === 'cmux');

    expect(adapters.filter((adapter) => adapter.id === 'cmux')).toHaveLength(1);
    expect(adapters.some((adapter) => adapter.id === 'xmux')).toBe(false);
    expect(cmux).toMatchObject({
      id: 'cmux',
      command: '/custom/bin/cmux',
      argsTemplate: ['send', '{prompt}'],
    });
  });

  it('grants cmux the agent capability preset', () => {
    expect(BUILT_IN_ADAPTER_SUPPORTS.cmux).toEqual(
      expect.arrayContaining(['eyes', 'voice-tts', 'voice-stt', 'hands', 'recording']),
    );
  });

  it('renders the xmux operational view with workspaces and per-pane controls', () => {
    render(<XmuxView />);

    expect(screen.getAllByText('Realestate_Management_Apps').length).toBeGreaterThan(0);
    expect(screen.getByText('Project Management')).toBeInTheDocument();
    // F29: TerminalSlot is stubbed in setup.ts; assert the mock placeholder.
    expect(screen.getAllByTestId('terminal-slot-mock').length).toBeGreaterThan(0);
    // Initial split layout shows terminal and browser surfaces side-by-side.
    expect(screen.getByTitle('xmux browser pane')).toBeInTheDocument();
    expect(screen.getByLabelText('Notification panel')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Close pane').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('New terminal in this pane').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('New browser tab').length).toBeGreaterThanOrEqual(1);
  });

  it('makes the xmux pane controls interactive', async () => {
    const user = userEvent.setup();
    render(<XmuxView />);

    await user.click(screen.getByRole('button', { name: 'localhost' }));
    expect(screen.getByTitle('xmux browser pane')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Browser URL').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByLabelText('Notification panel'));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getAllByText('Codex waiting for input').length).toBeGreaterThan(0);

    await user.click(screen.getAllByLabelText('New browser tab')[0]);
    expect(screen.getAllByLabelText('Browser URL').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the browser URL input visible and saves edited URLs', async () => {
    const user = userEvent.setup();
    const project = createProjectEntry('project-github', 'Project GitHub');
    project.config.project.githubUrl = 'https://github.com/example/project-github';

    render(
      <XmuxView
        projects={[project]}
        selectedDashboardProjectIds={['project-github']}
        selectedProjectId="project-github"
      />,
    );

    const input = screen.getByLabelText('Browser URL') as HTMLInputElement;
    expect(input).toHaveValue('https://github.com/example/project-github');

    await user.clear(input);
    await user.type(input, 'example.com/docs');

    expect(screen.getByLabelText('Browser URL')).toBeInTheDocument();
    expect(input).toHaveValue('example.com/docs');

    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(screen.getByLabelText('Browser URL')).toHaveValue('http://example.com/docs');
    expect(screen.getByRole('button', { name: 'example.com' })).toBeInTheDocument();
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
