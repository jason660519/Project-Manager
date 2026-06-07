import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from '../lib/storage/migrate';

// ADR-017: v9 → v10 adds optional `browserAccess` / `externalFileAccess` to
// engineer roles. Both are optional with "no access" defaults when absent, so
// the migration is a pure version bump — no row rewriting — and idempotent.
describe('migrate v9 → v10 (ADR-017 engineer access policies)', () => {
  const baseV9 = {
    schemaVersion: 9,
    id: 'project-test',
    project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
    features: [
      { id: 'F1', name: 'Feature one', category: 'X', status: 'todo', progress: 0, paths: {}, upstreamDependencies: [] },
    ],
    adapters: { ides: [], agents: [] },
    engineerRoles: [
      { id: 'r1', name: 'Backend', slug: 'backend', skills: [], commands: [], systemPrompt: '', referenceFiles: [] },
    ],
  };

  it('exposes 10 as the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(10);
  });

  it('bumps a v9 config to v10 without rewriting rows', () => {
    const out = migrateConfig(baseV9);
    expect(out.schemaVersion).toBe(10);
    expect(out.engineerRoles).toHaveLength(1);
    expect(out.engineerRoles?.[0].id).toBe('r1');
    // No access fields are invented — absent stays absent (= no access).
    expect(out.engineerRoles?.[0].browserAccess).toBeUndefined();
    expect(out.engineerRoles?.[0].externalFileAccess).toBeUndefined();
    expect(out.features[0].upstreamDependencies).toEqual([]);
  });

  it('preserves already-configured browserAccess / externalFileAccess on v10 roles', () => {
    const out = migrateConfig({
      ...baseV9,
      schemaVersion: 10,
      engineerRoles: [
        {
          id: 'r1',
          name: 'Backend',
          slug: 'backend',
          skills: [],
          commands: [],
          systemPrompt: '',
          referenceFiles: [],
          browserAccess: { enabled: true, allowedBrowserIds: ['com.apple.Safari'] },
          externalFileAccess: {
            entries: [{ path: '/ext/docs', kind: 'local-dir', permission: 'read' }],
            requireConfirmForUnlisted: false,
          },
        },
      ],
    });
    expect(out.schemaVersion).toBe(10);
    expect(out.engineerRoles?.[0].browserAccess).toEqual({
      enabled: true,
      allowedBrowserIds: ['com.apple.Safari'],
    });
    expect(out.engineerRoles?.[0].externalFileAccess?.entries).toHaveLength(1);
  });

  it('is idempotent — re-running on a v10 config returns it unchanged', () => {
    const once = migrateConfig(baseV9);
    const twice = migrateConfig(once);
    expect(twice).toEqual(once);
  });

  it('migrates a legacy v1 config all the way to v10', () => {
    const out = migrateConfig({
      project: { name: 'Legacy', root: '/legacy', defaultIDE: 'Cursor' },
      features: [],
    });
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
