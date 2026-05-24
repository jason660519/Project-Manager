import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from '../lib/storage/migrate';

describe('migrateConfig v2 → v3 → v4 → v5 → v6 → v7', () => {
  it('exposes 7 as the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(7);
  });

  it('bumps schemaVersion to 7 on a v2 document', () => {
    const v2 = {
      schemaVersion: 2,
      id: 'aaa',
      project: { name: 'P', root: '/r', defaultIDE: 'Trae' },
      features: [{ id: 'F01', name: 'f', category: 'c', status: 'todo', progress: 0, paths: {} }],
      adapters: { ides: [], agents: [] },
    };
    const out = migrateConfig(v2);
    expect(out.schemaVersion).toBe(7);
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

  it('moves legacy notes paths into readmePath and restores notes summary when available', () => {
    const out = migrateConfig({
      schemaVersion: 4,
      id: 'x',
      project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
      features: [
        {
          id: 'F01',
          name: 'Feature',
          category: 'Core',
          status: 'todo',
          progress: 0,
          paths: {
            featureFolder: '.project-manager/features/F01/',
            spec: '.project-manager/features/F01/README.md',
          },
          notes: '.project-manager/features/F01/README.md',
          metadata: { notesSummary: 'Short summary' },
        },
        {
          id: 'F02',
          name: 'Other',
          category: 'Core',
          status: 'todo',
          progress: 0,
          paths: { featureFolder: '.project-manager/features/F02/' },
          notes: 'Human note',
        },
        {
          id: 'F03',
          name: 'Spec',
          category: 'Core',
          status: 'todo',
          progress: 0,
          paths: {
            featureFolder: '.project-manager/features/F03/',
            spec: 'docs/features/f03-spec.md',
          },
          notes: 'Spec should stay separate',
        },
      ],
      adapters: { ides: [], agents: [] },
    });

    expect(out.schemaVersion).toBe(7);
    expect(out.features[0].readmePath).toBe('.project-manager/features/F01/README.md');
    expect(out.features[0].notes).toBe('Short summary');
    expect(out.features[0].paths.spec).toBeUndefined();
    expect(out.features[1].readmePath).toBe('.project-manager/features/F02/README.md');
    expect(out.features[1].notes).toBe('Human note');
    expect(out.features[2].readmePath).toBe('.project-manager/features/F03/README.md');
    expect(out.features[2].paths.spec).toBe('docs/features/f03-spec.md');
    expect(out.features[2].notes).toBe('Spec should stay separate');
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
    expect(out.schemaVersion).toBe(7);
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

  it('maps legacy locatedPage into locatedSection during v5 → v6', () => {
    const out = migrateConfig({
      schemaVersion: 5,
      id: 'x',
      project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
      features: [
        {
          id: 'F01',
          name: 'Feature',
          category: 'Core',
          status: 'todo',
          progress: 0,
          paths: {},
          locatedPage: '/dashboard/settings',
        },
      ],
      adapters: { ides: [], agents: [] },
    });

    expect(out.schemaVersion).toBe(7);
    expect(out.features[0].locatedSection).toBe('/dashboard/settings');
    expect((out.features[0] as { locatedPage?: string }).locatedPage).toBeUndefined();
  });
});
