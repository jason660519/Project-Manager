import { describe, expect, it } from 'vitest';
import { getProjectSetupStatus, projectNeedsScan } from '../lib/projectSetup';
import type { ProjectEntry } from '../lib/types';

function entry(partial: Partial<ProjectEntry>): ProjectEntry {
  return {
    id: 'p1',
    configPath: '/foo/.project-manager.json',
    config: {
      schemaVersion: 4,
      id: 'id',
      project: { name: 'Foo', root: '/foo', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    },
    ...partial,
  };
}

describe('projectSetup', () => {
  it('marks configMissing as needs_scan', () => {
    expect(getProjectSetupStatus(entry({ configMissing: true }))).toBe('needs_scan');
    expect(projectNeedsScan(entry({ configMissing: true }))).toBe(true);
  });

  it('marks empty features as scaffold', () => {
    expect(getProjectSetupStatus(entry({}))).toBe('scaffold');
    expect(projectNeedsScan(entry({}))).toBe(true);
  });

  it('marks projects with features as ready', () => {
    const ready = entry({
      config: {
        schemaVersion: 4,
        id: 'id',
        project: { name: 'Foo', root: '/foo', defaultIDE: 'Cursor' },
        features: [
          {
            id: 'F1',
            name: 'A',
            category: 'X',
            status: 'todo',
            progress: 0,
            paths: {},
          },
        ],
        adapters: { ides: [], agents: [] },
      },
    });
    expect(getProjectSetupStatus(ready)).toBe('ready');
    expect(projectNeedsScan(ready)).toBe(false);
  });
});
