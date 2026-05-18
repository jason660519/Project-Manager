import { describe, expect, it } from 'vitest';
import {
  buildOverwriteScaffold,
  buildProjectScaffold,
  defaultFeaturePaths,
  defaultFeatureSpecPath,
  mergeProjectConfig,
} from '../lib/storage/createProjectScaffold';

describe('buildProjectScaffold', () => {
  it('returns schema v3 config with empty features and default roles', () => {
    const cfg = buildProjectScaffold('/Volumes/dev/MyApp');
    expect(cfg.schemaVersion).toBe(3);
    expect(cfg.project.root).toBe('/Volumes/dev/MyApp');
    expect(cfg.project.name).toBe('MyApp');
    expect(cfg.features).toEqual([]);
    expect(cfg.engineerRoles?.length).toBeGreaterThan(0);
    expect(cfg.id).toBeTruthy();
  });
});

describe('defaultFeaturePaths', () => {
  it('points spec and dev log folder at scaffold dirs', () => {
    expect(defaultFeatureSpecPath('F01', 'Login Flow')).toBe('docs/features/F01-login-flow.md');
    expect(defaultFeaturePaths('F01', 'Login Flow')).toEqual({
      spec: 'docs/features/F01-login-flow.md',
      developmentLogSummaryFolder: 'docs/dev-logs/',
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
});

describe('buildOverwriteScaffold', () => {
  it('preserves display name when overwriting', () => {
    const cfg = buildOverwriteScaffold('/app', 'Kept Name');
    expect(cfg.project.name).toBe('Kept Name');
    expect(cfg.features).toEqual([]);
  });
});
