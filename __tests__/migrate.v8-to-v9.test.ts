import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from '../lib/storage/migrate';

describe('migrate v8 → v9 (F49 feature dependencies)', () => {
  it('exposes 11 as the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(11);
  });

  it('back-fills empty upstreamDependencies on legacy features', () => {
    const out = migrateConfig({
      schemaVersion: 8,
      id: 'project-test',
      project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
      features: [
        { id: 'F35', name: 'Workflow DAG', category: 'Agents', status: 'done', progress: 100, paths: {} },
        { id: 'F49', name: 'Dependency graph', category: 'Dashboard', status: 'todo', progress: 0, paths: {} },
      ],
      adapters: { ides: [], agents: [] },
    });

    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.features[0].upstreamDependencies).toEqual([]);
    expect(out.features[1].upstreamDependencies).toEqual([]);
  });

  it('preserves existing structured upstream dependency refs', () => {
    const out = migrateConfig({
      schemaVersion: 8,
      id: 'project-test',
      project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
      features: [
        {
          id: 'F49',
          name: 'Dependency graph',
          category: 'Dashboard',
          status: 'todo',
          progress: 0,
          paths: {},
          upstreamDependencies: [
            { featureId: 'F35', kind: 'hard', reason: 'Workflow templates provide the dispatch DAG language.' },
            { projectId: 'project-a', featureId: 'F01', kind: 'soft' },
          ],
        },
      ],
      adapters: { ides: [], agents: [] },
    });

    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.features[0].upstreamDependencies).toEqual([
      { featureId: 'F35', kind: 'hard', reason: 'Workflow templates provide the dispatch DAG language.' },
      { projectId: 'project-a', featureId: 'F01', kind: 'soft' },
    ]);
  });

  it('is idempotent on a v9 document', () => {
    const first = migrateConfig({
      schemaVersion: 8,
      id: 'project-test',
      project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
      features: [
        { id: 'F49', name: 'Dependency graph', category: 'Dashboard', status: 'todo', progress: 0, paths: {} },
      ],
      adapters: { ides: [], agents: [] },
    });
    const second = migrateConfig(first);

    expect(second).toEqual(first);
  });
});
