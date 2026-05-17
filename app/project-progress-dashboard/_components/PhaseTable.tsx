'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import type { PhaseTablePrefs } from '../types';
import type { ColumnDef, ColumnHandlers } from '../_lib/columns';
import type { PhaseRow } from '../_lib/phaseRows';

interface PhaseTableProps {
  rows: PhaseRow[];
  columns: ColumnDef[];
  prefs: PhaseTablePrefs;
  patch: (next: Partial<PhaseTablePrefs>) => void;
  handlers: ColumnHandlers;
  onRowClick?: (row: PhaseRow) => void;
}

export function PhaseTable({ rows, columns, prefs, patch, handlers, onRowClick }: PhaseTableProps) {
  // Sum of frozen column widths — used to push the next column past the sticky edge.
  const leftOffsets = useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    prefs.colWidths.forEach((w) => {
      arr.push(acc);
      acc += w;
    });
    return arr;
  }, [prefs.colWidths]);

  const frozenCols = Math.max(0, Math.min(columns.length, prefs.frozenDataColCount));
  const frozenRows = Math.max(0, Math.min(rows.length, prefs.freezeRowCount));

  // Column resize: drag from the right edge of a <th>.
  const resizingIndex = useRef<number | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((idx: number, ev: React.MouseEvent) => {
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
      next[idx] = Math.max(40, startWidth.current + delta);
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

  return (
    <div className="relative max-h-[60vh] overflow-auto border border-stone-200/15 bg-[#061512]/70">
      <table className="border-collapse text-left" style={{ minWidth: prefs.colWidths.reduce((s, w) => s + w, 0) }}>
        <colgroup>
          {prefs.colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col, idx) => {
              const isFrozen = idx < frozenCols;
              return (
                <th
                  key={col.id}
                  className={clsx(
                    'sticky top-0 z-20 select-none border-b border-r border-stone-200/15 bg-[#0a2622] px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-300',
                    isFrozen && 'z-30',
                  )}
                  style={{
                    height: prefs.headerHeight,
                    textAlign: prefs.columnAlignments[idx],
                    left: isFrozen ? leftOffsets[idx] : undefined,
                    position: isFrozen ? 'sticky' : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{col.header || ' '}</span>
                    <span
                      onMouseDown={(e) => onMouseDown(idx, e)}
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
              <td colSpan={columns.length} className="px-4 py-8 text-center text-xs text-stone-500">
                No rows. Use Add Row to create one.
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
                className={clsx(
                  'group cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/5',
                  isFrozenRow && 'bg-[#0a2622]/85',
                )}
              >
                {columns.map((col, colIdx) => {
                  const isFrozen = colIdx < frozenCols;
                  return (
                    <td
                      key={col.id}
                      className={clsx(
                        'border-r border-stone-200/10 px-3 py-2 text-sm text-stone-200',
                        isFrozen && 'sticky z-10 bg-[#061512]/95',
                        isFrozenRow && 'sticky',
                      )}
                      style={{
                        textAlign: prefs.columnAlignments[colIdx],
                        left: isFrozen ? leftOffsets[colIdx] : undefined,
                        position: isFrozen || isFrozenRow ? 'sticky' : undefined,
                        top: isFrozenRow ? prefs.headerHeight + rowIdx * 40 : undefined,
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
    </div>
  );
}
