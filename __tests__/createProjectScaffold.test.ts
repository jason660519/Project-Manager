import { describe, expect, it } from 'vitest';
import {
  buildRecoveredProjectConfig,
  buildOverwriteScaffold,
  buildProjectScaffold,
  defaultFeaturePaths,
  defaultFeatureSpecPath,
  hasRecoverableDashboardArtifacts,
  mergeProjectConfig,
} from '../lib/storage/createProjectScaffold';
import { CURRENT_SCHEMA_VERSION } from '../lib/storage/migrate';

describe('buildProjectScaffold', () => {
  it('returns latest-schema config with empty features and default roles', () => {
    const cfg = buildProjectScaffold('/Volumes/dev/MyApp');
    expect(cfg.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(cfg.project.root).toBe('/Volumes/dev/MyApp');
    expect(cfg.project.name).toBe('MyApp');
    expect(cfg.features).toEqual([]);
    expect(cfg.engineerRoles?.length).toBeGreaterThan(0);
    expect(cfg.id).toBeTruthy();
  });

  it('defaults simple scaffolds to the software desktop progress sheet', () => {
    const cfg = buildProjectScaffold('/Volumes/dev/MyApp');

    expect(cfg.progressSheets).toEqual([
      expect.objectContaining({
        id: 'software-desktop-app',
        label: 'Desktop App Development Progress',
        discipline: 'software',
        configPath: '.project-manager/progress-sheets/software-desktop-app/config.json',
        templateId: 'software-desktop-app',
        templateVersion: 3,
        active: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    ]);
  });

  it('builds manifest refs for selected built-in progress sheet templates', () => {
    const cfg = buildProjectScaffold('/Volumes/dev/MyApp', {
      progressSheetTemplateIds: ['hardware-rd', 'qa-validation'],
    });

    expect(cfg.progressSheets).toEqual([
      expect.objectContaining({
        id: 'hardware-rd',
        label: 'Hardware R&D Progress',
        discipline: 'hardware-rd',
        configPath: '.project-manager/progress-sheets/hardware-rd/config.json',
        templateId: 'hardware-rd',
        templateVersion: 1,
        active: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
      expect.objectContaining({
        id: 'qa-validation',
        label: 'QA Validation Progress',
        discipline: 'qa-validation',
        configPath: '.project-manager/progress-sheets/qa-validation/config.json',
        templateId: 'qa-validation',
        templateVersion: 1,
        active: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    ]);
  });

  it('rejects empty duplicate and unknown progress sheet template selections', () => {
    expect(() =>
      buildProjectScaffold('/Volumes/dev/MyApp', { progressSheetTemplateIds: [] }),
    ).toThrow(/At least one progress sheet template/);
    expect(() =>
      buildProjectScaffold('/Volumes/dev/MyApp', {
        progressSheetTemplateIds: ['hardware-rd', 'hardware-rd'],
      }),
    ).toThrow(/Duplicate progress sheet template/);
    expect(() =>
      buildProjectScaffold('/Volumes/dev/MyApp', {
        progressSheetTemplateIds: ['unknown-template'],
      }),
    ).toThrow(/Unknown progress sheet template/);
  });
});

describe('defaultFeaturePaths', () => {
  it('points feature docs and dev logs at the consolidated dashboard dirs', () => {
    expect(defaultFeatureSpecPath('F01', 'Login Flow')).toBe(
      '.project-manager/features/F01/feature-spec.md',
    );
    expect(defaultFeaturePaths('F01', 'Login Flow')).toEqual({
      featureFolder: '.project-manager/features/F01/',
      spec: '.project-manager/features/F01/feature-spec.md',
      developmentLogSummaryFolder: '.project-manager/dev-logs/',
    });
  });
});

describe('dashboard artifact recovery', () => {
  it('detects existing feature readmes as recoverable dashboard artifacts', () => {
    expect(
      hasRecoverableDashboardArtifacts({
        featureReadmes: [
          {
            featureId: 'F01',
            relativePath: '.project-manager/features/F01/README.md',
            content: '# F01 — Sidebar Navigation',
          },
        ],
        relativePaths: [],
      }),
    ).toBe(true);
  });

  it('rebuilds config deterministically from existing feature README metadata', () => {
    const cfg = buildRecoveredProjectConfig('/repo/Project-Manager', {
      featureReadmes: [
        {
          featureId: 'F01',
          relativePath: '.project-manager/features/F01/README.md',
          content: [
            '# F01 — Sidebar Navigation',
            '',
            '**Status**: done | **Progress**: 100%',
            '**Category**: Frontend/UI',
            '**Implementation**: `app/ui/Sidebar.tsx`',
          ].join('\n'),
          updatedAt: '2026-05-19T09:48:51.000Z',
        },
        {
          featureId: 'F11',
          relativePath: '.project-manager/features/F11/README.md',
          content: [
            '# F11 — i18n: Multilingual Contributor Guide',
            '',
            '**Status**: in_progress | **Progress**: 40%',
            '**Category**: Documentation/i18n',
            '**Implementation**: `lib/i18n/`',
          ].join('\n'),
          updatedAt: '2026-05-19T10:24:47.000Z',
        },
      ],
      relativePaths: [
        '.project-manager/features/F11/feature-spec.md',
        '.project-manager/features/F11/tdd-spec.md',
        '.project-manager/features/F11/debug-retro.md',
        '.project-manager/features/F11/test-scenarios.md',
        '.project-manager/features/F11/dev-log.md',
      ],
    });

    expect(cfg.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(cfg.project).toMatchObject({
      name: 'Project-Manager',
      root: '/repo/Project-Manager',
      defaultIDE: 'Cursor',
    });
    expect(cfg.features.map((f) => f.id)).toEqual(['F01', 'F11']);
    expect(cfg.features[0]).toMatchObject({
      id: 'F01',
      name: 'Sidebar Navigation',
      status: 'done',
      progress: 100,
      category: 'Frontend/UI',
      readmePath: '.project-manager/features/F01/README.md',
      paths: {
        featureFolder: '.project-manager/features/F01/',
        implementation: 'app/ui/Sidebar.tsx',
      },
    });
    expect(cfg.features[1]).toMatchObject({
      id: 'F11',
      name: 'i18n: Multilingual Contributor Guide',
      status: 'in_progress',
      progress: 40,
      category: 'Documentation/i18n',
      paths: {
        featureFolder: '.project-manager/features/F11/',
        implementation: 'lib/i18n/',
        spec: '.project-manager/features/F11/feature-spec.md',
        tdd: '.project-manager/features/F11/tdd-spec.md',
        debugRetro: '.project-manager/features/F11/debug-retro.md',
        testScenarios: '.project-manager/features/F11/test-scenarios.md',
        developmentLogSummaryFolder: '.project-manager/features/F11/',
      },
    });
  });

  it('applies selected progress sheet templates when rebuilding from feature README metadata', () => {
    const cfg = buildRecoveredProjectConfig('/repo/Project-Manager', {
      featureReadmes: [
        {
          featureId: 'F01',
          relativePath: '.project-manager/features/F01/README.md',
          content: [
            '# F01 — Sidebar Navigation',
            '',
            '**Status**: done | **Progress**: 100%',
            '**Category**: Frontend/UI',
          ].join('\n'),
        },
      ],
      relativePaths: [],
    }, {
      progressSheetTemplateIds: ['hardware-rd', 'qa-validation'],
    });

    expect(cfg.progressSheets?.map((sheet) => sheet.id)).toEqual(['hardware-rd', 'qa-validation']);
    expect(cfg.progressSheets?.[0]).toMatchObject({
      id: 'hardware-rd',
      active: true,
    });
    expect(cfg.progressSheets?.[1]).toMatchObject({
      id: 'qa-validation',
      active: false,
    });
  });
});

describe('mergeProjectConfig', () => {
  it('keeps disk features and merges missing engineer roles', () => {
    const existing = buildProjectScaffold('/app');
    existing.features = [
      {
        id: 'X1',
        name: 'Legacy',
        category: 'Core',
        status: 'done',
        progress: 100,
        paths: { spec: 'docs/features/x.md' },
      },
    ];
    existing.engineerRoles = [];

    const scaffold = buildProjectScaffold('/app');
    const merged = mergeProjectConfig(existing, scaffold);

    expect(merged.features).toHaveLength(1);
    expect(merged.features[0].id).toBe('X1');
    expect(merged.engineerRoles?.length).toBeGreaterThan(0);
  });

  it('preserves existing progress sheet refs and adds selected scaffold sheets during merge', () => {
    const existing = buildProjectScaffold('/app', {
      progressSheetTemplateIds: ['hardware-rd'],
    });
    const scaffold = buildProjectScaffold('/app', {
      progressSheetTemplateIds: ['software-desktop-app', 'qa-validation'],
    });

    const merged = mergeProjectConfig(existing, scaffold);

    expect(merged.progressSheets?.map((sheet) => sheet.id)).toEqual([
      'hardware-rd',
      'software-desktop-app',
      'qa-validation',
    ]);
    expect(merged.progressSheets?.[0]).toMatchObject({
      templateId: 'hardware-rd',
      active: true,
    });
    expect(merged.progressSheets?.[1]).toMatchObject({
      templateId: 'software-desktop-app',
      active: false,
    });
    expect(merged.progressSheets?.[2]).toMatchObject({
      templateId: 'qa-validation',
      active: false,
    });
  });
});

describe('buildOverwriteScaffold', () => {
  it('preserves display name when overwriting', () => {
    const cfg = buildOverwriteScaffold('/app', 'Kept Name');
    expect(cfg.project.name).toBe('Kept Name');
    expect(cfg.features).toEqual([]);
  });
});
