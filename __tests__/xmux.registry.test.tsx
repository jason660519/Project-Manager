import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createRuntimeAdapter, listAdapters } from '../lib/adapters/registry';
import { BUILT_IN_ADAPTER_SUPPORTS } from '../lib/capabilities/registry';
import { CURRENT_SCHEMA_VERSION } from '../lib/storage/migrate';
import type { Feature, ProjectManagerConfig } from '../lib/types';
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

  it('renders the xmux operational view and design philosophy', () => {
    render(<XmuxView />);

    expect(screen.getByRole('heading', { name: 'xmux' })).toBeInTheDocument();
    expect(screen.getByText(/does not prescribe how developers must use AI/i)).toBeInTheDocument();
    expect(screen.getByText('xmux -> cmux')).toBeInTheDocument();
    expect(screen.getAllByText('Realestate_Management_Apps').length).toBeGreaterThan(0);
    expect(screen.getByText('Project Management')).toBeInTheDocument();
    expect(screen.getByText(/terminal panes embed a real shell/i)).toBeInTheDocument();
    expect(screen.getByText(/rooted at the active workspace folder/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Embedded terminal requires the Project Manager desktop app/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Built-In Browser')).toBeInTheDocument();
    expect(screen.getByText('Notification Panel')).toBeInTheDocument();
    expect(screen.getByText('Split Pane Layout')).toBeInTheDocument();
    expect(screen.getByLabelText('Right top xmux toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Built-in browser')).toBeInTheDocument();
    expect(screen.getByLabelText('Notification panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Split pane layout')).toBeInTheDocument();
  });

  it('makes the xmux toolbar controls interactive', async () => {
    const user = userEvent.setup();
    render(<XmuxView />);

    expect(screen.getByTitle('xmux browser pane')).toBeInTheDocument();
    expect(screen.getByLabelText('vertical split workspace')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Built-in browser'));
    expect(screen.queryByTitle('xmux browser pane')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Built-in browser'));
    expect(screen.getByTitle('xmux browser pane')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Notification panel'));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getAllByText('Codex waiting for input').length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText('Split pane layout'));
    expect(screen.getByLabelText('horizontal split workspace')).toBeInTheDocument();
  });
});
