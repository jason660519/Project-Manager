import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BrowserPane, type BrowserTab } from '../components/browser/BrowserPane';
import { XmuxView } from '../app/ui/views/XmuxView';
import { CURRENT_SCHEMA_VERSION } from '../lib/storage/migrate';
import type { ProjectEntry, ProjectManagerConfig } from '../lib/types';

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
  features: [],
  adapters: { ides: [], agents: [] },
  engineerRoles: [],
};

function createProjectEntry(opts: {
  id: string;
  name: string;
  githubUrl?: string;
}): ProjectEntry {
  return {
    id: opts.id,
    config: {
      ...baseConfig,
      id: opts.id,
      project: {
        ...baseConfig.project,
        name: opts.name,
        root: `/tmp/${opts.id}`,
        githubUrl: opts.githubUrl,
      },
    },
    configPath: `/tmp/${opts.id}/.project-manager/config.json`,
  };
}

const DEFAULT_HOMEPAGE = 'http://localhost:43187/project-progress-dashboard';

describe('BrowserPane (F28 T-5, T-6, T-9, T-12)', () => {
  function singleTab(url: string): BrowserTab {
    return { id: 't1', url, label: 'test' };
  }

  it('T-5: typing URL and pressing Enter calls onNavigate with http:// prefix', () => {
    const onNavigate = vi.fn();
    render(
      <BrowserPane
        tabs={[singleTab(DEFAULT_HOMEPAGE)]}
        activeTabId="t1"
        homepageUrl={DEFAULT_HOMEPAGE}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNavigate={onNavigate}
        actions={{}}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    fireEvent.change(input, { target: { value: 'github.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('t1', 'http://github.com');
  });

  it('T-5 (alt): an already-prefixed URL is passed through verbatim', () => {
    const onNavigate = vi.fn();
    render(
      <BrowserPane
        tabs={[singleTab(DEFAULT_HOMEPAGE)]}
        activeTabId="t1"
        homepageUrl={DEFAULT_HOMEPAGE}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNavigate={onNavigate}
        actions={{}}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    fireEvent.change(input, { target: { value: 'https://example.com/path' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onNavigate).toHaveBeenCalledWith('t1', 'https://example.com/path');
  });

  it('T-6: mid-typing URL is not overwritten by parent re-render', () => {
    const onNavigate = vi.fn();
    const tab = singleTab(DEFAULT_HOMEPAGE);
    const { rerender } = render(
      <BrowserPane
        tabs={[tab]}
        activeTabId="t1"
        homepageUrl={DEFAULT_HOMEPAGE}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNavigate={onNavigate}
        actions={{}}
      />,
    );

    const input = screen.getByLabelText('Browser URL') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'partial-input' } });
    expect(input.value).toBe('partial-input');

    // Parent re-renders with unrelated prop change (homepageUrl update).
    rerender(
      <BrowserPane
        tabs={[tab]}
        activeTabId="t1"
        homepageUrl={`${DEFAULT_HOMEPAGE}?changed=true`}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNavigate={onNavigate}
        actions={{}}
      />,
    );

    // Mid-typing input survives parent re-render.
    expect(input.value).toBe('partial-input');
  });

  it('T-9: with a single tab, the close button is not rendered', () => {
    render(
      <BrowserPane
        tabs={[singleTab(DEFAULT_HOMEPAGE)]}
        activeTabId="t1"
        homepageUrl={DEFAULT_HOMEPAGE}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNavigate={vi.fn()}
        actions={{}}
      />,
    );
    expect(screen.queryByLabelText(/^Close /)).not.toBeInTheDocument();
  });

  it('T-12: external link href reflects the active tab URL', () => {
    const tabs: BrowserTab[] = [
      { id: 'a', url: 'https://example.com', label: 'example' },
      { id: 'b', url: 'https://github.com', label: 'github' },
    ];
    const { rerender } = render(
      <BrowserPane
        tabs={tabs}
        activeTabId="a"
        homepageUrl={DEFAULT_HOMEPAGE}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNavigate={vi.fn()}
        actions={{}}
      />,
    );

    const link = screen.getByLabelText('Open browser URL externally') as HTMLAnchorElement;
    expect(link.href).toBe('https://example.com/');

    rerender(
      <BrowserPane
        tabs={tabs}
        activeTabId="b"
        homepageUrl={DEFAULT_HOMEPAGE}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNavigate={vi.fn()}
        actions={{}}
      />,
    );
    const linkAfter = screen.getByLabelText('Open browser URL externally') as HTMLAnchorElement;
    expect(linkAfter.href).toBe('https://github.com/');
  });
});

describe('XmuxView browser tab integration (F28 T-7, T-8, T-10, T-11, T-14)', () => {
  function renderWithProjects(projects: ProjectEntry[], dashboardIds?: string[]) {
    return render(
      <XmuxView
        projects={projects}
        selectedDashboardProjectIds={dashboardIds ?? projects.map((p) => p.id)}
      />,
    );
  }

  it('T-7: clicking 4-icon "New browser tab" appends a tab (existing tab URL preserved)', async () => {
    const user = userEvent.setup();
    const projects = [createProjectEntry({ id: 'p1', name: 'P1' })];
    renderWithProjects(projects);

    // Initially one browser tab seeded with workspace homepage label.
    const initialTabs = screen.getAllByRole('button', { name: /localhost/i });
    expect(initialTabs.length).toBeGreaterThanOrEqual(1);

    // Click 4-icon Globe (New browser tab) — there are 3 of them across panes; click the first.
    const newBrowserButtons = screen.getAllByLabelText('New browser tab');
    expect(newBrowserButtons.length).toBeGreaterThanOrEqual(3);
    await user.click(newBrowserButtons[0]);

    // Two browser tabs now (both labels still derived from localhost homepage).
    const tabsAfter = screen.getAllByRole('button', { name: /localhost/i });
    expect(tabsAfter.length).toBeGreaterThanOrEqual(2);
  });

  it('T-8: clicking close on a non-active tab removes it; last surviving tab has no close button', async () => {
    const user = userEvent.setup();
    const projects = [createProjectEntry({ id: 'p1', name: 'P1' })];
    renderWithProjects(projects);

    const newBrowserButtons = screen.getAllByLabelText('New browser tab');
    await user.click(newBrowserButtons[0]); // 2 tabs
    await user.click(newBrowserButtons[0]); // 3 tabs

    let closeButtons = screen.getAllByLabelText(/^Close /);
    expect(closeButtons).toHaveLength(3);

    await user.click(closeButtons[0]); // close first tab
    closeButtons = screen.getAllByLabelText(/^Close /);
    expect(closeButtons).toHaveLength(2);

    await user.click(closeButtons[0]); // close again
    expect(screen.queryByLabelText(/^Close /)).not.toBeInTheDocument(); // last one has no × button
  });

  it('T-10: switching workspaces preserves per-workspace browser tabs', async () => {
    const user = userEvent.setup();
    const projects = [
      createProjectEntry({ id: 'pa', name: 'Project Alpha' }),
      createProjectEntry({ id: 'pb', name: 'Project Beta' }),
    ];
    renderWithProjects(projects);

    // Workspace Alpha is active by default (first dashboard-selected). Open one extra tab.
    const newBrowserButtons1 = screen.getAllByLabelText('New browser tab');
    await user.click(newBrowserButtons1[0]); // Alpha now has 2 tabs

    // Switch to workspace Beta.
    await user.click(screen.getByText('Project Beta'));
    // Beta is fresh with 1 seeded tab; no close button.
    expect(screen.queryByLabelText(/^Close /)).not.toBeInTheDocument();

    // Switch back to Alpha — 2 tabs intact.
    await user.click(screen.getByText('Project Alpha'));
    const closeButtonsAfter = screen.getAllByLabelText(/^Close /);
    expect(closeButtonsAfter).toHaveLength(2);
  });

  it('T-11: project with githubUrl seeds browser tab at that URL', () => {
    const projects = [
      createProjectEntry({
        id: 'p-with-gh',
        name: 'With GH',
        githubUrl: 'https://github.com/org/repo',
      }),
    ];
    renderWithProjects(projects);

    const iframe = screen.getByTitle('xmux browser pane') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://github.com/org/repo');
  });

  it('T-11 fallback: project without githubUrl seeds at the localhost dashboard', () => {
    const projects = [createProjectEntry({ id: 'p-no-gh', name: 'No GH' })];
    renderWithProjects(projects);
    const iframe = screen.getByTitle('xmux browser pane') as HTMLIFrameElement;
    expect(iframe.src).toBe(DEFAULT_HOMEPAGE);
  });

  it('T-14: switching workspaces does not force-reload the previous workspace\'s active tab URL', async () => {
    const user = userEvent.setup();
    const projects = [
      createProjectEntry({ id: 'pa', name: 'Alpha' }),
      createProjectEntry({ id: 'pb', name: 'Beta' }),
    ];
    renderWithProjects(projects);

    // Navigate Alpha's tab to a different URL.
    const input = screen.getByLabelText('Browser URL') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Wait microtask for state to settle by re-querying iframe.
    let iframe = screen.getByTitle('xmux browser pane') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://example.com/');

    // Switch to Beta then back to Alpha.
    await user.click(screen.getByText('Beta'));
    await user.click(screen.getByText('Alpha'));

    iframe = screen.getByTitle('xmux browser pane') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://example.com/');
  });
});
