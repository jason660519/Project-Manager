import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from '../lib/storage/migrate';

describe('migrateConfig v2 → v3 → v4', () => {
  it('exposes 4 as the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
  });

  it('bumps schemaVersion to 4 on a v2 document', () => {
    const v2 = {
      schemaVersion: 2,
      id: 'aaa',
      project: { name: 'P', root: '/r', defaultIDE: 'Trae' },
      features: [{ id: 'F01', name: 'f', category: 'c', status: 'todo', progress: 0, paths: {} }],
      adapters: { ides: [], agents: [] },
    };
    const out = migrateConfig(v2);
    expect(out.schemaVersion).toBe(4);
  });

  it('defaults every feature to phase=development and points=1 when missing', () => {
    const out = migrateConfig({
      schemaVersion: 2,
      id: 'x',
      project: { name: 'P', root: '/r', defaultIDE: 'Trae' },
      features: [
        { id: 'F01', name: 'f', category: 'c', status: 'todo', progress: 0, paths: {} },
        { id: 'F02', name: 'f', category: 'c', status: 'todo', progress: 0, paths: {}, phase: 'testing' as const },
        { id: 'F03', name: 'f', category: 'c', status: 'todo', progress: 0, paths: {}, points: 5 },
      ],
      adapters: { ides: [], agents: [] },
    });
    expect(out.features[0].phase).toBe('development');
    expect(out.features[0].points).toBe(1);
    expect(out.features[1].phase).toBe('e2e_testing');   // v4 renames legacy testing phase
    expect(out.features[2].points).toBe(5);            // existing value preserved
  });

  it('coerces a non-positive points value back to 1 — guards against junk data', () => {
    const out = migrateConfig({
      schemaVersion: 2,
      id: 'x',
      project: { name: 'P', root: '/r', defaultIDE: 'Trae' },
      features: [
        { id: 'A', name: 'a', category: 'c', status: 'todo', progress: 0, paths: {}, points: 0 },
        { id: 'B', name: 'b', category: 'c', status: 'todo', progress: 0, paths: {}, points: -3 },
      ],
      adapters: { ides: [], agents: [] },
    });
    expect(out.features[0].points).toBe(1);
    expect(out.features[1].points).toBe(1);
  });

  it('chains v1 → v2 → v3 → v4: a fresh v1 document still ends with phase + points populated', () => {
    const out = migrateConfig({
      // no schemaVersion — treated as v1
      project: { name: 'P', root: '/r', defaultIDE: 'Trae' },
      features: [{ id: 'F01', name: 'f', category: 'c', status: 'todo', progress: 0, paths: {} }],
      adapters: { ides: [], agents: [] },
    });
    expect(out.schemaVersion).toBe(4);
    expect(out.features[0].phase).toBe('development');
    expect(out.features[0].points).toBe(1);
    // v2 sync fields were also added during the v1 → v2 step.
    expect(typeof out.id).toBe('string');
    expect(typeof out.features[0].createdAt).toBe('string');
  });

  it('is idempotent — running a fully migrated document through the pipeline does not change it', () => {
    const v3 = migrateConfig({
      schemaVersion: 2,
      id: 'x',
      project: { name: 'P', root: '/r', defaultIDE: 'Trae' },
      features: [{ id: 'F01', name: 'f', category: 'c', status: 'todo', progress: 0, paths: {} }],
      adapters: { ides: [], agents: [] },
    });
    const v3Again = migrateConfig(v3);
    expect(v3Again).toEqual(v3);
  });
});
