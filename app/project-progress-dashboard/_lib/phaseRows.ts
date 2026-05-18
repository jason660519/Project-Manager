import type { Feature, FeaturePhase, FeatureStatus, IDEId } from '../../../lib/types';
import type { CustomProjectProgressRow, PhaseRowMeta } from '../types';

/** Display-side row used by every phase tab. Wraps a project Feature or a custom row. */
export interface PhaseRow extends PhaseRowMeta {
  projectName?: string;
  id: string;            // human-readable feature id ("F01" / row id)
  name: string;
  category: string;
  status: FeatureStatus;
  progress: number;      // 0-100
  points: number;        // SP weight for aggregations (defaults to 1)
  locatedPage?: string;
  notes?: string;
  testCoverage?: number;
  testStatus?: Feature['testStatus'];
  deployStatus?: Feature['deployStatus'];
  deployEnv?: string;
  deployDate?: string;
  uptimePercent?: number;
  errorRate?: number;
  avgResponseTime?: number;
  lastIncident?: string;
  specPath?: string;
  tddPath?: string;
  tddReportPath?: string;
  unitIntegrationTestPath?: string;
  e2eAcceptanceTestScriptFolder?: string;
  devLogFolder?: string;
  tddProgress?: number;
  assignedRoleId?: string;
  assignedIDE?: IDEId;
  /** Underlying feature, when source==='feature'. */
  feature?: Feature;
  /** Underlying custom row, when source==='custom'. */
  custom?: CustomProjectProgressRow;
}

const safePoints = (f: Feature) => (typeof f.points === 'number' && f.points > 0 ? f.points : 1);

/** Map a Feature → display row for a given phase view. */
export function featureToPhaseRow(feature: Feature, defaultProjectName?: string): PhaseRow {
  return {
    rowKey: `feature::${feature.id}`,
    source: 'feature',
    featureId: feature.id,
    projectName: (feature.metadata?.sourceProjectName as string | undefined) ?? defaultProjectName,
    id: feature.id,
    name: feature.name,
    category: feature.category,
    status: feature.status,
    progress: Math.max(0, Math.min(100, feature.progress ?? 0)),
    points: safePoints(feature),
    locatedPage: feature.locatedPage,
    notes: feature.notes,
    testCoverage: feature.testCoverage,
    testStatus: feature.testStatus,
    deployStatus: feature.deployStatus,
    deployEnv: feature.deployEnv,
    deployDate: feature.deployDate,
    uptimePercent: feature.uptimePercent,
    errorRate: feature.errorRate,
    avgResponseTime: feature.avgResponseTime,
    lastIncident: feature.lastIncident,
    specPath: feature.paths?.spec,
    tddPath: feature.paths?.tdd,
    tddReportPath: feature.paths?.tddProgressReport,
    unitIntegrationTestPath: feature.paths?.unitIntegrationTest,
    e2eAcceptanceTestScriptFolder: feature.paths?.e2eAcceptanceTestScriptFolder,
    devLogFolder: feature.paths?.developmentLogSummaryFolder,
    tddProgress: feature.tddProgress,
    assignedRoleId: feature.assignedRoleId,
    assignedIDE: feature.assignedIDE,
    feature,
  };
}

/** Map a custom row payload → display row for a phase view. */
export function customRowToPhaseRow(row: CustomProjectProgressRow, defaultProjectName?: string): PhaseRow {
  const points = typeof row.points === 'number' && row.points > 0 ? row.points : 1;
  return {
    rowKey: `custom::${row.rowId}`,
    source: 'custom',
    customRowId: row.rowId,
    projectName: row.projectName ?? defaultProjectName,
    id: row.rowId,
    name: row.name,
    category: row.category,
    status: row.status ?? 'todo',
    progress: Math.max(0, Math.min(100, row.percentage ?? 0)),
    points,
    locatedPage: row.locatedPage,
    testCoverage: row.testCoverage,
    testStatus: row.testStatus,
    deployStatus: row.deployStatus,
    deployEnv: row.deployEnv,
    deployDate: row.deployDate,
    uptimePercent: row.uptimePercent,
    errorRate: row.errorRate,
    avgResponseTime: row.avgResponseTime,
    lastIncident: row.lastIncident,
    specPath: row.specPath,
    tddPath: row.tddPath,
    tddReportPath: row.tddReportPath,
    unitIntegrationTestPath: row.unitIntegrationTestPath,
    e2eAcceptanceTestScriptFolder: row.e2eAcceptanceTestScriptFolder,
    devLogFolder: row.developmentLogSummaryFolder,
    tddProgress: row.tddProgress,
    assignedRoleId: row.assignedRoleId,
    assignedIDE: row.assignedIDE,
    notes: row.notes,
    custom: row,
  };
}

/** Build the display rows for a phase: features in this phase + persisted customRows. */
export function buildPhaseRows(
  features: Feature[],
  phase: FeaturePhase,
  customRows: CustomProjectProgressRow[],
  options?: { defaultProjectName?: string },
): PhaseRow[] {
  const defaultProjectName = options?.defaultProjectName;
  const featRows = features
    .filter((f) => (f.phase ?? 'development') === phase)
    .map((f) => featureToPhaseRow(f, defaultProjectName));
  const customPhaseRows = customRows
    .filter((r) => r.phase === phase)
    .map((r) => customRowToPhaseRow(r, defaultProjectName));
  return [...featRows, ...customPhaseRows];
}

/** Phase counts including persisted custom rows per phase. */
export function computePhaseCounts(
  features: Feature[],
  customRowsByPhase: Record<FeaturePhase, CustomProjectProgressRow[]>,
): Record<FeaturePhase, number> {
  const counts: Record<FeaturePhase, number> = {
    development: 0,
    e2e_testing: 0,
    deployment: 0,
    operations: 0,
  };
  features.forEach((f) => {
    const p = (f.phase ?? 'development') as FeaturePhase;
    if (p in counts) counts[p] += 1;
  });
  (Object.keys(counts) as FeaturePhase[]).forEach((p) => {
    counts[p] += customRowsByPhase[p].length;
  });
  return counts;
}
