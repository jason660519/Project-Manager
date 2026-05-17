import type { ProjectEntry } from '../types';
import { LocalStorageProjectsRepository } from './LocalStorageProjectsRepository';
import type { ProjectsRepository } from './ProjectsRepository';

export type { ProjectsRepository } from './ProjectsRepository';
export { CURRENT_SCHEMA_VERSION, migrateConfig } from './migrate';
export { mergeFeaturesById } from './mergeFeatures';
export { resolveConfigPath } from './resolveConfigPath';

let repoInstance: ProjectsRepository | null = null;

/**
 * Return the active ProjectsRepository singleton.  Today the only backend
 * is browser localStorage; future implementations (Tauri SQLite, cloud sync)
 * plug in here without touching call sites.
 */
export function getProjectsRepository(): ProjectsRepository {
  if (!repoInstance) repoInstance = new LocalStorageProjectsRepository();
  return repoInstance;
}

/**
 * Resolve which project ID should be the active selection on app boot.
 * Order of preference: route-provided > persisted > first project.
 */
export function resolveInitialProjectId(
  projects: ProjectEntry[],
  preferredId: string | undefined,
  storedId: string | null,
): string {
  if (preferredId && projects.some((p) => p.id === preferredId)) return preferredId;
  if (storedId && projects.some((p) => p.id === storedId)) return storedId;
  return projects[0]?.id ?? '';
}

/**
 * Clean up persisted dashboard selection against the current project list.
 * Falls back to a single-project default when nothing valid remains.
 */
export function resolveDashboardProjectIds(
  projects: ProjectEntry[],
  stored: string[] | null,
): string[] {
  if (!stored) return projects[0] ? [projects[0].id] : [];
  const valid = stored.filter((id) => projects.some((p) => p.id === id));
  if (valid.length > 0) return valid;
  return projects[0] ? [projects[0].id] : [];
}
