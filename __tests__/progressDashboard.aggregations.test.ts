import { describe, expect, it } from 'vitest';
import type { Feature } from '../lib/types';
import {
  computeDevelopmentStats,
  computeTestingStats,
  computeDeploymentStats,
  computeOperationsStats,
  summarizeStatuses,
} from '../app/project-progress-dashboard/_lib/aggregations';

const baseFeature = (overrides: Partial<Feature>): Feature => ({
  id: overrides.id ?? 'F',
  name: 'feat',
  category: 'cat',
  status: overrides.status ?? 'todo',
  progress: overrides.progress ?? 0,
  paths: {},
  ...overrides,
});

describe('computeDevelopmentStats', () => {
  it('weighs progress by story points', () => {
    // A 4-point feature at 100% should pull the average up much more than a 1-point feature at 0%.
    const stats = computeDevelopmentStats([
      baseFeature({ id: 'A', progress: 100, points: 4 }),
      baseFeature({ id: 'B', progress: 0,   points: 1 }),
    ]);
    expect(stats.overallProgress).toBe(80); // (4*100 + 1*0) / 5
    expect(stats.totalPoints).toBe(5);
  });

  it('treats missing points as 1', () => {
    const stats = computeDevelopmentStats([
      baseFeature({ id: 'A', progress: 100 }),
      baseFeature({ id: 'B', progress: 0 }),
    ]);
    expect(stats.totalPoints).toBe(2);
    expect(stats.overallProgress).toBe(50);
  });

  it('buckets completed / in-progress / pending by progress percent', () => {
    const stats = computeDevelopmentStats([
      baseFeature({ id: 'a', progress: 100 }),
      baseFeature({ id: 'b', progress: 50 }),
      baseFeature({ id: 'c', progress: 0 }),
    ]);
    expect(stats.completedCount).toBe(1);
    expect(stats.inProgressCount).toBe(1);
    expect(stats.pendingCount).toBe(1);
  });

  it('returns zeros for an empty list without dividing by zero', () => {
    const stats = computeDevelopmentStats([]);
    expect(stats.totalFeatures).toBe(0);
    expect(stats.overallProgress).toBe(0);
    expect(stats.totalPoints).toBe(0);
  });

  it('clamps out-of-range progress so a buggy import does not skew the average', () => {
    const stats = computeDevelopmentStats([
      baseFeature({ id: 'over',  progress: 200 }),
      baseFeature({ id: 'under', progress: -50 }),
    ]);
    // Both clamp to [0,100], so the average is (100 + 0) / 2 = 50.
    expect(stats.overallProgress).toBe(50);
  });
});

describe('computeTestingStats', () => {
  it('averages coverage only across features that report it', () => {
    const stats = computeTestingStats([
      baseFeature({ id: 'a', testCoverage: 80, testStatus: 'passed' }),
      baseFeature({ id: 'b', testCoverage: 40, testStatus: 'failed' }),
      baseFeature({ id: 'c' /* no coverage, no status */ }),
    ]);
    expect(stats.avgCoverage).toBe(60);
    expect(stats.passedCount).toBe(1);
    expect(stats.failedCount).toBe(1);
    expect(stats.pendingCount).toBe(1); // missing status counts as pending
  });

  it('returns zero coverage rather than NaN when no feature reports it', () => {
    const stats = computeTestingStats([baseFeature({ id: 'a' })]);
    expect(stats.avgCoverage).toBe(0);
  });
});

describe('computeDeploymentStats', () => {
  it('picks the latest deployDate lexicographically (ISO strings sort correctly)', () => {
    const stats = computeDeploymentStats([
      baseFeature({ id: 'a', deployStatus: 'production', deployDate: '2026-01-01' }),
      baseFeature({ id: 'b', deployStatus: 'production', deployDate: '2026-05-10' }),
      baseFeature({ id: 'c', deployStatus: 'staging' }),
      baseFeature({ id: 'd' }),
    ]);
    expect(stats.productionCount).toBe(2);
    expect(stats.stagingCount).toBe(1);
    expect(stats.notDeployedCount).toBe(1);
    expect(stats.latestDeploy).toBe('2026-05-10');
  });

  it('falls back to em-dash when nothing has been deployed yet', () => {
    expect(computeDeploymentStats([]).latestDeploy).toBe('—');
  });
});

describe('computeOperationsStats', () => {
  it('formats uptime to one decimal and error rate to two decimals', () => {
    const stats = computeOperationsStats([
      baseFeature({ id: 'a', uptimePercent: 99.95, errorRate: 0.123, avgResponseTime: 120 }),
      baseFeature({ id: 'b', uptimePercent: 99.05, errorRate: 0.500, avgResponseTime: 80,  lastIncident: '2026-04-01' }),
    ]);
    expect(stats.avgUptime).toBe('99.5');
    expect(stats.avgErrorRate).toBe('0.31');
    expect(stats.avgResponseTime).toBe('100');
    expect(stats.incidentCount).toBe(1);
  });

  it('emits em-dash for fields nobody reports — keeps the UI from rendering NaN', () => {
    const stats = computeOperationsStats([baseFeature({ id: 'a' })]);
    expect(stats.avgUptime).toBe('—');
    expect(stats.avgErrorRate).toBe('—');
    expect(stats.avgResponseTime).toBe('—');
  });
});

describe('summarizeStatuses', () => {
  it('counts each status bucket independently and treats progress=100 as completed', () => {
    const summary = summarizeStatuses([
      baseFeature({ id: 'a', status: 'done',        progress: 100 }),
      baseFeature({ id: 'b', status: 'in_progress', progress: 50 }),
      baseFeature({ id: 'c', status: 'todo',        progress: 0 }),
      baseFeature({ id: 'd', status: 'on_hold',     progress: 30 }),
      baseFeature({ id: 'e', status: 'in_progress', progress: 100 }), // progress 100 still counts as completed
    ]);
    expect(summary.completed).toBe(2);
    expect(summary.in_progress).toBe(2);
    expect(summary.not_started).toBe(1);
    expect(summary.on_hold).toBe(1);
  });
});
