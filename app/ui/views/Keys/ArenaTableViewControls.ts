'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';

export interface ArenaColumnOption {
  id: string;
  label: string;
  hideable?: boolean;
  freezable?: boolean;
}

export interface ArenaTablePreset {
  id: string;
  label: string;
  columnVisibility?: Record<string, boolean>;
  frozenColumnIds?: string[];
  columnSizing?: Record<string, number>;
}

interface ArenaTablePrefs {
  version: 2;
  columnSizing: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  frozenColumnIds: string[];
  rowHeightById: Record<string, number>;
}

interface UseArenaTablePrefsArgs {
  storageKey: string;
  columnIds: string[];
  defaultSizing: Record<string, number>;
  defaultVisibility?: Record<string, boolean>;
  defaultFrozenColumnIds: string[];
  rowIds?: string[];
}

export const MIN_COLUMN_WIDTH = 56;
export const MAX_COLUMN_WIDTH = 720;
export const MIN_ROW_HEIGHT = 28;
export const MAX_ROW_HEIGHT = 160;
export const DEFAULT_ROW_HEIGHT = 48;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeSizing(
  value: unknown,
  columnIds: readonly string[],
  defaults: Record<string, number>,
): Record<string, number> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ids = new Set(columnIds);
  return Object.fromEntries(
    columnIds.map((id) => {
      const raw = ids.has(id) ? source[id] : undefined;
      const fallback = defaults[id] ?? 120;
      const size = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
      return [id, Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(size)))];
    }),
  );
}

function normalizeVisibility(
  value: unknown,
  columnIds: readonly string[],
  defaults: Record<string, boolean> = {},
): Record<string, boolean> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    columnIds.map((id) => {
      const raw = source[id];
      return [id, typeof raw === 'boolean' ? raw : defaults[id] ?? true];
    }),
  );
}

function normalizeFrozenIds(value: unknown, columnIds: readonly string[], fallback: readonly string[]): string[] {
  const ids = new Set(columnIds);
  const seen = new Set<string>();
  const source = Array.isArray(value) ? value : fallback;
  return source.filter((id): id is string => {
    if (typeof id !== 'string' || !ids.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normalizeRowHeights(
  value: unknown,
  rowIds: readonly string[] = [],
): Record<string, number> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ids = new Set(rowIds);
  return Object.fromEntries(
    Object.entries(source)
      .filter(([id, raw]) => ids.has(id) && typeof raw === 'number' && Number.isFinite(raw))
      .map(([id, raw]) => [
        id,
        Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.round(raw as number))),
      ]),
  );
}

function readPrefs(args: UseArenaTablePrefsArgs): ArenaTablePrefs {
  const fallback: ArenaTablePrefs = {
    version: 2,
    columnSizing: normalizeSizing({}, args.columnIds, args.defaultSizing),
    columnVisibility: normalizeVisibility({}, args.columnIds, args.defaultVisibility),
    frozenColumnIds: normalizeFrozenIds(args.defaultFrozenColumnIds, args.columnIds, args.defaultFrozenColumnIds),
    rowHeightById: {},
  };
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(args.storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ArenaTablePrefs>;
    return {
      version: 2,
      columnSizing: normalizeSizing(parsed.columnSizing, args.columnIds, args.defaultSizing),
      columnVisibility: normalizeVisibility(parsed.columnVisibility, args.columnIds, args.defaultVisibility),
      frozenColumnIds: normalizeFrozenIds(parsed.frozenColumnIds, args.columnIds, args.defaultFrozenColumnIds),
      rowHeightById: normalizeRowHeights(parsed.rowHeightById, args.rowIds),
    };
  } catch {
    return fallback;
  }
}

export function useArenaTablePrefs(args: UseArenaTablePrefsArgs) {
  const columnKey = args.columnIds.join('\u0000');
  const defaults = useMemo(() => readPrefs(args), [
    args.storageKey,
    columnKey,
    args.defaultFrozenColumnIds.join('\u0000'),
  ]);
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>(defaults.columnSizing);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(defaults.columnVisibility);
  const [frozenColumnIds, setFrozenColumnIds] = useState<string[]>(defaults.frozenColumnIds);
  const [rowHeightById, setRowHeightById] = useState<Record<string, number>>(defaults.rowHeightById);

  useEffect(() => {
    const next = readPrefs(args);
    setColumnSizing(next.columnSizing);
    setColumnVisibility(next.columnVisibility);
    setFrozenColumnIds(next.frozenColumnIds);
    setRowHeightById(next.rowHeightById);
  }, [args.storageKey, columnKey, args.defaultFrozenColumnIds.join('\u0000'), args.rowIds?.join('\u0000')]);

  useEffect(() => {
    if (!canUseLocalStorage()) return;
    const payload: ArenaTablePrefs = {
      version: 2,
      columnSizing: normalizeSizing(columnSizing, args.columnIds, args.defaultSizing),
      columnVisibility: normalizeVisibility(columnVisibility, args.columnIds, args.defaultVisibility),
      frozenColumnIds: normalizeFrozenIds(frozenColumnIds, args.columnIds, args.defaultFrozenColumnIds),
      rowHeightById: normalizeRowHeights(rowHeightById, args.rowIds),
    };
    try {
      window.localStorage.setItem(args.storageKey, JSON.stringify(payload));
    } catch {
      // Preferences are optional; the table remains usable without persistence.
    }
  }, [
    args.storageKey,
    columnKey,
    columnSizing,
    columnVisibility,
    frozenColumnIds,
    rowHeightById,
    args.defaultFrozenColumnIds.join('\u0000'),
    args.rowIds?.join('\u0000'),
  ]);

  const resetPrefs = () => {
    setColumnSizing(normalizeSizing({}, args.columnIds, args.defaultSizing));
    setColumnVisibility(normalizeVisibility({}, args.columnIds, args.defaultVisibility));
    setFrozenColumnIds(normalizeFrozenIds(args.defaultFrozenColumnIds, args.columnIds, args.defaultFrozenColumnIds));
    setRowHeightById({});
  };

  const setRowHeight = (rowId: string, height: number) => {
    setRowHeightById((prev) => ({
      ...prev,
      [rowId]: Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.round(height))),
    }));
  };

  const setAllRowHeights = (heightById: Record<string, number>) => {
    setRowHeightById(normalizeRowHeights(heightById, args.rowIds));
  };

  const applyPreset = (preset: ArenaTablePreset) => {
    if (preset.columnSizing) {
      setColumnSizing((prev) => normalizeSizing({ ...prev, ...preset.columnSizing }, args.columnIds, args.defaultSizing));
    }
    if (preset.columnVisibility) {
      setColumnVisibility(normalizeVisibility(preset.columnVisibility, args.columnIds, args.defaultVisibility));
    }
    if (preset.frozenColumnIds) {
      setFrozenColumnIds(normalizeFrozenIds(preset.frozenColumnIds, args.columnIds, args.defaultFrozenColumnIds));
    }
  };

  return {
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    frozenColumnIds,
    setFrozenColumnIds,
    rowHeightById,
    setRowHeight,
    setAllRowHeights,
    resetPrefs,
    applyPreset,
  };
}

export function buildCsv(rows: Array<Record<string, string | number | null | undefined>>, headers: Array<{ key: string; label: string }>) {
  const escape = (value: string | number | null | undefined) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.map((header) => escape(header.label)).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header.key])).join(',')),
  ].join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseModelRowsFromText(text: string): Array<{ provider: LlmProviderId; model: string }> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const source = item as Record<string, unknown>;
          const provider = typeof source.provider === 'string' ? source.provider as LlmProviderId : null;
          const model = typeof source.model === 'string' ? source.model : null;
          return provider && model ? { provider, model } : null;
        })
        .filter((item): item is { provider: LlmProviderId; model: string } => item !== null);
    }
  } catch {
    // Fall through to CSV parsing.
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const first = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = first.includes('provider') || first.includes('model');
  const providerIndex = hasHeader ? Math.max(0, first.indexOf('provider')) : 0;
  const modelIndex = hasHeader ? Math.max(1, first.indexOf('model')) : 1;
  return lines.slice(hasHeader ? 1 : 0)
    .map((line) => parseCsvLine(line))
    .map((cells) => {
      const provider = cells[providerIndex] as LlmProviderId | undefined;
      const model = cells[modelIndex];
      return provider && model ? { provider, model } : null;
    })
    .filter((item): item is { provider: LlmProviderId; model: string } => item !== null);
}

export function validateImportedModels(
  imported: Array<{ provider: LlmProviderId; model: string }>,
  providers: readonly { id: LlmProviderId; availableModels: string[] }[],
  maxRows: number,
) {
  const providerMap = new Map(providers.map((provider) => [provider.id, provider.availableModels]));
  const seen = new Set<string>();
  const valid: Array<{ provider: LlmProviderId; model: string }> = [];
  imported.forEach((row) => {
    const models = providerMap.get(row.provider);
    if (!models?.includes(row.model)) return;
    const key = `${row.provider}::${row.model}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (valid.length < maxRows) valid.push(row);
  });
  return valid;
}
