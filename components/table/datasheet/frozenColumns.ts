'use client';

import type React from 'react';
import type { Table } from '@tanstack/react-table';

/**
 * Numeric "freeze leftmost N columns" model — the company-standard freeze
 * control (table-governance.md §2.4). Frozen columns are always the first N
 * VISIBLE columns; persistence stores their canonical `col-*` ids. Ported from
 * the reference implementation in `app/ui/views/Keys/KeysProviderTable.tsx`.
 *
 * Compute this in render (offsets depend on live column sizes during resize).
 */
export interface FrozenColumnLayout {
  /** Ids of currently-visible columns, left-to-right. */
  freezeCandidateIds: string[];
  /** Effective count of frozen columns (clamped to visible count). */
  frozenColumnCount: number;
  /** The leftmost N visible column ids that are frozen. */
  frozenVisibleIds: string[];
  /** Sticky `left` offset (px) per frozen column id. */
  frozenLeftOffsets: Map<string, number>;
  /** Id of the last frozen column (gets the trailing shadow). */
  lastFrozenId: string | undefined;
  /** Inline sticky/width style for a header or body cell. */
  cellStyle: (columnId: string) => React.CSSProperties;
  /** Frozen background + z-index + trailing-shadow classes for a cell. */
  frozenClass: (columnId: string, header?: boolean) => string;
}

export function getFrozenColumnLayout<TData>(
  table: Table<TData>,
  frozenColumnIds: string[],
): FrozenColumnLayout {
  const visibleColumns = table.getVisibleLeafColumns();
  const freezeCandidateIds = visibleColumns.map((column) => column.id);
  const frozenColumnCount = Math.min(
    frozenColumnIds.filter((id) => table.getColumn(id)?.getIsVisible()).length,
    freezeCandidateIds.length,
  );
  const frozenVisibleIds = freezeCandidateIds.slice(0, frozenColumnCount);
  const frozenLeftOffsets = new Map<string, number>();
  let left = 0;
  visibleColumns.forEach((column) => {
    if (!frozenVisibleIds.includes(column.id)) return;
    frozenLeftOffsets.set(column.id, left);
    left += column.getSize();
  });
  const lastFrozenId = frozenVisibleIds[frozenVisibleIds.length - 1];

  const cellStyle = (columnId: string): React.CSSProperties => {
    const column = table.getColumn(columnId);
    const isFrozen = frozenVisibleIds.includes(columnId);
    return {
      width: column?.getSize(),
      minWidth: column?.getSize(),
      maxWidth: column?.getSize(),
      left: isFrozen ? frozenLeftOffsets.get(columnId) : undefined,
      position: isFrozen ? 'sticky' : undefined,
    };
  };

  const frozenClass = (columnId: string, header = false) =>
    frozenVisibleIds.includes(columnId)
      ? `${header ? 'z-50' : 'z-20'} bg-[rgb(var(--pm-rail))]/95 ${
          lastFrozenId === columnId ? 'shadow-[8px_0_14px_-12px_rgba(255,255,255,0.5)]' : ''
        }`
      : '';

  return {
    freezeCandidateIds,
    frozenColumnCount,
    frozenVisibleIds,
    frozenLeftOffsets,
    lastFrozenId,
    cellStyle,
    frozenClass,
  };
}

/**
 * Translate a numeric freeze count into the leftmost-N canonical column ids and
 * push them to the prefs setter. Clamps to [0, candidates].
 */
export function applyFreezeColumnCount(
  setFrozenColumnIds: (ids: string[]) => void,
  freezeCandidateIds: string[],
  value: number | string,
): void {
  const parsed = typeof value === 'number' ? value : Number(value);
  const nextCount = Number.isFinite(parsed)
    ? Math.max(0, Math.min(freezeCandidateIds.length, Math.round(parsed)))
    : 0;
  setFrozenColumnIds(freezeCandidateIds.slice(0, nextCount));
}
