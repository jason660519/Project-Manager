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

vi.mock('../lib/bridge', () => ({
  getGithubToken: async () => '',
  setGithubToken: async () => {},
  readConfig: (path: string) => readConfigMock(path),
  fetchGithubRepo: async () => [],
}));

import { ProjectsView } from '../app/ui/views/ProjectsView';

// Flag the renderer as Tauri so handleAddLocal takes the readConfig branch.
beforeEach(() => {
  readConfigMock.mockReset();
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
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
      onRemoveProject={() => {}}
      onSyncProject={async () => {}}
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

describe('Add Project modal — independent inputs', () => {
  it('AI Scan and Manual Add inputs do not share state', async () => {
    const user = userEvent.setup();
    renderModal();
    await openAddModal(user);

    // First input = AI Scan ("Project folder path").
    const scanInput = screen.getByPlaceholderText('/path/to/your/project') as HTMLInputElement;
    // Second input = Manual Add ("Path to existing .project-manager.json").
    const manualInput = screen.getByPlaceholderText(
      '/path/to/project/.project-manager.json',
    ) as HTMLInputElement;

    await user.type(scanInput, '/scan/folder');

    // Typing in the AI Scan input must NOT propagate to the manual input.
    expect(scanInput.value).toBe('/scan/folder');
    expect(manualInput.value).toBe('');

    await user.type(manualInput, '/manual/.project-manager.json');
    expect(scanInput.value).toBe('/scan/folder');
    expect(manualInput.value).toBe('/manual/.project-manager.json');
  });
});

describe('Add Project modal — manual add path normalization', () => {
  it('appends .project-manager.json when a folder path is given', async () => {
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
      '/path/to/project/.project-manager.json',
    ) as HTMLInputElement;

    // The user pastes the FIXTURE folder path (mirrors the bug screenshot).
    await user.type(manualInput, '/Volumes/KLEVV-4T-1/Realestate_Management_Apps');

    await user.click(getModalSubmit());

    await waitFor(() => {
      expect(readConfigMock).toHaveBeenCalledWith(
        '/Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager.json',
      );
    });

    await waitFor(() => {
      expect(onAddProject).toHaveBeenCalled();
    });

    // The stored configPath should be the normalized file path, not the folder.
    const entry = onAddProject.mock.calls[0][0];
    expect(entry.configPath).toBe(
      '/Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager.json',
    );
  });

  it('passes through a path that already ends with .project-manager.json', async () => {
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
      '/path/to/project/.project-manager.json',
    ) as HTMLInputElement;

    await user.type(manualInput, '/foo/.project-manager.json');
    await user.click(getModalSubmit());

    await waitFor(() => {
      expect(readConfigMock).toHaveBeenCalledWith('/foo/.project-manager.json');
    });
  });

  it('shows a friendly error suggesting AI Scan when the config file is missing', async () => {
    // Simulate what Rust's read_config returns when there is no file at the path.
    readConfigMock.mockRejectedValueOnce(
      new Error('Cannot read /Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager.json: No such file or directory (os error 2)'),
    );

    const user = userEvent.setup();
    renderModal();
    await openAddModal(user);

    const manualInput = screen.getByPlaceholderText(
      '/path/to/project/.project-manager.json',
    ) as HTMLInputElement;

    await user.type(manualInput, '/Volumes/KLEVV-4T-1/Realestate_Management_Apps');
    await user.click(getModalSubmit());

    // Error should explain that no .project-manager.json was found at that
    // location and suggest the AI Scan path forward.  Look for the marker
    // phrase in the error region (not the AI Scan button label itself).
    await waitFor(() => {
      expect(screen.getByText(/No \.project-manager\.json found/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Is a directory/i)).not.toBeInTheDocument();
  });
});
