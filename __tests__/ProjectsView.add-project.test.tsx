/**
 * Regression tests for the two Add Project modal bugs the user hit:
 *
 *   1. The "Project folder path" (AI Scan) and "Path to existing
 *      .project-manager.json" (Manual Add) inputs were sharing a single
 *      `localPath` state, so typing in one updated the other.
 *
 *   2. Manual Add passed the raw user input to readConfig.  When the user
 *      pasted a folder path, Rust returned `Is a directory (os error 21)`
 *      with no hint that the manual add wanted a file path.  Manual Add
 *      should normalize folder → `<folder>/.project-manager.json` before
 *      reading, and surface a clearer error when the file is absent.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture every readConfig call so we can assert on the path it received.
const readConfigMock = vi.fn();
const pickProjectFoldersMock = vi.fn();
const detectGithubRepoUrlMock = vi.fn();
const writeConfigMock = vi.fn();
const migrateProjectLayoutMock = vi.fn(async (projectRoot: string) => ({
  migrated: false,
  configPath: `${projectRoot}/.project-manager/config.json`,
}));

vi.mock('../lib/bridge', () => ({
  getGithubToken: async () => '',
  setGithubToken: async () => {},
  readConfig: (path: string) => readConfigMock(path),
  detectGithubRepoUrl: (projectRoot: string) => detectGithubRepoUrlMock(projectRoot),
  fetchGithubRepo: async () => [],
  pickProjectFolders: (opts?: { multiple?: boolean }) => pickProjectFoldersMock(opts),
  migrateProjectLayout: (root: string) => migrateProjectLayoutMock(root),
  writeConfig: (path: string, config: unknown) => writeConfigMock(path, config),
}));

import { ProjectsView } from '../app/ui/views/ProjectsView';

// Flag the renderer as Tauri so handleAddLocal takes the readConfig branch.
beforeEach(() => {
  readConfigMock.mockReset();
  pickProjectFoldersMock.mockReset();
  detectGithubRepoUrlMock.mockReset();
  detectGithubRepoUrlMock.mockResolvedValue(null);
  writeConfigMock.mockReset();
  writeConfigMock.mockResolvedValue(undefined);
  migrateProjectLayoutMock.mockClear();
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
});

describe('Projects list — GitHub repository URL editing', () => {
  it('saves a normalized GitHub URL to local project config', async () => {
    const onUpdateProject = vi.fn();
    const user = userEvent.setup();
    renderModal({
      projects: [
        {
          id: 'p1',
          configPath: '/Volumes/Projects/alpha/.project-manager/config.json',
          config: {
            schemaVersion: 7,
            id: 'cfg-1',
            project: { name: 'Alpha', root: '/Volumes/Projects/alpha', defaultIDE: 'Cursor' },
            features: [],
            adapters: { ides: [], agents: [] },
          },
          configMissing: false,
        },
      ],
      selectedProjectId: 'p1',
      onUpdateProject,
    });

    await user.click(screen.getByRole('button', { name: /add url/i }));
    await user.type(
      screen.getByPlaceholderText('https://github.com/owner/repo'),
      'git@github.com:org/alpha.git',
    );
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(writeConfigMock).toHaveBeenCalledWith(
        '/Volumes/Projects/alpha/.project-manager/config.json',
        expect.objectContaining({
          project: expect.objectContaining({ githubUrl: 'https://github.com/org/alpha' }),
        }),
      );
      expect(onUpdateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            project: expect.objectContaining({ githubUrl: 'https://github.com/org/alpha' }),
          }),
        }),
      );
    });
  });
});

function renderModal(overrides: Partial<Parameters<typeof ProjectsView>[0]> = {}) {
  const onAddProject = vi.fn();
  render(
    <ProjectsView
      projects={[]}
      selectedProjectId=""
      selectedDashboardProjectIds={[]}
      onSelectProject={() => {}}
      onToggleDashboardProject={() => {}}
      onAddProject={onAddProject}
      onUpdateProject={overrides.onUpdateProject ?? vi.fn()}
      onRemoveProject={() => {}}
      runHistory={[]}
      {...overrides}
    />,
  );
  return { onAddProject };
}

async function openAddModal(user: ReturnType<typeof userEvent.setup>) {
  // Only one "Add Project" button exists before the modal opens — the trigger.
  await user.click(screen.getByRole('button', { name: /add project/i }));
}

/**
 * After the modal opens, two buttons named "Add Project" exist: the header
 * trigger and the modal's submit button. The submit button is rendered last.
 */
function getModalSubmit(): HTMLElement {
  const matches = screen.getAllByRole('button', { name: /^add project$/i });
  return matches[matches.length - 1];
}

describe('Add Project modal — manual add path normalization', () => {
  it('appends .project-manager/config.json when a folder path is given', async () => {
    readConfigMock.mockResolvedValueOnce({
      schemaVersion: 2,
      id: 'fixture-id',
      project: { name: 'Realestate', root: '/Volumes/KLEVV-4T-1/Realestate_Management_Apps', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    });

    const user = userEvent.setup();
    const { onAddProject } = renderModal();
    await openAddModal(user);

    const manualInput = screen.getByPlaceholderText(
      '/path/to/project (auto-detects .project-manager/)',
    ) as HTMLInputElement;

    // The user pastes the FIXTURE folder path (mirrors the bug screenshot).
    await user.type(manualInput, '/Volumes/KLEVV-4T-1/Realestate_Management_Apps');

    await user.click(getModalSubmit());

    await waitFor(() => {
      expect(readConfigMock).toHaveBeenCalledWith(
        '/Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager/config.json',
      );
    });

    await waitFor(() => {
      expect(onAddProject).toHaveBeenCalled();
    });

    // The stored configPath should be the normalized file path inside the dashboard folder.
    const entry = onAddProject.mock.calls[0][0];
    expect(entry.configPath).toBe(
      '/Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager/config.json',
    );
  });

  it('auto-detects a local GitHub origin when importing a local project', async () => {
    readConfigMock.mockResolvedValueOnce({
      schemaVersion: 2,
      id: 'fixture-id',
      project: { name: 'Project Manager', root: '/Volumes/KLEVV-4T-1/Project-Manager', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    });
    detectGithubRepoUrlMock.mockResolvedValueOnce('https://github.com/jason660519/Project-Manager');

    const user = userEvent.setup();
    const { onAddProject } = renderModal();
    await openAddModal(user);

    await user.type(
      screen.getByPlaceholderText('/path/to/project (auto-detects .project-manager/)'),
      '/Volumes/KLEVV-4T-1/Project-Manager',
    );
    await user.click(getModalSubmit());

    await waitFor(() => {
      expect(detectGithubRepoUrlMock).toHaveBeenCalledWith('/Volumes/KLEVV-4T-1/Project-Manager');
      expect(onAddProject).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            project: expect.objectContaining({
              githubUrl: 'https://github.com/jason660519/Project-Manager',
            }),
          }),
        }),
      );
    });
  });

  it('passes through a path that already ends with .project-manager/config.json', async () => {
    readConfigMock.mockResolvedValueOnce({
      schemaVersion: 2,
      id: 'x',
      project: { name: 'X', root: '/foo', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    });

    const user = userEvent.setup();
    renderModal();
    await openAddModal(user);

    const manualInput = screen.getByPlaceholderText(
      '/path/to/project (auto-detects .project-manager/)',
    ) as HTMLInputElement;

    await user.type(manualInput, '/foo/.project-manager/config.json');
    await user.click(getModalSubmit());

    await waitFor(() => {
      expect(readConfigMock).toHaveBeenCalledWith('/foo/.project-manager/config.json');
    });
  });

  it('normalises a legacy .project-manager.json path to the new layout', async () => {
    readConfigMock.mockResolvedValueOnce({
      schemaVersion: 2,
      id: 'x',
      project: { name: 'X', root: '/foo', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    });

    const user = userEvent.setup();
    renderModal();
    await openAddModal(user);

    const manualInput = screen.getByPlaceholderText(
      '/path/to/project (auto-detects .project-manager/)',
    ) as HTMLInputElement;

    await user.type(manualInput, '/foo/.project-manager.json');
    await user.click(getModalSubmit());

    await waitFor(() => {
      expect(readConfigMock).toHaveBeenCalledWith('/foo/.project-manager/config.json');
    });
  });

  it('registers the folder when dashboard config is missing (setup deferred)', async () => {
    readConfigMock.mockRejectedValueOnce(
      new Error('Cannot read /Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager/config.json: No such file or directory (os error 2)'),
    );

    const user = userEvent.setup();
    const { onAddProject } = renderModal();
    await openAddModal(user);

    const manualInput = screen.getByPlaceholderText(
      '/path/to/project (auto-detects .project-manager/)',
    ) as HTMLInputElement;

    await user.type(manualInput, '/Volumes/KLEVV-4T-1/Realestate_Management_Apps');
    await user.click(getModalSubmit());

    await waitFor(() => {
      expect(onAddProject).toHaveBeenCalledWith(
        expect.objectContaining({
          configMissing: true,
          configPath: '/Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager/config.json',
        }),
      );
    });
    expect(screen.queryByText(/Is a directory/i)).not.toBeInTheDocument();
  });
});

describe('Add Project modal — Finder folder picker', () => {
  it('batch-imports multiple folders chosen from the native picker', async () => {
    const user = userEvent.setup();
    const { onAddProject } = renderModal();

    pickProjectFoldersMock.mockResolvedValue({
      status: 'ok',
      paths: ['/Volumes/Projects/alpha', '/Volumes/Projects/beta'],
    });
    readConfigMock.mockImplementation(async (path: string) => ({
      schemaVersion: 2,
      project: {
        name: path.includes('alpha') ? 'Alpha' : 'Beta',
        root: path.replace(/\/\.project-manager\/config\.json$/, ''),
        defaultIDE: 'Cursor',
      },
      features: [],
      adapters: { ides: [], agents: [] },
    }));

    await openAddModal(user);
    await user.click(screen.getByRole('button', { name: /choose from finder/i }));

    await waitFor(() => {
      expect(pickProjectFoldersMock).toHaveBeenCalledWith(
        expect.objectContaining({ multiple: true }),
      );
    });
    await waitFor(() => {
      expect(onAddProject).toHaveBeenCalledTimes(2);
    });
  });

  it('fills the manual input when Browse is used for a single folder', async () => {
    const user = userEvent.setup();
    renderModal();

    pickProjectFoldersMock.mockResolvedValue({
      status: 'ok',
      paths: ['/Volumes/Projects/my-app'],
    });

    await openAddModal(user);
    const browseBtn = screen.getByRole('button', { name: /^browse$/i });
    await user.click(browseBtn);

    await waitFor(() => {
      expect(pickProjectFoldersMock).toHaveBeenCalledWith(
        expect.objectContaining({ multiple: false }),
      );
    });
    const manualInput = screen.getByPlaceholderText(
      '/path/to/project (auto-detects .project-manager/)',
    ) as HTMLInputElement;
    expect(manualInput.value).toBe('/Volumes/Projects/my-app');
  });

  it('quietly closes when the user cancels the picker (no error, no import)', async () => {
    const user = userEvent.setup();
    const { onAddProject } = renderModal();

    pickProjectFoldersMock.mockResolvedValue({ status: 'cancelled' });

    await openAddModal(user);
    await user.click(screen.getByRole('button', { name: /choose from finder/i }));

    await waitFor(() => {
      expect(pickProjectFoldersMock).toHaveBeenCalled();
    });

    // Modal stays open (no submit), no project imported, no error shown.
    expect(onAddProject).not.toHaveBeenCalled();
    expect(screen.queryByText(/No projects were imported/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Skipped/i)).not.toBeInTheDocument();
  });

  it('imports folders even when every chosen path lacks a config file', async () => {
    const user = userEvent.setup();
    const { onAddProject } = renderModal();

    pickProjectFoldersMock.mockResolvedValue({
      status: 'ok',
      paths: ['/Volumes/Projects/empty-1', '/Volumes/Projects/empty-2'],
    });
    readConfigMock.mockRejectedValue(
      new Error('Cannot read config: No such file or directory (os error 2)'),
    );

    await openAddModal(user);
    await user.click(screen.getByRole('button', { name: /choose from finder/i }));

    await waitFor(() => {
      expect(onAddProject).toHaveBeenCalledTimes(2);
    });
    expect(onAddProject).toHaveBeenCalledWith(expect.objectContaining({ configMissing: true }));
    await waitFor(() => {
      expect(screen.getByText(/Generate project data/i)).toBeInTheDocument();
    });
  });

  it('opens batch scan prompt when some imported folders need setup', async () => {
    const user = userEvent.setup();
    const { onAddProject } = renderModal();

    pickProjectFoldersMock.mockResolvedValue({
      status: 'ok',
      paths: ['/Volumes/Projects/alpha', '/Volumes/Projects/beta'],
    });
    readConfigMock.mockImplementation(async (path: string) => {
      if (path.includes('alpha')) {
        return {
          schemaVersion: 2,
          project: { name: 'Alpha', root: '/Volumes/Projects/alpha', defaultIDE: 'Cursor' },
          features: [],
          adapters: { ides: [], agents: [] },
        };
      }
      throw new Error(`Cannot read ${path}: No such file or directory (os error 2)`);
    });

    await openAddModal(user);
    await user.click(screen.getByRole('button', { name: /choose from finder/i }));

    await waitFor(() => {
      expect(onAddProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText(/Generate project data/i)).toBeInTheDocument();
  });
});
