import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from '../lib/storage/migrate';
import schema from '../schema/project-manager.schema.json';

describe('migrate v10 -> v11 (F55 progress sheet manifest)', () => {
  const feature = {
    id: 'F55',
    name: 'Multi-discipline progress sheets',
    category: 'Storage',
    status: 'in_progress',
    progress: 42,
    paths: {
      featureFolder: '.project-manager/features/F55/',
      spec: '.project-manager/features/F55/feature-spec.md',
      tdd: '.project-manager/features/F55/tdd-spec.md',
    },
    notes: 'Keep the manifest additive.',
    readmePath: '.project-manager/features/F55/README.md',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-02T11:00:00.000Z',
    phase: 'development',
    points: 3,
    upstreamDependencies: [{ featureId: 'F49', kind: 'hard', reason: 'Dependency graph precedes sheet refs.' }],
    metadata: { owner: 'storage-worker' },
  };

  const baseV10 = {
    schemaVersion: 10,
    id: 'project-f55',
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-03T12:00:00.000Z',
    project: { name: 'Project Manager', root: '/repo/project-manager', defaultIDE: 'Cursor' },
    features: [feature],
    adapters: { ides: [], agents: [] },
  };

  it('exposes 11 as the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(11);
  });

  it('adds one software desktop progress sheet ref while preserving feature fields', () => {
    const out = migrateConfig(baseV10);

    expect(out.schemaVersion).toBe(11);
    expect(out.progressSheets).toEqual([
      {
        id: 'software-desktop-app',
        label: 'Desktop App Development Progress',
        discipline: 'software',
        configPath: '.project-manager/progress-sheets/software-desktop-app/config.json',
        templateId: 'software-desktop-app',
        templateVersion: 1,
        active: true,
        createdAt: baseV10.updatedAt,
        updatedAt: baseV10.updatedAt,
      },
    ]);
    expect(out.features).toEqual([feature]);
  });

  it('defaults v10 projects to local-files backend mode without requiring Supabase', () => {
    const out = migrateConfig(baseV10);

    expect(out.backendProfiles).toEqual([
      {
        mode: 'local-files',
        enabled: false,
        label: 'Local files',
      },
    ]);
    expect(out.activeBackendProfileMode).toBe('local-files');
  });

  it('does not invent hardware marketing or QA sheet refs or fake rows', () => {
    const out = migrateConfig(baseV10);

    expect(out.progressSheets?.map((sheet) => sheet.id)).toEqual(['software-desktop-app']);
    expect(JSON.stringify(out)).not.toContain('hardware-rd');
    expect(JSON.stringify(out)).not.toContain('marketing-campaign');
    expect(JSON.stringify(out)).not.toContain('qa-validation');
    expect(JSON.stringify(out)).not.toContain('"rows"');
  });

  it('is idempotent on v11 configs with existing progress sheet refs', () => {
    const once = migrateConfig(baseV10);
    const twice = migrateConfig(once);

    expect(twice).toEqual(once);
  });
});

describe('project manager schema v11 progress sheet and backend profile contracts', () => {
  const definitions = schema.definitions as Record<string, any>;

  it('rejects renderer-secret fields on every backend profile variant', () => {
    const variants = definitions.backendProfile.oneOf as Array<Record<string, unknown>>;

    expect(variants).toHaveLength(4);
    for (const variant of variants) {
      expect(variant).toMatchObject({ additionalProperties: false });
      expect(Object.keys((variant as any).properties)).not.toContain('serviceRoleKey');
      expect(Object.keys((variant as any).properties)).not.toContain('jwtSecret');
      expect(Object.keys((variant as any).properties)).not.toContain('databasePassword');
    }
  });

  it('bounds progress sheet refs to project-local progress sheet config paths', () => {
    const sheetRef = definitions.projectProgressSheetRef;

    expect(sheetRef).toMatchObject({ additionalProperties: false });
    expect(sheetRef.properties.id).toMatchObject({
      minLength: 1,
      pattern: '^[A-Za-z0-9][A-Za-z0-9_-]*$',
    });
    expect(sheetRef.properties.configPath).toMatchObject({
      pattern: '^\\.project-manager/progress-sheets/[A-Za-z0-9][A-Za-z0-9_-]*/config\\.json$',
    });
  });
});
