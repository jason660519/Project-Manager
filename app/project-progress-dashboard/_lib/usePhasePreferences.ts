'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FeaturePhase } from '../../../lib/types';
import type { PhaseTablePrefs } from '../types';

const STORAGE_PREFIX = 'projectManager.progressDashboard.phase.';
/** localStorage key suffix before the testing tab was renamed to E2E. */
const LEGACY_E2E_PHASE_KEY = 'testing';

/** Phase-specific defaults. Column counts must match the column factories. */
export const DEFAULT_WIDTHS_BY_PHASE: Record<FeaturePhase, number[]> = {
  development: [144, 120, 88, 50, 110, 220, 140, 110, 110, 110, 150, 150, 150, 150, 130, 150, 150, 150, 130, 180, 200],
  e2e_testing: [144, 120, 88, 110, 220, 110, 110, 110, 140, 100],
  deployment:  [144, 120, 88, 110, 220, 110, 120, 120, 140, 140],
  operations:  [144, 120, 88, 110, 220, 110, 100, 100, 100, 200],
};

export const DEFAULT_HEADER_HEIGHT = 40;
export const DEFAULT_ROW_HEIGHT = 40;
const MIN_COL_WIDTH = 56;
const MAX_COL_WIDTH = 640;
const MIN_ROW_HEIGHT = 28;
const MAX_ROW_HEIGHT = 160;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, numberValue));
}

function normalizeWidths(value: unknown, defaults: number[]): number[] {
  if (!Array.isArray(value)) return defaults;
  if (value.length !== defaults.length) return defaults;
  return value.map((width, index) => clampNumber(width, MIN_COL_WIDTH, MAX_COL_WIDTH, defaults[index] ?? MIN_COL_WIDTH));
}

function normalizeAlignments(value: unknown, defaults: PhaseTablePrefs['columnAlignments']): PhaseTablePrefs['columnAlignments'] {
  if (!Array.isArray(value) || value.length !== defaults.length) return defaults;
  return value.map((alignment, index) => (
    alignment === 'center' || alignment === 'right' || alignment === 'left'
      ? alignment
      : defaults[index] ?? 'left'
  ));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const COLUMN_ID_MIGRATION: Record<string, string> = {
  project: 'col-project',
  id: 'col-feature-id',
  featureId: 'col-feature-id',
  points: 'col-points',
  category: 'col-category',
  name: 'col-name',
  progress: 'col-progress',
  status: 'col-status',
  checklist: 'col-checklist',
  section: 'col-section',
  spec: 'col-spec',
  tdd: 'col-tdd',
  unitIntegrationTest: 'col-unit-integ',
  e2eFolder: 'col-e2e-folder',
  tddProgress: 'col-tdd-progress',
  tddReport: 'col-tdd-report',
  debugRetro: 'col-debug-retro',
  testScenarios: 'col-test-scenarios',
  devLog: 'col-dev-log',
  notes: 'col-notes',
  actions: 'col-actions',
  coverage: 'col-coverage',
  testStatus: 'col-test-status',
  deployStatus: 'col-deploy-status',
  deployEnv: 'col-env',
  deployDate: 'col-date',
  uptime: 'col-uptime',
  errorRate: 'col-error',
  avgResponseTime: 'col-rt',
  lastIncident: 'col-incident',
};

function migrateColumnId(columnId: string): string {
  return COLUMN_ID_MIGRATION[columnId] ?? columnId;
}

function buildDefaults(phase: FeaturePhase): PhaseTablePrefs {
  const widths = DEFAULT_WIDTHS_BY_PHASE[phase];
  return {
    colWidths: widths,
    columnAlignments: widths.map(() => 'left'),
    headerHeight: DEFAULT_HEADER_HEIGHT,
    rowHeight: DEFAULT_ROW_HEIGHT,
    freezeRowCount: 0,
    frozenDataColCount: 0,
    hiddenColumnIds: [],
    hiddenRowKeys: [],
    sorting: [],
    widthPresets: [],
    customRows: [],
  };
}

function storageKey(phase: FeaturePhase): string {
  return `${STORAGE_PREFIX}${phase}`;
}

function migrateLegacyPrefsJson(raw: string): string {
  const parsed = JSON.parse(raw) as Partial<PhaseTablePrefs>;
  if (!Array.isArray(parsed.customRows)) return raw;
  let changed = false;
  parsed.customRows = parsed.customRows.map((row) => {
    const phaseMigrated: PhaseTablePrefs['customRows'][number] =
      (row.phase as string) === 'testing'
        ? { ...row, phase: 'e2e_testing' as FeaturePhase }
        : row;
    if (phaseMigrated !== row) changed = true;
    if (!('locatedSection' in phaseMigrated) && 'locatedPage' in phaseMigrated) {
      const legacy = phaseMigrated as PhaseTablePrefs['customRows'][number] & { locatedPage?: string };
      changed = true;
      return {
        ...phaseMigrated,
        locatedSection: legacy.locatedPage,
      };
    }
    return phaseMigrated;
  });
  return changed ? JSON.stringify(parsed) : raw;
}

function readPrefs(phase: FeaturePhase): PhaseTablePrefs {
  if (typeof window === 'undefined') return buildDefaults(phase);
  try {
    let raw = window.localStorage.getItem(storageKey(phase));
    if (!raw && phase === 'e2e_testing') {
      const legacy = window.localStorage.getItem(`${STORAGE_PREFIX}${LEGACY_E2E_PHASE_KEY}`);
      if (legacy) {
        raw = migrateLegacyPrefsJson(legacy);
        window.localStorage.setItem(storageKey(phase), raw);
        window.localStorage.removeItem(`${STORAGE_PREFIX}${LEGACY_E2E_PHASE_KEY}`);
      }
    }
    if (!raw) return buildDefaults(phase);
    const migratedRaw = migrateLegacyPrefsJson(raw);
    if (migratedRaw !== raw) {
      window.localStorage.setItem(storageKey(phase), migratedRaw);
    }
    const parsed = JSON.parse(migratedRaw) as Partial<PhaseTablePrefs>;
    const defaults = buildDefaults(phase);
    return {
      ...defaults,
      ...parsed,
      colWidths: normalizeWidths(parsed.colWidths, defaults.colWidths),
      columnAlignments: normalizeAlignments(parsed.columnAlignments, defaults.columnAlignments),
      rowHeight: clampNumber(parsed.rowHeight, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, DEFAULT_ROW_HEIGHT),
      freezeRowCount: clampNumber(parsed.freezeRowCount, 0, 5, 0),
      frozenDataColCount: clampNumber(parsed.frozenDataColCount, 0, 5, 0),
      hiddenColumnIds: normalizeStringArray(parsed.hiddenColumnIds)
        .map(migrateColumnId)
        .filter((id) => id !== 'col-id'),
      hiddenRowKeys: normalizeStringArray(parsed.hiddenRowKeys),
      sorting: Array.isArray(parsed.sorting)
        ? parsed.sorting.filter((item): item is PhaseTablePrefs['sorting'][number] => (
          item
          && typeof item.columnId === 'string'
          && (item.direction === 'asc' || item.direction === 'desc')
        )).map((item) => ({ ...item, columnId: migrateColumnId(item.columnId) }))
        : [],
      widthPresets: Array.isArray(parsed.widthPresets) ? parsed.widthPresets : [],
      customRows: Array.isArray(parsed.customRows) ? parsed.customRows : [],
    };
  } catch {
    return buildDefaults(phase);
  }
}

/**
 * Persisted per-phase table preferences. `patch` merges shallow updates and
 * writes them back to localStorage in the same tick — no debounce, since the
 * dashboard is single-user and write volume is low.
 */
export function usePhasePreferences(phase: FeaturePhase) {
  const [prefs, setPrefs] = useState<PhaseTablePrefs>(() => buildDefaults(phase));

  // Initial read happens after mount so SSR-rendered HTML stays deterministic.
  useEffect(() => {
    setPrefs(readPrefs(phase));
  }, [phase]);

  const patch = useCallback(
    (next: Partial<PhaseTablePrefs>) => {
      setPrefs((prev) => {
        const merged: PhaseTablePrefs = { ...prev, ...next };
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(storageKey(phase), JSON.stringify(merged));
          }
        } catch {
          /* quota or disabled — drop silently */
        }
        return merged;
      });
    },
    [phase],
  );

  const reset = useCallback(() => {
    const defaults = buildDefaults(phase);
    setPrefs(defaults);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(storageKey(phase));
      }
    } catch {
      /* ignore */
    }
  }, [phase]);

  return { prefs, patch, reset };
}
