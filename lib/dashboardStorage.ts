/**
 * @deprecated  Use `getProjectsRepository()` from `lib/storage` instead.
 *
 * This module is kept as a thin compatibility shim so that the existing test
 * suites under `__tests__/` continue to work without rewriting them in this
 * refactor.  Production code now goes through `ProjectsRepository` (see
 * `lib/storage/index.ts`); the storage keys are re-exported with their old
 * names but point at the new namespaced values.
 */

import {
  KEY_PERSONAL_DASHBOARD_PROJECT_IDS,
  KEY_PERSONAL_SELECTED_PROJECT_ID,
  KEY_SHARED_PROJECTS,
} from './storage/keys';
import type { ProjectEntry } from './types';

export const PROJECTS_STORAGE_KEY = KEY_SHARED_PROJECTS;
export const SELECTED_PROJECT_STORAGE_KEY = KEY_PERSONAL_SELECTED_PROJECT_ID;
export const DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY = KEY_PERSONAL_DASHBOARD_PROJECT_IDS;

export function loadProjectsFromStorage(fallback: ProjectEntry[]): ProjectEntry[] {
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ProjectEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    // Always keep canonical (fallback) projects using their latest config.
    // Any user-added projects not in the fallback are appended as extras.
    const fallbackIds = new Set(fallback.map((p) => p.id));
    const extras = parsed.filter((p) => !fallbackIds.has(p.id));
    return [...fallback, ...extras];
  } catch {
    return fallback;
  }
}

export function loadDashboardProjectIds(projects: ProjectEntry[]): string[] {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY);
    if (!raw) return projects[0] ? [projects[0].id] : [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return projects[0] ? [projects[0].id] : [];
    const valid = parsed.filter((id) => projects.some((p) => p.id === id));
    return valid.length > 0 ? valid : projects[0] ? [projects[0].id] : [];
  } catch {
    return projects[0] ? [projects[0].id] : [];
  }
}

export function pickInitialProjectId(projects: ProjectEntry[], preferredId?: string): string {
  if (preferredId && projects.some((p) => p.id === preferredId)) return preferredId;
  try {
    const stored = window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
    if (stored && projects.some((p) => p.id === stored)) return stored;
  } catch {}
  return projects[0]?.id ?? '';
}
