import type { FeaturePhase, FeatureStatus, IDEId, TestStatus, DeployStatus } from '../../lib/types';

/** Phase-row payload persisted in localStorage on top of project features. */
export interface CustomProjectProgressRow {
  rowId: string;
  /** Owning project display name (multi-project dashboard). */
  projectName?: string;
  name: string;
  category: string;
  percentage: number;
  /** Story points (development tab). Defaults to 1 when missing. */
  points?: number;
  locatedSection?: string;
  phase: FeaturePhase;
  status?: FeatureStatus;
  testCoverage?: number;
  testStatus?: TestStatus;
  deployStatus?: DeployStatus;
  deployEnv?: string;
  deployDate?: string;
  uptimePercent?: number;
  errorRate?: number;
  avgResponseTime?: number;
  lastIncident?: string;
  // Dev-tab fields (custom rows can mirror feature columns).
  specPath?: string;
  tddPath?: string;
  tddReportPath?: string;
  unitIntegrationTestPath?: string;
  e2eAcceptanceTestScriptFolder?: string;
  developmentLogSummaryFolder?: string;
  tddProgress?: number;
  assignedRoleId?: string;
  assignedIDE?: IDEId;
  notes?: string;
  readmePath?: string;
}

/** Generic per-table preference bag — what the toolbar persists. */
export interface PhaseTablePrefs {
  colWidths: number[];
  columnAlignments: ColumnAlignment[];
  headerHeight: number;
  freezeRowCount: number;
  frozenDataColCount: number;
  hiddenRowKeys: string[];
  widthPresets: WidthPreset[];
  customRows: CustomProjectProgressRow[];
}

export type ColumnAlignment = 'left' | 'center' | 'right';

export interface WidthPreset {
  id: string;
  name: string;
  widths: number[];
}

/** Phase tab ids — match FeaturePhase 1:1. */
export const PHASE_IDS = ['development', 'e2e_testing', 'deployment', 'operations'] as const;

/** All dashboard sheet ids, in visual order. */
export const SHEET_IDS = ['projects', 'issues', ...PHASE_IDS] as const;

/** All recognized tab ids: phase tabs + sheet tabs. */
export type TabId = (typeof SHEET_IDS)[number];

export interface PhaseRowMeta {
  rowKey: string;        // unique within the phase (eg `feature::F01` or `custom::abc`)
  source: 'feature' | 'custom';
  featureId?: string;    // present when source === 'feature'
  customRowId?: string;  // present when source === 'custom'
}
