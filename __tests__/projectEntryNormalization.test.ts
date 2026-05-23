import { describe, expect, it } from 'vitest';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';
import { normalizeProjectEntries, remapProjectIds } from '../lib/storage';

function feature(id: string, phase?: Feature['phase']): Feature {
  return {
    id,
    name: `Feature ${id}`,
    category: 'Test',
    status: 'todo',
    progress: 0,
    paths: {},
    ...(phase ? { phase } : {}),
  };
}

function config(name: string, features: Feature[]): ProjectManagerConfig {
  return {
    schemaVersion: 6,
    id: `${name}-doc`,
    project: {
      name,
      root: `/repo/${name}`,
      defaultIDE: 'Cursor',
    },
    features,
    adapters: { ides: [], agents: [] },
  };
}

function entry(overrides: Partial<ProjectEntry> & Pick<ProjectEntry, 'id' | 'configPath'>): ProjectEntry {
  return {
    config: config(overrides.id, []),
    ...overrides,
  };
}

describe('normalizeProjectEntries', () => {
  it('dedupes legacy and canonical config paths while preserving the stable first id', () => {
    const legacy = entry({
      id: 'project-manager',
      configPath: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager.json',
      config: config('Project Manager', [feature('F01')]),
    });
    const canonical = entry({
      id: 'proj-registry',
      configPath: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/config.json',
      config: config('Project Manager', [feature('F01'), feature('F13', 'deployment')]),
    });

    const result = normalizeProjectEntries([legacy, canonical]);

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].id).toBe('project-manager');
    expect(result.projects[0].configPath).toBe(
      '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/config.json',
    );
    expect(result.projects[0].config.features.map((f) => f.id)).toEqual(['F01', 'F13']);
    expect(result.idMap.get('proj-registry')).toBe('project-manager');
  });

  it('keeps GitHub projects untouched and remaps dashboard selections once', () => {
    const local = entry({
      id: 'local',
      configPath: '/repo/app/.project-manager.json',
    });
    const github = entry({
      id: 'github',
      configPath: 'https://github.com/acme/app',
    });

    const result = normalizeProjectEntries([local, github]);

    expect(result.projects.map((p) => p.configPath)).toEqual([
      '/repo/app/.project-manager/config.json',
      'https://github.com/acme/app',
    ]);
    expect(remapProjectIds(['local', 'local', 'github'], result.idMap)).toEqual(['local', 'github']);
  });
});
