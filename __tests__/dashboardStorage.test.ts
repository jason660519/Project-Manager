import { beforeEach, describe, expect, it } from 'vitest';
import {
  DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
  loadDashboardProjectIds,
  loadProjectsFromStorage,
  pickInitialProjectId,
} from '../lib/dashboardStorage';
import type { ProjectEntry } from '../lib/types';

// ── Test fixtures ──────────────────────────────────────────────────────────────

const makeProject = (id: string): ProjectEntry => ({
  id,
  configPath: `/projects/${id}/.project-manager.json`,
  config: {
    schemaVersion: 2,
    id: `${id}-doc-id`,
    project: { name: id, root: `/projects/${id}`, defaultIDE: 'Cursor' },
    features: [],
    adapters: { ides: [], agents: [] },
  },
});

const PROJECTS = [makeProject('alpha'), makeProject('beta'), makeProject('gamma')];

beforeEach(() => {
  localStorage.clear();
});

// ── loadProjectsFromStorage ────────────────────────────────────────────────────

describe('loadProjectsFromStorage', () => {
  it('returns fallback when storage is empty', () => {
    const result = loadProjectsFromStorage(PROJECTS);
    expect(result).toEqual(PROJECTS);
  });

  it('returns fallback plus user-added extras when storage has valid data', () => {
    const stored = [makeProject('stored-1'), makeProject('stored-2')];
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(stored));
    const result = loadProjectsFromStorage(PROJECTS);
    // fallback (alpha, beta, gamma) always present; stored extras appended
    expect(result.map((p) => p.id)).toContain('alpha');
    expect(result.map((p) => p.id)).toContain('stored-1');
  });

  it('includes fallback projects missing from stored data (stale-cache fix)', () => {
    // Only 'alpha' stored — 'beta' and 'gamma' are new canonical projects missing from cache
    const stored = [makeProject('alpha')];
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(stored));
    const result = loadProjectsFromStorage(PROJECTS);
    expect(result.map((p) => p.id)).toContain('alpha');
    expect(result.map((p) => p.id)).toContain('beta');
    expect(result.map((p) => p.id)).toContain('gamma');
  });

  it('returns fallback when stored JSON is malformed', () => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, 'not-json');
    expect(loadProjectsFromStorage(PROJECTS)).toEqual(PROJECTS);
  });

  it('returns fallback when stored array is empty', () => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, '[]');
    expect(loadProjectsFromStorage(PROJECTS)).toEqual(PROJECTS);
  });
});

// ── loadDashboardProjectIds ────────────────────────────────────────────────────

describe('loadDashboardProjectIds', () => {
  it('returns first project id when storage is empty', () => {
    expect(loadDashboardProjectIds(PROJECTS)).toEqual(['alpha']);
  });

  it('returns empty array when projects list is empty and storage is empty', () => {
    expect(loadDashboardProjectIds([])).toEqual([]);
  });

  it('returns all stored ids that are still valid projects', () => {
    localStorage.setItem(
      DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['alpha', 'gamma']),
    );
    expect(loadDashboardProjectIds(PROJECTS)).toEqual(['alpha', 'gamma']);
  });

  it('filters out ids that no longer exist in projects', () => {
    localStorage.setItem(
      DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['alpha', 'deleted-project']),
    );
    expect(loadDashboardProjectIds(PROJECTS)).toEqual(['alpha']);
  });

  it('falls back to first project when all stored ids are invalid', () => {
    localStorage.setItem(
      DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['deleted-1', 'deleted-2']),
    );
    expect(loadDashboardProjectIds(PROJECTS)).toEqual(['alpha']);
  });

  it('returns fallback when stored JSON is malformed', () => {
    localStorage.setItem(DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY, '{bad json}');
    expect(loadDashboardProjectIds(PROJECTS)).toEqual(['alpha']);
  });

  it('returns fallback when stored value is not an array', () => {
    localStorage.setItem(DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY, '"just-a-string"');
    expect(loadDashboardProjectIds(PROJECTS)).toEqual(['alpha']);
  });
});

// ── pickInitialProjectId ───────────────────────────────────────────────────────

describe('pickInitialProjectId', () => {
  it('returns the preferred id when it exists in projects', () => {
    expect(pickInitialProjectId(PROJECTS, 'gamma')).toBe('gamma');
  });

  it('ignores preferred id when it is not in the projects list', () => {
    localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, 'beta');
    expect(pickInitialProjectId(PROJECTS, 'not-a-project')).toBe('beta');
  });

  it('falls back to stored id when no preference given', () => {
    localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, 'beta');
    expect(pickInitialProjectId(PROJECTS)).toBe('beta');
  });

  it('falls back to first project when nothing is stored', () => {
    expect(pickInitialProjectId(PROJECTS)).toBe('alpha');
  });

  it('returns empty string when projects list is empty', () => {
    expect(pickInitialProjectId([])).toBe('');
  });
});
