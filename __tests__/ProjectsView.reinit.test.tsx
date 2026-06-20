import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsView } from '../app/ui/views/ProjectsView';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';
import type { ScanResult } from '../lib/scanner/shared';
import type { RunProjectScanOptions } from '../lib/scanner/runProjectScan';

const { runProjectScanMock, applyScanConfigToProjectMock } = vi.hoisted(() => ({
  runProjectScanMock: vi.fn<(root: string, options?: RunProjectScanOptions) => Promise<ScanResult>>(),
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
  runProjectScan: (root: string, options?: RunProjectScanOptions) => runProjectScanMock(root, options),
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
      expect(runProjectScanMock).toHaveBeenCalledWith(
        '/tmp/ready-project-2',
        expect.objectContaining({ onProgress: expect.any(Function) }),
      );
    });
    expect(applyScanConfigToProjectMock).toHaveBeenCalledWith(
      readyProject,
      expect.objectContaining({
        ...scanned,
        progressSheets: expect.arrayContaining([
          expect.objectContaining({ id: 'software-desktop-app' }),
        ]),
      }),
      {
        sectionCandidates: undefined,
        inventoryPaths: undefined,
      },
    );
    expect(onUpdateProject).toHaveBeenCalledWith(updatedEntry);
  });

  it('shows initialization trace events and clearer fallback notice', async () => {
    const user = userEvent.setup();
    const readyProject = entry('ready-3', 'ready-project-3', { features: [feature('F03')] });
    const scanned = config('ready-project-3', [feature('F03')]);
    const updatedEntry: ProjectEntry = {
      ...readyProject,
      config: scanned,
    };

    runProjectScanMock.mockImplementation(async (_root, options) => {
      options?.onProgress?.({
        stage: 'scan_files',
        status: 'running',
        message: 'Scanning project files and key documents',
        timestamp: '2026-05-24T00:00:00.000Z',
      });
      options?.onProgress?.({
        stage: 'provider_attempt',
        status: 'warning',
        message: 'gemini/gemini-pro failed',
        timestamp: '2026-05-24T00:00:01.000Z',
        provider: 'gemini',
        modelId: 'gemini-pro',
        outcome: 'retryable',
        error: 'model not found',
      });
      options?.onProgress?.({
        stage: 'provider_attempt',
        status: 'success',
        message: 'perplexity/sonar produced 1 feature',
        timestamp: '2026-05-24T00:00:02.000Z',
        provider: 'perplexity',
        modelId: 'sonar',
        outcome: 'success',
        featureCount: 1,
      });
      return {
        success: true,
        config: scanned,
        providerUsed: 'perplexity',
        usedModelId: 'sonar',
        attempts: [
          { provider: 'gemini', modelId: 'gemini-pro', outcome: 'retryable', error: 'model not found' },
          { provider: 'openai', modelId: 'gpt-4o', outcome: 'fatal', error: 'insufficient quota' },
          { provider: 'perplexity', modelId: 'sonar', outcome: 'success' },
        ],
      } as unknown as ScanResult;
    });
    applyScanConfigToProjectMock.mockResolvedValue(updatedEntry);

    renderView([readyProject]);
    await user.click(await screen.findByRole('button', { name: /re-init/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Initialization Trace/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Scanning project files and key documents/i)).toBeInTheDocument();
    expect(screen.getAllByText(/model not found/i).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(/initialized successfully with perplexity\/sonar/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/gemini\/gemini-pro \(model not found\)/i)).toBeInTheDocument();
    expect(screen.getByText(/openai\/gpt-4o \(Rate limit or quota issue\)/i)).toBeInTheDocument();
  });
});
