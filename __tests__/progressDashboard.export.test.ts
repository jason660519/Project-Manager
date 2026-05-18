import { describe, expect, it } from 'vitest';
import type { Feature, ProjectConfig } from '../lib/types';
import type { CustomProjectProgressRow } from '../app/project-progress-dashboard/types';
import {
  buildProgressSnapshot,
  snapshotToJSON,
} from '../app/project-progress-dashboard/_lib/exportProgress';

const project: ProjectConfig = {
  name: 'Demo',
  root: '/tmp/demo',
  defaultIDE: 'Trae',
};

const feat = (overrides: Partial<Feature>): Feature => ({
  id: overrides.id ?? 'F',
  name: 'feat',
  category: 'cat',
  status: 'todo',
  progress: 0,
  paths: {},
  ...overrides,
});

const custom = (overrides: Partial<CustomProjectProgressRow>): CustomProjectProgressRow => ({
  rowId: overrides.rowId ?? 'C-1',
  name: 'custom',
  category: 'Custom',
  percentage: 0,
  phase: 'development',
  ...overrides,
});

const emptyCustomRows = { development: [], e2e_testing: [], deployment: [], operations: [] };

describe('buildProgressSnapshot', () => {
  it('includes every phase even when there are no features for it', () => {
    const snap = buildProgressSnapshot(project, [], emptyCustomRows);
    expect(snap.development.rows).toEqual([]);
    expect(snap.e2e_testing.rows).toEqual([]);
    expect(snap.deployment.rows).toEqual([]);
    expect(snap.operations.rows).toEqual([]);
    expect(snap.project).toEqual({ name: 'Demo', root: '/tmp/demo' });
  });

  it('puts each feature into its declared phase and computes aggregates per phase', () => {
    const features: Feature[] = [
      feat({ id: 'F01', phase: 'development', progress: 100, points: 2 }),
      feat({ id: 'F02', phase: 'e2e_testing', testCoverage: 75, testStatus: 'passed' }),
      feat({ id: 'F03', phase: 'deployment', deployStatus: 'production', deployDate: '2026-05-10' }),
      feat({ id: 'F04', phase: 'operations', uptimePercent: 99.9, errorRate: 0.05, lastIncident: '2026-04-30' }),
    ];
    const snap = buildProgressSnapshot(project, features, emptyCustomRows);

    expect(snap.development.rows).toHaveLength(1);
    expect(snap.development.overallProgress).toBe(100);
    expect(snap.e2e_testing.avgCoverage).toBe(75);
    expect(snap.deployment.productionCount).toBe(1);
    expect(snap.deployment.latestDeploy).toBe('2026-05-10');
    expect(snap.operations.incidentCount).toBe(1);
  });

  it('counts custom rows in the matching phase so the snapshot mirrors what the user sees', () => {
    const snap = buildProgressSnapshot(
      project,
      [feat({ id: 'F01', phase: 'development', progress: 50 })],
      { ...emptyCustomRows, development: [custom({ rowId: 'C-dev', phase: 'development', percentage: 100 })] },
    );
    expect(snap.development.rows).toHaveLength(2);
    // Average of (50 + 100) / 2 weighted by 1 SP each = 75.
    expect(snap.development.overallProgress).toBe(75);
  });
});

describe('snapshotToJSON', () => {
  it('serializes a snapshot as pretty JSON that round-trips through JSON.parse', () => {
    const snap = buildProgressSnapshot(project, [], emptyCustomRows);
    const json = snapshotToJSON(snap);
    expect(json).toContain('"project"');
    const parsed = JSON.parse(json);
    expect(parsed.project.name).toBe('Demo');
    expect(Array.isArray(parsed.development.rows)).toBe(true);
  });
});
