import type { Feature } from '../../../lib/types';

export interface DevelopmentStats {
  totalFeatures: number;
  overallProgress: number;     // 0-100, story-point weighted
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  totalPoints: number;
}

export interface TestingStats {
  avgCoverage: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
}

export interface DeploymentStats {
  productionCount: number;
  stagingCount: number;
  notDeployedCount: number;
  latestDeploy: string;
}

export interface OperationsStats {
  avgUptime: string;
  avgErrorRate: string;
  avgResponseTime: string;
  incidentCount: number;
}

const safeProgress = (f: Feature) => Math.max(0, Math.min(100, f.progress ?? 0));
const safePoints = (f: Feature) => (typeof f.points === 'number' && f.points > 0 ? f.points : 1);

export function computeDevelopmentStats(features: Feature[]): DevelopmentStats {
  const totalPoints = features.reduce((sum, f) => sum + safePoints(f), 0);
  const completedWeighted = features.reduce(
    (sum, f) => sum + safePoints(f) * safeProgress(f),
    0,
  );
  const overallProgress = totalPoints ? Math.round(completedWeighted / totalPoints) : 0;
  return {
    totalFeatures: features.length,
    overallProgress,
    completedCount: features.filter((f) => safeProgress(f) === 100).length,
    inProgressCount: features.filter((f) => safeProgress(f) > 0 && safeProgress(f) < 100).length,
    pendingCount: features.filter((f) => safeProgress(f) === 0).length,
    totalPoints,
  };
}

export function computeTestingStats(features: Feature[]): TestingStats {
  const withCoverage = features.filter((f) => typeof f.testCoverage === 'number');
  const avgCoverage =
    withCoverage.length > 0
      ? Math.round(withCoverage.reduce((s, f) => s + (f.testCoverage ?? 0), 0) / withCoverage.length)
      : 0;
  return {
    avgCoverage,
    passedCount: features.filter((f) => f.testStatus === 'passed').length,
    failedCount: features.filter((f) => f.testStatus === 'failed').length,
    pendingCount: features.filter((f) => !f.testStatus || f.testStatus === 'pending').length,
  };
}

export function computeDeploymentStats(features: Feature[]): DeploymentStats {
  return {
    productionCount: features.filter((f) => f.deployStatus === 'production').length,
    stagingCount: features.filter((f) => f.deployStatus === 'staging').length,
    notDeployedCount: features.filter((f) => !f.deployStatus || f.deployStatus === 'not_deployed').length,
    latestDeploy:
      features
        .filter((f) => f.deployDate)
        .sort((a, b) => (b.deployDate ?? '').localeCompare(a.deployDate ?? ''))[0]
        ?.deployDate ?? '—',
  };
}

export function computeOperationsStats(features: Feature[]): OperationsStats {
  const withUptime = features.filter((f) => typeof f.uptimePercent === 'number');
  const withError = features.filter((f) => typeof f.errorRate === 'number');
  const withResponse = features.filter((f) => typeof f.avgResponseTime === 'number');
  return {
    avgUptime:
      withUptime.length > 0
        ? (withUptime.reduce((s, f) => s + (f.uptimePercent ?? 0), 0) / withUptime.length).toFixed(1)
        : '—',
    avgErrorRate:
      withError.length > 0
        ? (withError.reduce((s, f) => s + (f.errorRate ?? 0), 0) / withError.length).toFixed(2)
        : '—',
    avgResponseTime:
      withResponse.length > 0
        ? Math.round(
            withResponse.reduce((s, f) => s + (f.avgResponseTime ?? 0), 0) / withResponse.length,
          ).toString()
        : '—',
    incidentCount: features.filter((f) => f.lastIncident).length,
  };
}

export interface StatusSummary {
  completed: number;
  in_progress: number;
  not_started: number;
  on_hold: number;
}

export function summarizeStatuses(features: Feature[]): StatusSummary {
  return {
    completed: features.filter((f) => f.status === 'done' || safeProgress(f) === 100).length,
    in_progress: features.filter((f) => f.status === 'in_progress').length,
    not_started: features.filter((f) => f.status === 'todo').length,
    on_hold: features.filter((f) => f.status === 'on_hold').length,
  };
}
