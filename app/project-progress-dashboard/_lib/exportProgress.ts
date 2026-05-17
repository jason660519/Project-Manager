import type { Feature, FeaturePhase, ProjectConfig } from '../../../lib/types';
import type { CustomProjectProgressRow } from '../types';
import {
  computeDevelopmentStats,
  computeTestingStats,
  computeDeploymentStats,
  computeOperationsStats,
} from './aggregations';
import { buildPhaseRows } from './phaseRows';

export interface ProgressSnapshot {
  exportedAt: string;
  project: { name: string; root: string };
  development: ReturnType<typeof computeDevelopmentStats> & { rows: ReturnType<typeof buildPhaseRows> };
  testing:     ReturnType<typeof computeTestingStats>     & { rows: ReturnType<typeof buildPhaseRows> };
  deployment:  ReturnType<typeof computeDeploymentStats>  & { rows: ReturnType<typeof buildPhaseRows> };
  operations:  ReturnType<typeof computeOperationsStats>  & { rows: ReturnType<typeof buildPhaseRows> };
}

export function buildProgressSnapshot(
  project: ProjectConfig,
  features: Feature[],
  customRowsByPhase: Record<FeaturePhase, CustomProjectProgressRow[]>,
): ProgressSnapshot {
  const devRows = buildPhaseRows(features, 'development', customRowsByPhase.development);
  const testRows = buildPhaseRows(features, 'testing', customRowsByPhase.testing);
  const deployRows = buildPhaseRows(features, 'deployment', customRowsByPhase.deployment);
  const opsRows = buildPhaseRows(features, 'operations', customRowsByPhase.operations);

  return {
    exportedAt: new Date().toISOString(),
    project: { name: project.name, root: project.root },
    development: { ...computeDevelopmentStats(devRows.map((r) => r.feature ?? toFeature(r))), rows: devRows },
    testing:     { ...computeTestingStats(testRows.map((r) => r.feature ?? toFeature(r))),     rows: testRows },
    deployment:  { ...computeDeploymentStats(deployRows.map((r) => r.feature ?? toFeature(r))), rows: deployRows },
    operations:  { ...computeOperationsStats(opsRows.map((r) => r.feature ?? toFeature(r))),    rows: opsRows },
  };
}

/** Build a synthetic Feature from a PhaseRow when no underlying Feature exists. */
function toFeature(row: ReturnType<typeof buildPhaseRows>[number]): Feature {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    progress: row.progress,
    points: row.points,
    paths: {},
    testCoverage: row.testCoverage,
    testStatus: row.testStatus,
    deployStatus: row.deployStatus,
    deployEnv: row.deployEnv,
    deployDate: row.deployDate,
    uptimePercent: row.uptimePercent,
    errorRate: row.errorRate,
    avgResponseTime: row.avgResponseTime,
    lastIncident: row.lastIncident,
  };
}

export function snapshotToJSON(snapshot: ProgressSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
