import type { ProjectEntry, ProjectManagerConfig } from '../types';
import { mergeFeaturesById } from './mergeFeatures';
import { resolveConfigPath } from './resolveConfigPath';

interface NormalizedProjectEntries {
  projects: ProjectEntry[];
  idMap: Map<string, string>;
}

function isGithubConfigPath(path: string): boolean {
  return path.startsWith('https://github.com/');
}

function normalizeConfigPath(path: string): string {
  return isGithubConfigPath(path) ? path : resolveConfigPath(path);
}

function entryScore(entry: ProjectEntry): number {
  const featureScore = entry.config.features.length;
  const readyScore = entry.configMissing ? 0 : 1_000;
  const canonicalScore = entry.configPath === normalizeConfigPath(entry.configPath) ? 100 : 0;
  return readyScore + canonicalScore + featureScore;
}

function pickAuthoritativeEntry(a: ProjectEntry, b: ProjectEntry): ProjectEntry {
  return entryScore(b) > entryScore(a) ? b : a;
}

function mergeConfig(base: ProjectManagerConfig, local: ProjectManagerConfig): ProjectManagerConfig {
  return {
    ...base,
    features: mergeFeaturesById(base.features, local.features),
    project: {
      ...base.project,
      root: base.project.root || local.project.root,
      githubUrl: base.project.githubUrl ?? local.project.githubUrl,
    },
    engineerRoles: base.engineerRoles ?? local.engineerRoles,
    cronJobs: base.cronJobs ?? local.cronJobs,
  };
}

function mergeDuplicateProjectEntry(existing: ProjectEntry, incoming: ProjectEntry): ProjectEntry {
  const authoritative = pickAuthoritativeEntry(existing, incoming);
  const local = authoritative === existing ? incoming : existing;
  return {
    ...authoritative,
    id: existing.id,
    configPath: normalizeConfigPath(authoritative.configPath),
    config: mergeConfig(authoritative.config, local.config),
    configMissing: existing.configMissing && incoming.configMissing,
    lastSyncedAt: authoritative.lastSyncedAt ?? local.lastSyncedAt,
  };
}

/**
 * Canonicalize persisted project entries after the ADR-008 layout move and
 * registry sync. Older localStorage snapshots may still contain
 * `<root>/.project-manager.json` while the registry contributes the same repo
 * as `<root>/.project-manager/config.json`; those must be one dashboard
 * project, not two selectable rows.
 */
export function normalizeProjectEntries(entries: ProjectEntry[]): NormalizedProjectEntries {
  const byConfigPath = new Map<string, ProjectEntry>();
  const idMap = new Map<string, string>();

  for (const entry of entries) {
    const normalizedPath = normalizeConfigPath(entry.configPath);
    const normalizedEntry = { ...entry, configPath: normalizedPath };
    const existing = byConfigPath.get(normalizedPath);

    if (!existing) {
      byConfigPath.set(normalizedPath, normalizedEntry);
      idMap.set(entry.id, normalizedEntry.id);
      continue;
    }

    const merged = mergeDuplicateProjectEntry(existing, normalizedEntry);
    byConfigPath.set(normalizedPath, merged);
    idMap.set(existing.id, merged.id);
    idMap.set(entry.id, merged.id);
  }

  return {
    projects: Array.from(byConfigPath.values()),
    idMap,
  };
}

export function remapProjectIds(ids: string[] | null, idMap: Map<string, string>): string[] | null {
  if (!ids) return null;
  return Array.from(new Set(ids.map((id) => idMap.get(id) ?? id)));
}
