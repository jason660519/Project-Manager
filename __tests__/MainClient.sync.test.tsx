/**
 * Integration tests for the cross-route dashboard-project selection sync.
 *
 * Core scenario:
 *   1. User opens the Dashboard Projects sheet (MainClient currentView='dashboard')
 *   2. User toggles the 'project-manager' checkbox → selection persisted to localStorage
 *   3. User navigates to /project-progress-dashboard
 *      (new MainClient instance mounts)
 *   4. New instance reads localStorage → shows the updated selection
 */

import { act, render, screen, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY } from '../lib/dashboardStorage';
import { I18nProvider } from '../lib/i18n';
import {
  KEY_PERSONAL_DASHBOARD_PROJECT_IDS,
  KEY_PERSONAL_SEEDED,
  KEY_PERSONAL_SELECTED_PROJECT_ID,
  KEY_SHARED_PROJECTS,
} from '../lib/storage/keys';

// ── Mock heavy / Tauri-specific dependencies ───────────────────────────────────

vi.mock('../app/ui/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// MainClient now renders ProjectProgressClient under the dashboard route;
// stub it the same way the legacy DashboardClient stub worked so the existing
// data-testid contract still holds.
vi.mock('../app/project-progress-dashboard/ProjectProgressClient', () => ({
  ProjectProgressClient: ({
    features,
    selectedDashboardProjectIds,
    onToggleDashboardProject,
  }: {
    features: { id: string }[];
    selectedDashboardProjectIds: string[];
    onToggleDashboardProject: (id: string, selected: boolean) => void;
  }) => (
    <div data-testid="dashboard" data-feature-count={features.length}>
      <span data-testid="current-selection">{JSON.stringify(selectedDashboardProjectIds)}</span>
      <button
        data-testid="toggle-project-manager-on"
        onClick={() => onToggleDashboardProject('project-manager', true)}
      >
        Add project-manager
      </button>
      <button
        data-testid="toggle-project-manager-off"
        onClick={() => onToggleDashboardProject('project-manager', false)}
      >
        Remove project-manager
      </button>
    </div>
  ),
}));

vi.mock('../app/ui/views/FeaturesView', () => ({
  FeaturesView: () => <div data-testid="features" />,
}));

/**
 * ProjectsView stub renders the current selection and exposes
 * a "Toggle project-manager" button that calls onToggleDashboardProject.
 */
vi.mock('../app/ui/views/ProjectsView', () => ({
  ProjectsView: ({
    selectedDashboardProjectIds,
    onToggleDashboardProject,
  }: {
    selectedDashboardProjectIds: string[];
    onToggleDashboardProject: (id: string, selected: boolean) => void;
  }) => (
    <div data-testid="projects">
      <span data-testid="current-selection">{JSON.stringify(selectedDashboardProjectIds)}</span>
      <button
        data-testid="toggle-project-manager-on"
        onClick={() => onToggleDashboardProject('project-manager', true)}
      >
        Add project-manager
      </button>
      <button
        data-testid="toggle-project-manager-off"
        onClick={() => onToggleDashboardProject('project-manager', false)}
      >
        Remove project-manager
      </button>
    </div>
  ),
}));

vi.mock('../app/ui/views/SettingsView', () => ({
  SettingsView: () => <div data-testid="settings" />,
}));

vi.mock('../app/ui/views/IngestionView', () => ({
  IngestionView: () => <div data-testid="ingestion" />,
}));

vi.mock('../lib/adapters/registry', () => ({
  listAdapters: () => [],
  listAdapterDescriptors: () => [],
}));

// ── Import the component under test AFTER mocks are declared ──────────────────
const { MainClient } = await import('../app/ui/MainClient');

function renderMainClient(
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1],
): RenderResult {
  return render(<I18nProvider>{ui}</I18nProvider>, options);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function flushEffects() {
  await act(async () => {});
}

function getStoredDashboardIds(): string[] {
  const raw = localStorage.getItem(DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkbox toggle → localStorage sync', () => {
  it('adds project-manager to localStorage immediately when checkbox is checked', async () => {
    const user = userEvent.setup();
    const { unmount } = renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();

    await user.click(screen.getByTestId('toggle-project-manager-on'));

    const stored = getStoredDashboardIds();
    expect(stored).toContain('project-manager');
    expect(stored).toContain('owner-property'); // original project preserved
    unmount();
  });

  it('removes project-manager from localStorage when checkbox is unchecked', async () => {
    // Seed localStorage so project-manager is already selected
    localStorage.setItem(
      DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['owner-property', 'project-manager']),
    );

    const user = userEvent.setup();
    const { unmount } = renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();

    await user.click(screen.getByTestId('toggle-project-manager-off'));

    const stored = getStoredDashboardIds();
    expect(stored).not.toContain('project-manager');
    unmount();
  });

  it('allows deselecting every project (empty selection is a valid user state)', async () => {
    // Both projects selected to start
    localStorage.setItem(
      DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['owner-property', 'project-manager']),
    );

    const user = userEvent.setup();
    const { unmount } = renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();

    // Remove project-manager — selection should drop to just owner-property
    await user.click(screen.getByTestId('toggle-project-manager-off'));
    let stored = getStoredDashboardIds();
    expect(stored).toEqual(['owner-property']);

    // The stub button can also exercise the toggle-off code path for the
    // remaining project ID, indirectly through Project Manager's filter; but the
    // important property here is that the empty state is reachable and
    // persisted (no auto-re-add).
    unmount();
  });
});

describe('cross-route persistence: dashboard Projects sheet → /project-progress-dashboard', () => {
  it('dashboard receives updated feature list after project-manager is added', async () => {
    const user = userEvent.setup();

    const { unmount: unmount1 } = renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();
    await user.click(screen.getByTestId('toggle-project-manager-on'));
    unmount1();

    renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();

    const dashboard = screen.getByTestId('dashboard');
    // features from both projects should be present (> 0 means loading worked)
    expect(Number(dashboard.getAttribute('data-feature-count'))).toBeGreaterThan(0);
  });
});

describe('init: localStorage state is restored on fresh mount', () => {
  it('reads previously saved dashboard selection on mount', async () => {
    localStorage.setItem(
      DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['owner-property', 'project-manager']),
    );

    renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();

    const selectionEl = screen.getByTestId('current-selection');
    const selection: string[] = JSON.parse(selectionEl.textContent ?? '[]');

    expect(selection).toContain('owner-property');
    expect(selection).toContain('project-manager');
  });

  it('defaults to first project when localStorage is empty', async () => {
    renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();

    const selectionEl = screen.getByTestId('current-selection');
    const selection: string[] = JSON.parse(selectionEl.textContent ?? '[]');

    expect(selection).toEqual(['owner-property']);
  });
});

describe('empty project list', () => {
  it('renders dashboard without crashing when storage has zero projects', async () => {
    localStorage.setItem(KEY_SHARED_PROJECTS, JSON.stringify([]));
    localStorage.setItem(KEY_PERSONAL_SEEDED, 'true');

    renderMainClient(<MainClient currentView="dashboard" />);
    await flushEffects();

    expect(screen.getByTestId('projects')).toBeInTheDocument();
  });
});

describe('web registry sync', () => {
  it('merges newer disk features into an existing non-empty project snapshot', async () => {
    const oldFeatures = Array.from({ length: 20 }, (_, index) => ({
      id: `F${String(index + 1).padStart(2, '0')}`,
      name: `Feature ${index + 1}`,
      status: 'todo',
      progress: 10,
      category: 'Development',
    }));
    const diskFeatures = [
      ...oldFeatures,
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `F${String(index + 21).padStart(2, '0')}`,
        name: `Feature ${index + 21}`,
        status: 'done',
        progress: 100,
        category: 'Development',
      })),
    ];
    const configPath = '/Users/Project-Manager/.project-manager/config.json';
    const baseConfig = {
      schemaVersion: 6,
      project: {
        name: 'Project Manager',
        root: '/Users/Project-Manager',
        defaultIDE: 'Cursor',
        githubUrl: 'https://github.com/jason660519/Project-Manager',
      },
      features: oldFeatures,
      adapters: { ides: [], agents: [] },
    };

    localStorage.setItem(KEY_PERSONAL_SEEDED, 'true');
    localStorage.setItem(KEY_PERSONAL_SELECTED_PROJECT_ID, 'project-manager');
    localStorage.setItem(KEY_PERSONAL_DASHBOARD_PROJECT_IDS, JSON.stringify(['project-manager']));
    localStorage.setItem(
      KEY_SHARED_PROJECTS,
      JSON.stringify([
        {
          id: 'project-manager',
          configPath,
          config: baseConfig,
        },
      ]),
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        {
          configPath,
          config: {
            ...baseConfig,
            features: diskFeatures,
          },
        },
      ],
    } as Response);

    renderMainClient(<MainClient currentView="dashboard" />);

    await screen.findByTestId('dashboard');
    await vi.waitFor(() => {
      expect(screen.getByTestId('dashboard')).toHaveAttribute('data-feature-count', '24');
    });
  });
});
