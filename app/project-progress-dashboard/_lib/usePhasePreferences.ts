'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FeaturePhase } from '../../../lib/types';
import type { PhaseTablePrefs } from '../types';

const STORAGE_PREFIX = 'projectManager.progressDashboard.phase.';

/** Phase-specific defaults. Column counts must match the column factories. */
export const DEFAULT_WIDTHS_BY_PHASE: Record<FeaturePhase, number[]> = {
  development: [60, 110, 220, 110, 140, 100, 100, 100],
  testing:     [60, 110, 220, 110, 110, 110, 140, 100],
  deployment:  [60, 110, 220, 110, 120, 120, 140, 140],
  operations:  [60, 110, 220, 110, 100, 100, 100, 200],
};

export const DEFAULT_HEADER_HEIGHT = 40;

function buildDefaults(phase: FeaturePhase): PhaseTablePrefs {
  const widths = DEFAULT_WIDTHS_BY_PHASE[phase];
  return {
    colWidths: widths,
    columnAlignments: widths.map(() => 'left'),
    headerHeight: DEFAULT_HEADER_HEIGHT,
    freezeRowCount: 0,
    frozenDataColCount: 0,
    hiddenRowKeys: [],
    widthPresets: [],
    customRows: [],
  };
}

function storageKey(phase: FeaturePhase): string {
  return `${STORAGE_PREFIX}${phase}`;
}

function readPrefs(phase: FeaturePhase): PhaseTablePrefs {
  if (typeof window === 'undefined') return buildDefaults(phase);
  try {
    const raw = window.localStorage.getItem(storageKey(phase));
    if (!raw) return buildDefaults(phase);
    const parsed = JSON.parse(raw) as Partial<PhaseTablePrefs>;
    const defaults = buildDefaults(phase);
    return {
      ...defaults,
      ...parsed,
      colWidths: Array.isArray(parsed.colWidths) && parsed.colWidths.length === defaults.colWidths.length
        ? parsed.colWidths
        : defaults.colWidths,
      columnAlignments: Array.isArray(parsed.columnAlignments) && parsed.columnAlignments.length === defaults.colWidths.length
        ? parsed.columnAlignments
        : defaults.columnAlignments,
      hiddenRowKeys: Array.isArray(parsed.hiddenRowKeys) ? parsed.hiddenRowKeys : [],
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
