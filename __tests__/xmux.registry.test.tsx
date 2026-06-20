import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/terminal/TerminalSlot', () => ({
  TerminalSlot: () => <div data-testid="terminal-slot-mock" className="h-full min-h-0" />,
}));

vi.mock('../components/chat/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="xmux-sidebar-assistant-mock">AI Assistant docked chat</div>,
}));

import { createRuntimeAdapter, listAdapters } from '../lib/adapters/registry';
import { BUILT_IN_ADAPTER_SUPPORTS } from '../lib/capabilities/registry';
import { CURRENT_SCHEMA_VERSION } from '../lib/storage/migrate';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';
import { XmuxView } from '../app/ui/views/XmuxView';
import { __resetForTests as resetBrowserRegistry } from '../components/browser/BrowserRegistry';
import { XMUX_LAYOUT_STORAGE_KEY } from '../lib/xmux/layoutPersistence';

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
    // Initial split layout shows folder, browser, and terminal surfaces.
    expect(screen.getAllByLabelText('Refresh folder tree').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTitle('xmux browser pane')).toBeInTheDocument();
    expect(screen.getByLabelText('Notification panel')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Close pane').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('New terminal in this pane').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('New browser tab').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByLabelText('New AI Assistant tab')).not.toBeInTheDocument();
    expect(screen.getByTestId('xmux-sidebar-assistant-mock')).toBeInTheDocument();
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

    await user.keyboard('{Enter}');

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

  it('switches and closes project workspace sheet tabs', async () => {
    const user = userEvent.setup();
    const projects = [
      createProjectEntry('project-a', 'Project A'),
      createProjectEntry('project-b', 'Project B'),
    ];

    render(
      <XmuxView
        projects={projects}
        selectedDashboardProjectIds={['project-a', 'project-b']}
        selectedProjectId="project-a"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Project B workspace sheet' }));
    expect(screen.getByText('Project B Workspace')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close Project B workspace sheet' }));

    expect(screen.queryByRole('button', { name: 'Project B workspace sheet' })).not.toBeInTheDocument();
    expect(screen.getByText('Project A Workspace')).toBeInTheDocument();
  });

  it('resizes, closes, and reopens the AI Assistants dock', async () => {
    const user = userEvent.setup();
    render(<XmuxView />);

    const resizeHandle = screen.getByRole('separator', { name: 'Resize AI Assistants panel' });
    const dock = resizeHandle.closest('aside') as HTMLElement;
    expect(dock.style.width).toBe('340px');

    fireEvent.keyDown(window, { key: '+' });
    expect(dock.style.width).toBe('372px');

    fireEvent.keyDown(window, { key: '-' });
    expect(dock.style.width).toBe('340px');

    await user.click(screen.getByRole('button', { name: 'Close AI Assistants panel' }));
    expect(screen.queryByTestId('xmux-sidebar-assistant-mock')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open AI Assistants panel' }));
    expect(screen.getByTestId('xmux-sidebar-assistant-mock')).toBeInTheDocument();
  });

  it('persists resized block layout and restores it after remounting xmux', async () => {
    const project = createProjectEntry('project-layout', 'Project Layout');
    const props = {
      projects: [project],
      selectedDashboardProjectIds: ['project-layout'],
      selectedProjectId: 'project-layout',
    };

    const { unmount } = render(<XmuxView {...props} />);
    const rootSeparator = screen.getAllByRole('separator', { name: 'Resize split' })[0];
    const rootSplit = rootSeparator.parentElement as HTMLElement;
    rootSplit.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 1000,
        bottom: 600,
        width: 1000,
        height: 600,
        toJSON: () => {},
      }) as DOMRect;

    fireEvent.mouseDown(rootSeparator, { clientX: 280, clientY: 10 });
    fireEvent.mouseMove(document, { clientX: 620, clientY: 10 });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      const raw = window.localStorage.getItem(XMUX_LAYOUT_STORAGE_KEY);
      expect(raw).toBeTruthy();
      const saved = JSON.parse(raw ?? '{}');
      expect(saved.workspaces['project-layout'].layout.ratio).toBe(0.62);
    });

    unmount();
    render(<XmuxView {...props} />);

    const restoredSeparator = screen.getAllByRole('separator', { name: 'Resize split' })[0];
    expect((restoredSeparator.previousElementSibling as HTMLElement).style.width).toBe('62%');
  });

  it('debounces layout persistence during continuous resize', async () => {
    vi.useFakeTimers();
    try {
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
      const project = createProjectEntry('project-layout-debounce', 'Project Layout Debounce');
      const props = {
        projects: [project],
        selectedDashboardProjectIds: ['project-layout-debounce'],
        selectedProjectId: 'project-layout-debounce',
      };

      render(<XmuxView {...props} />);
      const rootSeparator = screen.getAllByRole('separator', { name: 'Resize split' })[0];
      const rootSplit = rootSeparator.parentElement as HTMLElement;
      rootSplit.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 1000,
          bottom: 600,
          width: 1000,
          height: 600,
          toJSON: () => {},
        }) as DOMRect;

      setItemSpy.mockClear();

      fireEvent.mouseDown(rootSeparator, { clientX: 280, clientY: 10 });
      fireEvent.mouseMove(document, { clientX: 580, clientY: 10 });
      fireEvent.mouseMove(document, { clientX: 620, clientY: 10 });
      fireEvent.mouseUp(document);

      expect(setItemSpy).not.toHaveBeenCalledWith(
        XMUX_LAYOUT_STORAGE_KEY,
        expect.any(String),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(setItemSpy).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(window.localStorage.getItem(XMUX_LAYOUT_STORAGE_KEY) ?? '{}');
      expect(saved.workspaces['project-layout-debounce'].layout.ratio).toBe(0.62);
    } finally {
      vi.useRealTimers();
    }
  });
});
