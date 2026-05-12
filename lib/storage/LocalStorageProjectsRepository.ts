import type { ProjectEntry } from '../types';
import {
  KEY_PERSONAL_DASHBOARD_PROJECT_IDS,
  KEY_PERSONAL_SELECTED_PROJECT_ID,
  KEY_SHARED_PROJECTS,
  LEGACY_KEY_DASHBOARD_PROJECT_IDS,
  LEGACY_KEY_PROJECTS,
  LEGACY_KEY_SELECTED_PROJECT_ID,
} from './keys';
import { migrateConfig } from './migrate';
import type { ProjectsRepository } from './ProjectsRepository';

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage quota or disabled — silently no-op */
  }
}

/**
 * Move a value from a legacy flat key to its namespaced counterpart.
 * Won't overwrite an existing namespaced value (so re-running is safe).
 */
function migrateLegacyKey(from: string, to: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(from);
    if (raw === null) return;
    if (window.localStorage.getItem(to) === null) {
      window.localStorage.setItem(to, raw);
    }
    window.localStorage.removeItem(from);
  } catch {
    /* ignore */
  }
}

/**
 * Move all known legacy flat keys to their namespaced counterparts.
 * Idempotent — `migrateLegacyKey` is a no-op when the legacy key is absent,
 * so re-running across instances (or test resets) is safe and cheap.
 */
function runLegacyMigration(): void {
  migrateLegacyKey(LEGACY_KEY_PROJECTS, KEY_SHARED_PROJECTS);
  migrateLegacyKey(LEGACY_KEY_SELECTED_PROJECT_ID, KEY_PERSONAL_SELECTED_PROJECT_ID);
  migrateLegacyKey(LEGACY_KEY_DASHBOARD_PROJECT_IDS, KEY_PERSONAL_DASHBOARD_PROJECT_IDS);
}

export class LocalStorageProjectsRepository implements ProjectsRepository {
  constructor() {
    runLegacyMigration();
  }

  async listProjects(): Promise<ProjectEntry[]> {
    const raw = readJSON<ProjectEntry[]>(KEY_SHARED_PROJECTS);
    if (!Array.isArray(raw)) return [];
    // Always run schema migration on read so v1 configs lifted from older
    // sessions get bumped to the current shape transparently.
    return raw.map((entry) => ({
      ...entry,
      config: migrateConfig(entry.config),
    }));
  }

  async saveProjects(projects: ProjectEntry[]): Promise<void> {
    writeJSON(KEY_SHARED_PROJECTS, projects);
  }

  async getSelectedProjectId(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(KEY_PERSONAL_SELECTED_PROJECT_ID);
    } catch {
      return null;
    }
  }

  async setSelectedProjectId(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY_PERSONAL_SELECTED_PROJECT_ID, id);
    } catch {
      /* ignore */
    }
  }

  async getDashboardProjectIds(): Promise<string[] | null> {
    const raw = readJSON<string[]>(KEY_PERSONAL_DASHBOARD_PROJECT_IDS);
    return Array.isArray(raw) ? raw : null;
  }

  async setDashboardProjectIds(ids: string[]): Promise<void> {
    writeJSON(KEY_PERSONAL_DASHBOARD_PROJECT_IDS, ids);
  }
}
