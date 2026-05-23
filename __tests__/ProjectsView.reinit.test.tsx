import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsView } from '../app/ui/views/ProjectsView';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';
import type { ScanResult } from '../lib/scanner/shared';

const { runProjectScanMock, applyScanConfigToProjectMock } = vi.hoisted(() => ({
  runProjectScanMock: vi.fn<(root: string) => Promise<ScanResult>>(),
  applyScanConfigToProjectMock: vi.fn(),
}));

vi.mock('../lib/bridge', () => ({
  getGithubToken: async () => '',
  setGithubToken: async () => {},
}));

vi.mock('../lib/keys/loadProviderKey', () => ({
  hasProviderKey: vi.fn(async () => true),
}));

vi.mock('../lib/scanner/runProjectScan', () => ({
  runProjectScan: (root: string) => runProjectScanMock(root),
}));

vi.mock('../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../lib/storage')>('../lib/storage');
  return {
    ...actual,
    applyScanConfigToProject: (...args: unknown[]) => applyScanConfigToProjectMock(...args),
  };
});

function feature(id: string): Feature {
  return {
    id,
    name: `Feature ${id}`,
    category: 'Core',
    status: 'todo',
    progress: 0,
    paths: {},
  };
}

function config(name: string, features: Feature[]): ProjectManagerConfig {
  return {
    schemaVersion: 6,
    id: `${name}-id`,
    project: { name, root: `/tmp/${name}`, defaultIDE: 'Cursor' },
    features,
    adapters: { ides: [], agents: [] },
  };
}

function entry(
  id: string,
  name: string,
  options: { features?: Feature[]; configMissing?: boolean } = {},
): ProjectEntry {
  return {
    id,
    configPath: `/tmp/${name}/.project-manager/config.json`,
    config: config(name, options.features ?? []),
    configMissing: options.configMissing,
  };
}

function renderView(projects: ProjectEntry[], onUpdateProject = vi.fn()) {
  render(
    <ProjectsView
      projects={projects}
      selectedProjectId={projects[0]?.id ?? ''}
      selectedDashboardProjectIds={projects.map((p) => p.id)}
      onSelectProject={() => {}}
      onToggleDashboardProject={() => {}}
      onAddProject={() => {}}
      onUpdateProject={onUpdateProject}
      onRemoveProject={() => {}}
      runHistory={[]}
    />,
  );
  return { onUpdateProject };
}

describe('ProjectsView initialize actions', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    runProjectScanMock.mockReset();
    applyScanConfigToProjectMock.mockReset();
  });

  it('shows Re-init button for ready projects', async () => {
    renderView([
      entry('ready-1', 'ready-project', { features: [feature('F01')] }),
    ]);

    expect(await screen.findByRole('button', { name: /re-init/i })).toBeInTheDocument();
    expect(screen.getByText(/Initialized/i)).toBeInTheDocument();
  });

  it('shows Initialize button for setup-needed projects', async () => {
    renderView([
      entry('needs-1', 'needs-project', { configMissing: true }),
    ]);

    expect(await screen.findByRole('button', { name: /initialize/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-init/i })).not.toBeInTheDocument();
  });

  it('clicking Re-init runs scan and updates project entry', async () => {
    const user = userEvent.setup();
    const readyProject = entry('ready-2', 'ready-project-2', { features: [feature('F02')] });
    const scanned = config('ready-project-2', [feature('F02')]);
    const updatedEntry: ProjectEntry = {
      ...readyProject,
      config: {
        ...readyProject.config,
        features: [{ ...feature('F02'), locatedSection: 'ui/views' }],
      },
    };

    runProjectScanMock.mockResolvedValue({
      success: true,
      config: scanned,
      providerUsed: 'openai',
      attempts: [{ provider: 'openai', outcome: 'success' }],
    } as unknown as ScanResult);
    applyScanConfigToProjectMock.mockResolvedValue(updatedEntry);

    const { onUpdateProject } = renderView([readyProject]);
    const button = await screen.findByRole('button', { name: /re-init/i });
    await user.click(button);

    await waitFor(() => {
      expect(runProjectScanMock).toHaveBeenCalledWith('/tmp/ready-project-2');
    });
    expect(applyScanConfigToProjectMock).toHaveBeenCalledWith(readyProject, scanned);
    expect(onUpdateProject).toHaveBeenCalledWith(updatedEntry);
  });
});

