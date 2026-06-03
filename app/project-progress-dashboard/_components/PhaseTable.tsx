'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { clsx } from 'clsx';
import type { PhaseTablePrefs } from '../types';
import type { ColumnDef, ColumnHandlers } from '../_lib/columns';
import type { PhaseRow } from '../_lib/phaseRows';
import { CategoryColumnFilter, type CategoryColumnFilterProps } from './CategoryColumnFilter';
import { useInAppPrompt } from '../../../components/ui/InAppDialog';

interface PhaseTableProps {
  rows: PhaseRow[];
  columns: ColumnDef[];
  prefs: PhaseTablePrefs;
  patch: (next: Partial<PhaseTablePrefs>) => void;
  handlers: ColumnHandlers;
  categoryFilter?: Omit<CategoryColumnFilterProps, 'header'>;
  onRowClick?: (row: PhaseRow) => void;
}

export function PhaseTable({ rows, columns, prefs, patch, handlers, categoryFilter, onRowClick }: PhaseTableProps) {
  const resizePrompt = useInAppPrompt();
  const [contextMenu, setContextMenu] = useState<
    | { type: 'column'; x: number; y: number; columnId: string; originalIndex: number; visibleIndex: number }
    | { type: 'row'; x: number; y: number; rowKey: string }
    | null
  >(null);
  const hiddenColumnIds = useMemo(() => new Set(prefs.hiddenColumnIds), [prefs.hiddenColumnIds]);
  const visibleColumns = useMemo(
    () => columns
      .map((column, originalIndex) => ({ column, originalIndex }))
      .filter(({ column }) => !hiddenColumnIds.has(column.id) || column.id === 'id'),
    [columns, hiddenColumnIds],
  );
  const visibleWidths = useMemo(
    () => visibleColumns.map(({ originalIndex }) => prefs.colWidths[originalIndex] ?? 120),
    [visibleColumns, prefs.colWidths],
  );

  // Sum of frozen column widths — used to push the next column past the sticky edge.
  const leftOffsets = useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    visibleWidths.forEach((w) => {
      arr.push(acc);
      acc += w;
    });
    return arr;
  }, [visibleWidths]);

  const frozenCols = Math.max(0, Math.min(visibleColumns.length, prefs.frozenDataColCount));
  const frozenRows = Math.max(0, Math.min(rows.length, prefs.freezeRowCount));
  const sort = prefs.sorting[0] ?? null;

  // Column resize: drag from the right edge of a <th>.
  const resizingIndex = useRef<number | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((idx: number, ev: ReactMouseEvent) => {
    resizingIndex.current = idx;
    startX.current = ev.clientX;
    startWidth.current = prefs.colWidths[idx];
    ev.preventDefault();
  }, [prefs.colWidths]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizingIndex.current == null) return;
      const idx = resizingIndex.current;
      const delta = e.clientX - startX.current;
      const next = [...prefs.colWidths];
      next[idx] = Math.max(56, Math.min(640, startWidth.current + delta));
      patch({ colWidths: next });
    };
    const onUp = () => { resizingIndex.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [prefs.colWidths, patch]);

  const toggleSort = useCallback((columnId: string) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column?.accessor) return;
    const current = prefs.sorting[0];
    if (!current || current.columnId !== columnId) {
      patch({ sorting: [{ columnId, direction: 'asc' }] });
      return;
    }
    if (current.direction === 'asc') {
      patch({ sorting: [{ columnId, direction: 'desc' }] });
      return;
    }
    patch({ sorting: [] });
  }, [columns, patch, prefs.sorting]);

  const hideColumn = useCallback((columnId: string) => {
    if (columnId === 'id') return;
    const visibleDataColumns = visibleColumns.filter(({ column }) => column.id !== 'actions' && column.id !== columnId);
    if (visibleDataColumns.length === 0) return;
    patch({ hiddenColumnIds: Array.from(new Set([...prefs.hiddenColumnIds, columnId])) });
  }, [patch, prefs.hiddenColumnIds, visibleColumns]);

  const resizeColumn = useCallback(async (originalIndex: number, columnId: string) => {
    const raw = await resizePrompt.open({
      title: 'Resize column',
      message: 'Resize column width in px. Enter 0 to hide this column.',
      defaultValue: String(prefs.colWidths[originalIndex] ?? 120),
    });
    if (raw == null) return;
    const nextValue = Number(raw);
    if (!Number.isFinite(nextValue)) return;
    if (nextValue === 0) {
      hideColumn(columnId);
      return;
    }
    const next = [...prefs.colWidths];
    next[originalIndex] = Math.max(56, Math.min(640, nextValue));
    patch({ colWidths: next });
  }, [hideColumn, patch, prefs.colWidths, resizePrompt]);

  const resizeRows = useCallback(async () => {
    const raw = await resizePrompt.open({
      title: 'Resize rows',
      message: 'Resize row height in px. Enter 0 to hide rows individually from row menu.',
      defaultValue: String(prefs.rowHeight),
    });
    if (raw == null) return;
    const nextValue = Number(raw);
    if (!Number.isFinite(nextValue) || nextValue === 0) return;
    patch({ rowHeight: Math.max(28, Math.min(160, nextValue)) });
  }, [patch, prefs.rowHeight, resizePrompt]);

  const restoreHiddenColumns = useCallback(() => {
    patch({ hiddenColumnIds: [] });
  }, [patch]);

  return (
    <div
      className="pm-scroll relative max-h-[60vh] overflow-auto border border-stone-200/15 bg-[rgb(var(--pm-rail))]/70"
      onClick={() => setContextMenu(null)}
    >
      <table className="table-fixed border-collapse text-left" style={{ minWidth: visibleWidths.reduce((s, w) => s + w, 0) }}>
        <colgroup>
          {visibleWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleColumns.map(({ column: col, originalIndex }, visibleIndex) => {
              const isFrozen = visibleIndex < frozenCols;
              const canSort = Boolean(col.accessor);
              const isSorted = sort?.columnId === col.id ? sort.direction : null;
              return (
                <th
                  key={col.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      type: 'column',
                      x: e.clientX,
                      y: e.clientY,
                      columnId: col.id,
                      originalIndex,
                      visibleIndex,
                    });
                  }}
                  className={clsx(
                    'sticky top-0 z-40 overflow-hidden select-none border-b border-r border-stone-200/15 bg-[rgb(var(--pm-card))] px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-300',
                    isFrozen && 'z-50',
                  )}
                  style={{
                    height: prefs.headerHeight,
                    textAlign: prefs.columnAlignments[originalIndex],
                    left: isFrozen ? leftOffsets[visibleIndex] : undefined,
                    position: isFrozen ? 'sticky' : undefined,
                  }}
                  aria-sort={isSorted === 'asc' ? 'ascending' : isSorted === 'desc' ? 'descending' : 'none'}
                >
                  <div className="flex items-center justify-between gap-2">
                    {col.id === 'category' && categoryFilter ? (
                      <CategoryColumnFilter header={col.header} {...categoryFilter} />
                    ) : (
                      <button
                        type="button"
                        disabled={!canSort}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSort(col.id);
                        }}
                        className={clsx(
                          'inline-flex min-w-0 items-center gap-1 truncate text-left',
                          canSort ? 'hover:text-stone-100' : 'cursor-default',
                        )}
                      >
                        <span className="truncate">{col.header || ' '}</span>
                        {canSort && (
                          <span className="text-[10px] text-stone-500">
                            {isSorted === 'asc' ? '↑' : isSorted === 'desc' ? '↓' : '↕'}
                          </span>
                        )}
                      </button>
                    )}
                    <span
                      onMouseDown={(e) => onMouseDown(originalIndex, e)}
                      className="-mr-3 h-full w-2 cursor-col-resize border-r border-stone-200/0 hover:border-emerald-300/60"
                      style={{ height: prefs.headerHeight }}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-xs text-stone-500">
                No rows match the current search or filters.
              </td>
            </tr>
          )}
          {rows.map((row, rowIdx) => {
            const isFrozenRow = rowIdx < frozenRows;
            const onClick = () => onRowClick?.(row);
            return (
              <tr
                key={row.rowKey}
                onClick={onClick}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ type: 'row', x: e.clientX, y: e.clientY, rowKey: row.rowKey });
                }}
                className={clsx(
                  'group cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/5',
                  isFrozenRow && 'bg-[rgb(var(--pm-card))]/85',
                )}
                style={{ height: prefs.rowHeight }}
              >
                {visibleColumns.map(({ column: col, originalIndex }, visibleIndex) => {
                  const isFrozen = visibleIndex < frozenCols;
                  return (
                    <td
                      key={col.id}
                      className={clsx(
                        'overflow-hidden border-r border-stone-200/10 px-3 py-2 text-sm text-stone-200',
                        isFrozen && 'sticky z-20 bg-[rgb(var(--pm-rail))]/95',
                        isFrozenRow && 'sticky',
                      )}
                      style={{
                        textAlign: prefs.columnAlignments[originalIndex],
                        left: isFrozen ? leftOffsets[visibleIndex] : undefined,
                        position: isFrozen || isFrozenRow ? 'sticky' : undefined,
                        top: isFrozenRow ? prefs.headerHeight + rowIdx * prefs.rowHeight : undefined,
                        height: prefs.rowHeight,
                      }}
                    >
                      {col.cell(row, handlers)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {contextMenu && (
        <div
          className="fixed z-50 min-w-44 border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-1 text-xs text-stone-200 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'column' ? (
            <>
              <button type="button" className="block w-full px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { toggleSort(contextMenu.columnId); setContextMenu(null); }}>
                Sort / reset sort
              </button>
              <button type="button" className="block w-full px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { void resizeColumn(contextMenu.originalIndex, contextMenu.columnId); setContextMenu(null); }}>
                Resize column
              </button>
              <button type="button" className="block w-full px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { patch({ frozenDataColCount: contextMenu.visibleIndex + 1 }); setContextMenu(null); }}>
                Freeze through this column
              </button>
              <button type="button" disabled={contextMenu.columnId === 'id'} className="block w-full px-2 py-1.5 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:text-stone-500" onClick={() => { hideColumn(contextMenu.columnId); setContextMenu(null); }}>
                Hide column
              </button>
              {prefs.hiddenColumnIds.length > 0 && (
                <button type="button" className="block w-full px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { restoreHiddenColumns(); setContextMenu(null); }}>
                  Show all hidden columns
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="block w-full px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { void resizeRows(); setContextMenu(null); }}>
                Resize rows
              </button>
              <button type="button" className="block w-full px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { handlers.onToggleHideRow(contextMenu.rowKey); setContextMenu(null); }}>
                Hide row
              </button>
              {prefs.hiddenRowKeys.length > 0 && (
                <button type="button" className="block w-full px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { patch({ hiddenRowKeys: [] }); setContextMenu(null); }}>
                  Show all hidden rows
                </button>
              )}
            </>
          )}
        </div>
      )}
      {resizePrompt.dialog}
    </div>
  );
}
