import { describe, expect, it } from 'vitest';
import type { Feature } from '../lib/types';
import type { CustomProjectProgressRow } from '../app/project-progress-dashboard/types';
import {
  buildPhaseRows,
  computePhaseCounts,
  customRowToPhaseRow,
  featureToPhaseRow,
} from '../app/project-progress-dashboard/_lib/phaseRows';
import { isUuid } from '../lib/aiSdks/uuid';

const f = (overrides: Partial<Feature>): Feature => ({
  id: overrides.id ?? 'F',
  name: overrides.name ?? 'feat',
  category: 'cat',
  status: overrides.status ?? 'todo',
  progress: overrides.progress ?? 0,
  paths: {},
  ...overrides,
});

const custom = (overrides: Partial<CustomProjectProgressRow>): CustomProjectProgressRow => ({
  rowId: overrides.rowId ?? 'C-001',
  name: 'custom',
  category: 'Custom',
  percentage: 0,
  phase: overrides.phase ?? 'development',
  ...overrides,
});

describe('featureToPhaseRow', () => {
  it('namespaces the rowKey with feature:: so it cannot collide with a custom rowId', () => {
    const row = featureToPhaseRow(f({ id: 'F01' }));
    expect(row.rowKey).toBe('feature::F01');
    expect(row.source).toBe('feature');
    expect(row.featureId).toBe('F01');
    expect(isUuid(row.uuid)).toBe(true);
    expect(row.id).toBe('F01');
  });

  it('defaults missing points to 1 so aggregations never divide by zero', () => {
    const row = featureToPhaseRow(f({ id: 'F02' }));
    expect(row.points).toBe(1);
  });

  it('clamps progress into [0,100] when feature data is malformed', () => {
    expect(featureToPhaseRow(f({ progress: 9999 })).progress).toBe(100);
    expect(featureToPhaseRow(f({ progress: -10 })).progress).toBe(0);
  });

  it('reads projectName from feature metadata with fallback', () => {
    expect(
      featureToPhaseRow(f({
        metadata: { sourceProjectName: 'Alpha' },
        locatedSection: 'app/page.tsx',
      })).projectName,
    ).toBe('Alpha');
    expect(featureToPhaseRow(f({}), 'Fallback').projectName).toBe('Fallback');
    expect(
      featureToPhaseRow(f({ locatedSection: 'app/page.tsx' })).locatedSection,
    ).toBe('app/page.tsx');
  });
});

describe('customRowToPhaseRow', () => {
  it('namespaces rowKey under custom:: so it does not collide with a feature row', () => {
    const row = customRowToPhaseRow(custom({ rowId: 'X-1' }));
    expect(row.rowKey).toBe('custom::X-1');
    expect(row.source).toBe('custom');
    expect(row.customRowId).toBe('X-1');
    expect(row.feature).toBeUndefined();
    expect(isUuid(row.uuid)).toBe(true);
    expect(row.id).toBe('X-1');
  });
});

describe('buildPhaseRows', () => {
  it('returns only features for the active phase, then appends matching custom rows', () => {
    const features = [
      f({ id: 'F01', phase: 'development' }),
      f({ id: 'F02', phase: 'e2e_testing' }),
      f({ id: 'F03', phase: 'development' }),
    ];
    const customs = [
      custom({ rowId: 'C-dev',  phase: 'development' }),
      custom({ rowId: 'C-test', phase: 'e2e_testing' }),
    ];
    const devRows = buildPhaseRows(features, 'development', customs);

    // Feature rows come first (insertion order), then custom rows.
    expect(devRows.map((r) => r.rowKey)).toEqual([
      'feature::F01',
      'feature::F03',
      'custom::C-dev',
    ]);
  });

  it('treats undefined feature.phase as development — legacy v2 fixture behaviour', () => {
    const rows = buildPhaseRows([f({ id: 'legacy' /* no phase */ })], 'development', []);
    expect(rows).toHaveLength(1);
    expect(rows[0].featureId).toBe('legacy');
  });
});

describe('computePhaseCounts', () => {
  it('sums features and custom rows separately and merges into a per-phase tally', () => {
    const features = [
      f({ id: 'A', phase: 'development' }),
      f({ id: 'B', phase: 'e2e_testing' }),
      f({ id: 'C', phase: 'e2e_testing' }),
    ];
    const counts = computePhaseCounts(features, {
      development: [custom({ rowId: 'c1', phase: 'development' })],
      e2e_testing: [],
      deployment: [custom({ rowId: 'c2', phase: 'deployment' /* phase mismatch on purpose */ })],
      operations: [custom({ rowId: 'c3', phase: 'operations' })],
    });
    expect(counts).toEqual({
      development: 2, // 1 feature + 1 custom
      e2e_testing: 2, // 2 features
      deployment: 1,  // 0 features + 1 custom (caller bucketed it under deployment)
      operations: 1,  // 0 features + 1 custom
    });
  });
});
