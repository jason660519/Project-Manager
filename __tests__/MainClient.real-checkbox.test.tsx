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
function renderMainClient(
  ui: React.ReactElement,
  Provider: React.ComponentType<{ children: React.ReactNode }>,
) {
  return render(<Provider>{ui}</Provider>);
}

async function freshImport() {
  vi.resetModules();
  const { MainClient } = await import('../app/ui/MainClient');
  const { I18nProvider: Provider } = await import('../lib/i18n');
  const { getProjectsRepository } = await import('../lib/storage');
  return { MainClient, I18nProvider: Provider, getProjectsRepository };
}

beforeEach(() => {
  localStorage.clear();
});

describe('real ProjectsView checkbox behavior', () => {
  function dashboardCheckboxes() {
    return {
      ownerProperty: screen.getByRole('checkbox', { name: /include owner-property-management-ai-spa in dashboard/i }),
      projectManager: screen.getByRole('checkbox', { name: /include project manager in dashboard/i }),
    };
  }

  it('clicking project-manager checkbox shows DASHBOARD badge and bumps scope to 2', async () => {
    const { MainClient, I18nProvider } = await freshImport();
    const user = userEvent.setup();
    renderMainClient(<MainClient currentView="dashboard" />, I18nProvider);
    await flushEffects();

    // Initial state: owner-property checked, project-manager unchecked.
    const { ownerProperty, projectManager } = dashboardCheckboxes();
    expect((ownerProperty as HTMLInputElement).checked).toBe(true);
    expect((projectManager as HTMLInputElement).checked).toBe(false);

    // Click project-manager's checkbox.
    await user.click(projectManager);
    await flushEffects();

    // Project-Manager's checkbox should now be checked.
    expect((projectManager as HTMLInputElement).checked).toBe(true);

    // Two DASHBOARD badges should now appear (one per project row).
    const badges = screen.getAllByText(/^Dashboard$/);
    expect(badges).toHaveLength(2);

    // "Dashboard scope: 2" should appear.
    expect(screen.getByText(/Dashboard scope:\s*2/)).toBeInTheDocument();
  });

  it('persists selection to namespaced localStorage so fresh dashboard mounts see it', async () => {
    const { MainClient, I18nProvider, getProjectsRepository } = await freshImport();
    const user = userEvent.setup();
    const { unmount } = renderMainClient(<MainClient currentView="dashboard" />, I18nProvider);
    await flushEffects();

    const { projectManager } = dashboardCheckboxes();
    await user.click(projectManager); // toggle project-manager on
    await flushEffects();

    const stored = await getProjectsRepository().getDashboardProjectIds();
    expect(stored).toContain('owner-property');
    expect(stored).toContain('project-manager');
    unmount();

    // Mount a fresh dashboard instance — it should see both projects.
    renderMainClient(<MainClient currentView="dashboard" />, I18nProvider);
    await flushEffects();

    expect(screen.getByText(/Dashboard scope:\s*2/)).toBeInTheDocument();
  });

  it('unchecks project-manager when toggled off (does not stick like the first project)', async () => {
    const { MainClient, I18nProvider } = await freshImport();
    const user = userEvent.setup();
    renderMainClient(<MainClient currentView="dashboard" />, I18nProvider);
    await flushEffects();

    const { projectManager } = dashboardCheckboxes();
    // Check project-manager first
    await user.click(projectManager);
    await flushEffects();
    expect((projectManager as HTMLInputElement).checked).toBe(true);

    // Uncheck project-manager — should actually toggle off (not blocked by guard)
    await user.click(projectManager);
    await flushEffects();
    expect((projectManager as HTMLInputElement).checked).toBe(false);
  });

  it('restores selection from legacy localStorage on first mount', async () => {
    // Simulate a user upgrading from the old flat-key version of the app.
    localStorage.setItem(
      'devpilot-dashboard-selected-project-ids',
      JSON.stringify(['owner-property', 'project-manager']),
    );

    const { MainClient, I18nProvider } = await freshImport();
    renderMainClient(<MainClient currentView="dashboard" />, I18nProvider);
    await flushEffects();

    const { ownerProperty, projectManager } = dashboardCheckboxes();
    expect((ownerProperty as HTMLInputElement).checked).toBe(true);
    expect((projectManager as HTMLInputElement).checked).toBe(true);
  });
});
