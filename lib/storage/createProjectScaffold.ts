import { DEFAULT_ENGINEER_ROLES } from '../defaults/engineerRoles';
import type { Feature, IDEId, ProjectManagerConfig } from '../types';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from './migrate';
import { mergeEngineerRolesById } from './mergeEngineerRoles';

/** Relative directories created on every project initialize. */
export const SCAFFOLD_DOC_DIRS = ['docs/features', 'docs/dev-logs'] as const;

export const DEFAULT_DEV_LOG_FOLDER = 'docs/dev-logs/';

export type InitializeMode = 'create' | 'merge' | 'overwrite';

export interface InitializeProjectOptions {
  /** Folder name used when `projectRoot` has no trailing segment. */
  projectName?: string;
  defaultIDE?: IDEId;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'feature';
}

/** Default feature spec path under `docs/features/`. */
export function defaultFeatureSpecPath(featureId: string, featureName: string): string {
  return `docs/features/${featureId}-${slugify(featureName)}.md`;
}

/** Default paths block for a new feature row. */
export function defaultFeaturePaths(featureId: string, featureName: string) {
  return {
    spec: defaultFeatureSpecPath(featureId, featureName),
    developmentLogSummaryFolder: DEFAULT_DEV_LOG_FOLDER,
  };
}

/** Fill missing spec / dev-log paths without clobbering user-set values. */
export function ensureFeaturePaths(features: Feature[]): Feature[] {
  return features.map((f) => ({
    ...f,
    paths: {
      ...defaultFeaturePaths(f.id, f.name),
      ...f.paths,
    },
  }));
}

function inferProjectName(projectRoot: string, override?: string): string {
  if (override?.trim()) return override.trim();
  const trimmed = projectRoot.replace(/\/+$/, '');
  const segment = trimmed.split('/').pop();
  return segment || 'Project';
}

/**
 * Build a minimal schema-v3 config for a new local project.
 * Does not touch disk — callers write via `initializeProject` bridge.
 */
export function buildProjectScaffold(
  projectRoot: string,
  options: InitializeProjectOptions = {},
): ProjectManagerConfig {
  const root = projectRoot.replace(/\/+$/, '');
  const now = new Date().toISOString();
  const raw = {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: 'project-manager',
    project: {
      name: inferProjectName(root, options.projectName),
      root,
      defaultIDE: options.defaultIDE ?? 'Cursor',
    },
    features: [] as Feature[],
    engineerRoles: DEFAULT_ENGINEER_ROLES,
    adapters: { ides: [], agents: [] },
  };
  return migrateConfig(raw);
}

/**
 * Merge an on-disk config with a fresh scaffold:
 * - structural feature fields from disk win; PM edits (status/progress/notes) overlay
 * - engineer roles: union by id with defaults filling gaps
 * - adapters: keep disk when non-empty, else scaffold
 * - project metadata: disk name/root win when present
 */
export function mergeProjectConfig(
  existing: ProjectManagerConfig,
  scaffold: ProjectManagerConfig,
): ProjectManagerConfig {
  const next = migrateConfig({
    ...scaffold,
    ...existing,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: {
      ...scaffold.project,
      ...existing.project,
      root: existing.project.root || scaffold.project.root,
      name: existing.project.name || scaffold.project.name,
      defaultIDE: existing.project.defaultIDE || scaffold.project.defaultIDE,
    },
    features: ensureFeaturePaths(existing.features ?? []),
    engineerRoles: mergeEngineerRolesById(existing.engineerRoles, scaffold.engineerRoles),
    adapters: {
      ides:
        (existing.adapters?.ides?.length ?? 0) > 0
          ? existing.adapters!.ides
          : scaffold.adapters.ides,
      agents:
        (existing.adapters?.agents?.length ?? 0) > 0
          ? existing.adapters!.agents
          : scaffold.adapters.agents,
    },
  });
  return migrateConfig(next);
}

/** Fresh scaffold for overwrite — preserves project display name when provided. */
export function buildOverwriteScaffold(
  projectRoot: string,
  preserveName?: string,
  options: InitializeProjectOptions = {},
): ProjectManagerConfig {
  const scaffold = buildProjectScaffold(projectRoot, options);
  if (preserveName?.trim()) {
    return { ...scaffold, project: { ...scaffold.project, name: preserveName.trim() } };
  }
  return scaffold;
}
