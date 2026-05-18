import type { FeaturePhase, FeatureStatus, TestStatus, DeployStatus } from '../../lib/types';

/** Phase-row payload persisted in localStorage on top of project features. */
export interface CustomProjectProgressRow {
  rowId: string;
  name: string;
  category: string;
  percentage: number;
  locatedPage?: string;
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

/** Phase tab id — matches FeaturePhase 1:1. */
export const PHASE_IDS: FeaturePhase[] = ['development', 'e2e_testing', 'deployment', 'operations'];

export interface PhaseRowMeta {
  rowKey: string;        // unique within the phase (eg `feature::F01` or `custom::abc`)
  source: 'feature' | 'custom';
  featureId?: string;    // present when source === 'feature'
  customRowId?: string;  // present when source === 'custom'
}
