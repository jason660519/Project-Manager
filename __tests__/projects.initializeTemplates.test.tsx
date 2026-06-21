import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsView } from '../app/ui/views/ProjectsView';
import { I18nProvider } from '../lib/i18n';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';
import type { ScanResult } from '../lib/scanner/shared';
import type { RunProjectScanOptions } from '../lib/scanner/runProjectScan';

const { runProjectScanMock, applyScanConfigToProjectMock } = vi.hoisted(() => ({
  runProjectScanMock: vi.fn<(root: string, options?: RunProjectScanOptions) => Promise<ScanResult>>(),
  applyScanConfigToProjectMock: vi.fn(),
}));

vi.mock('../lib/bridge', () => ({
  getGithubToken: async () => '',
  writeFile: async () => {},
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

function entry(id: string, name: string, features: Feature[] = []): ProjectEntry {
  return {
    id,
    configPath: `/tmp/${name}/.project-manager/config.json`,
    config: config(name, features),
    configMissing: features.length === 0,
  };
}

function renderView(
  projects: ProjectEntry[],
  props: Partial<React.ComponentProps<typeof ProjectsView>> = {},
) {
  render(
    <I18nProvider>
      <ProjectsView
        projects={projects}
        selectedProjectId={projects[0]?.id ?? ''}
        selectedDashboardProjectIds={projects.map((p) => p.id)}
        onSelectProject={() => {}}
        onToggleDashboardProject={() => {}}
        onAddProject={() => {}}
        onUpdateProject={() => {}}
        onRemoveProject={() => {}}
        runHistory={[]}
        {...props}
      />
    </I18nProvider>,
  );
}

async function toggleProgressSheetInRow(
  row: HTMLElement,
  sheetName: RegExp,
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(within(row).getByRole('button', { name: /desktop app development|select progress sheets/i }));
  const listbox = screen.getByRole('listbox');
  await user.click(within(listbox).getByRole('checkbox', { name: sheetName }));
}

describe('Projects initialization template picker', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    runProjectScanMock.mockReset();
    applyScanConfigToProjectMock.mockReset();
  });

  it('requires at least one selected template before AI scan initialization', async () => {
    const user = userEvent.setup();
    renderView([entry('p1', 'alpha')]);

    const row = screen.getByRole('row', { name: /alpha/i });
    await toggleProgressSheetInRow(row, /desktop app development progress sheet/i, user);
    await user.click(within(row).getByRole('button', { name: /^initialize$/i }));

    expect(await screen.findByText(/select at least one progress sheet/i)).toBeInTheDocument();
    expect(runProjectScanMock).not.toHaveBeenCalled();
  });

  it('applies selected templates to the AI scan initialization config', async () => {
    const user = userEvent.setup();
    const project = entry('p2', 'bravo');
    const scanned = config('bravo', [feature('F01')]);
    const updatedEntry = { ...project, config: scanned, configMissing: false };
    runProjectScanMock.mockResolvedValue({
      success: true,
      config: scanned,
      providerUsed: 'openai',
      attempts: [{ provider: 'openai', outcome: 'success' }],
    } as unknown as ScanResult);
    applyScanConfigToProjectMock.mockResolvedValue(updatedEntry);
    renderView([project]);

    const row = screen.getByRole('row', { name: /bravo/i });
    await toggleProgressSheetInRow(row, /marketing campaign progress sheet/i, user);
    await user.click(within(row).getByRole('button', { name: /^initialize$/i }));

    await waitFor(() => expect(applyScanConfigToProjectMock).toHaveBeenCalled());
    expect(applyScanConfigToProjectMock).toHaveBeenCalledWith(
      project,
      expect.objectContaining({
        progressSheets: expect.arrayContaining([
          expect.objectContaining({ id: 'software-desktop-app' }),
          expect.objectContaining({ id: 'marketing-campaign' }),
        ]),
      }),
      expect.objectContaining({ sectionCandidates: undefined, inventoryPaths: undefined }),
    );
  });

  it('passes selected templates to Create, Merge, and Overwrite scaffold initialization', async () => {
    const user = userEvent.setup();
    const project = entry('p3', 'charlie');
    const onInitializeProject = vi.fn(async () => {});
    renderView([project], { onInitializeProject });

    const row = screen.getByRole('row', { name: /charlie/i });
    await toggleProgressSheetInRow(row, /hardware r&d progress sheet/i, user);
    await user.click(within(row).getByRole('button', { name: /create scaffold/i }));
    await user.click(within(row).getByRole('button', { name: /merge scaffold/i }));
    await user.click(within(row).getByRole('button', { name: /overwrite scaffold/i }));

    await waitFor(() => expect(onInitializeProject).toHaveBeenCalledTimes(3));
    for (const mode of ['create', 'merge', 'overwrite']) {
      expect(onInitializeProject).toHaveBeenCalledWith('p3', mode, [
        'software-desktop-app',
        'hardware-rd',
      ]);
    }
  });
});
