/**
 * Shared types and diff utilities for the Integrations Hub "Rescan" /
 * "Scan All" flow. Each scanner (one per sheet) reports a `ScanOutcome`
 * that the UI aggregates into a single report.
 */

import type { IntegrationRow, IntegrationSheet } from './types';

export interface ScanOutcome {
  sheetId: IntegrationSheet;
  /** Display label, e.g. "Plugins", "Coding Tools". */
  label: string;
  /** Number of rows after the scan completed. */
  count: number;
  added: IntegrationRow[];
  removed: IntegrationRow[];
  updated: IntegrationRow[];
  /**
   * Non-fatal reason the scanner was skipped (e.g. "no project selected").
   * Treated as a successful no-op when summarising.
   */
  skipped?: string;
  /** Fatal error message; treated as failure. */
  error?: string;
  durationMs: number;
}

export interface ScanReport {
  startedAt: number;
  durationMs: number;
  outcomes: ScanOutcome[];
}

/**
 * Compute added / removed / updated between two snapshots keyed by `rowKey`.
 * A row counts as "updated" if its status, statusLabel, version, or
 * installPath changed between snapshots.
 */
export function diffRows(
  prev: IntegrationRow[],
  next: IntegrationRow[],
): { added: IntegrationRow[]; removed: IntegrationRow[]; updated: IntegrationRow[] } {
  const prevMap = new Map(prev.map((r) => [r.rowKey, r]));
  const nextMap = new Map(next.map((r) => [r.rowKey, r]));

  const added: IntegrationRow[] = [];
  const removed: IntegrationRow[] = [];
  const updated: IntegrationRow[] = [];

  for (const [key, row] of nextMap) {
    const before = prevMap.get(key);
    if (!before) {
      added.push(row);
      continue;
    }
    if (
      before.status !== row.status ||
      before.statusLabel !== row.statusLabel ||
      before.version !== row.version ||
      before.installPath !== row.installPath
    ) {
      updated.push(row);
    }
  }
  for (const [key, row] of prevMap) {
    if (!nextMap.has(key)) removed.push(row);
  }
  return { added, removed, updated };
}

export function isOutcomeFailure(outcome: ScanOutcome): boolean {
  return Boolean(outcome.error);
}

export function isOutcomeSkipped(outcome: ScanOutcome): boolean {
  return !outcome.error && Boolean(outcome.skipped);
}

export function isOutcomeChanged(outcome: ScanOutcome): boolean {
  return (
    !outcome.error &&
    (outcome.added.length > 0 || outcome.removed.length > 0 || outcome.updated.length > 0)
  );
}

/**
 * Split system-CLI noise out of a row list so the UI can collapse it.
 * Returns the non-system-cli rows plus a count of system-cli rows hidden.
 */
export function splitSystemCliNoise(rows: IntegrationRow[]): {
  named: IntegrationRow[];
  systemCliCount: number;
} {
  const named: IntegrationRow[] = [];
  let systemCliCount = 0;
  for (const row of rows) {
    if (row.sourceKind === 'system-cli') systemCliCount += 1;
    else named.push(row);
  }
  return { named, systemCliCount };
}
