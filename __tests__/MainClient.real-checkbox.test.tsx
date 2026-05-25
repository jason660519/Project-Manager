/**
 * Integration test using the REAL ProjectsView checkbox (not a mocked button).
 *
 * Reproduces the user-reported scenario:
 *   - In the Dashboard Projects sheet, checking the project-manager checkbox should:
 *     1. Show the DASHBOARD badge next to project-manager's name
 *     2. Bump "Dashboard scope: N" to 2
 *     3. Persist to localStorage so a fresh dashboard mount sees both
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub heavy bits so the real ProjectsView is exercised end-to-end.
vi.mock('../app/ui/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../app/project-progress-dashboard/ProjectProgressClient', async () => {
  const React = await import('react');
  const { ProjectsView } = await vi.importActual<typeof import('../app/ui/views/ProjectsView')>(
    '../app/ui/views/ProjectsView',
  );

  return {
    ProjectProgressClient: (props: React.ComponentProps<typeof ProjectsView>) =>
      React.createElement(ProjectsView, props),
  };
});

vi.mock('../app/ui/views/FeaturesView', () => ({
  FeaturesView: () => <div data-testid="features" />,
}));

vi.mock('../app/ui/views/SettingsView', () => ({
  SettingsView: () => <div data-testid="settings" />,
}));

vi.mock('../lib/adapters/registry', () => ({
  listAdapters: () => [],
  listAdapterDescriptors: () => [],
}));

// The real ProjectsView imports the bridge (Tauri/GitHub).  We're in jsdom
// (not Tauri), so the GitHub-token preload is just a no-op stub.
vi.mock('../lib/bridge', () => ({
  getGithubToken: async () => '',
  setGithubToken: async () => {},
  getSecret: async () => null,
  setSecret: async () => {},
}));

async function flushEffects() {
  // Two ticks: first to let init effect's async Promise.all resolve, second to
  // flush any cascading state updates (persist + validation effects).
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

// Reset module state between tests so the storage singleton is rebuilt and
// runs its legacy-key migration against the current localStorage snapshot.
async function freshImport() {
  vi.resetModules();
  const { MainClient } = await import('../app/ui/MainClient');
  const { getProjectsRepository } = await import('../lib/storage');
  return { MainClient, getProjectsRepository };
}

beforeEach(() => {
  localStorage.clear();
});

describe('real ProjectsView checkbox behavior', () => {
  it('clicking project-manager checkbox shows DASHBOARD badge and bumps scope to 2', async () => {
    const { MainClient } = await freshImport();
    const user = userEvent.setup();
    render(<MainClient currentView="dashboard" />);
    await flushEffects();

    // Two project rows should be rendered, both with their own checkbox.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    // Initial state: owner-property checked, project-manager unchecked.
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);

    // Click project-manager's checkbox.
    await user.click(checkboxes[1]);
    await flushEffects();

    // Project-Manager's checkbox should now be checked.
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);

    // Two DASHBOARD badges should now appear (one per project row).
    const badges = screen.getAllByText(/^Dashboard$/);
    expect(badges).toHaveLength(2);

    // "Dashboard scope: 2" should appear.
    expect(screen.getByText(/Dashboard scope:\s*2/)).toBeInTheDocument();
  });

  it('persists selection to namespaced localStorage so fresh dashboard mounts see it', async () => {
    const { MainClient, getProjectsRepository } = await freshImport();
    const user = userEvent.setup();
    const { unmount } = render(<MainClient currentView="dashboard" />);
    await flushEffects();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // toggle project-manager on
    await flushEffects();

    const stored = await getProjectsRepository().getDashboardProjectIds();
    expect(stored).toContain('owner-property');
    expect(stored).toContain('project-manager');
    unmount();

    // Mount a fresh dashboard instance — it should see both projects.
    render(<MainClient currentView="dashboard" />);
    await flushEffects();

    expect(screen.getByText(/Dashboard scope:\s*2/)).toBeInTheDocument();
  });

  it('unchecks project-manager when toggled off (does not stick like the first project)', async () => {
    const { MainClient } = await freshImport();
    const user = userEvent.setup();
    render(<MainClient currentView="dashboard" />);
    await flushEffects();

    const checkboxes = screen.getAllByRole('checkbox');
    // Check project-manager first
    await user.click(checkboxes[1]);
    await flushEffects();
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);

    // Uncheck project-manager — should actually toggle off (not blocked by guard)
    await user.click(checkboxes[1]);
    await flushEffects();
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it('restores selection from legacy localStorage on first mount', async () => {
    // Simulate a user upgrading from the old flat-key version of the app.
    localStorage.setItem(
      'devpilot-dashboard-selected-project-ids',
      JSON.stringify(['owner-property', 'project-manager']),
    );

    const { MainClient } = await freshImport();
    render(<MainClient currentView="dashboard" />);
    await flushEffects();

    const checkboxes = screen.getAllByRole('checkbox');
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
  });
});
