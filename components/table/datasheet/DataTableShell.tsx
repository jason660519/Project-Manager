'use client';

import React from 'react';
import { flexRender, type Row, type Table } from '@tanstack/react-table';
import { SortMarker } from './SortMarker';
import type { FrozenColumnLayout } from './frozenColumns';

/**
 * Shared `<thead>`/`<tbody>` renderer for Basic/Large Table Sheets: sort arrows
 * (default/asc/desc with `aria-sort`), resize handles, sticky frozen columns,
 * and explicit empty + filtered-empty rows. Consumers keep their own column
 * defs, cells, and toolbar — this only owns the compliant table chrome.
 *
 * Pair with `getFrozenColumnLayout` + `FreezeColsControl` + `useArenaTablePrefs`.
 */
export function DataTableShell<TData>({
  table,
  frozen,
  emptyText,
  filteredEmptyText,
  isFiltered,
  headerFilterFor,
  onRowClick,
  headerClassName = 'px-3 py-2 text-[10px] uppercase tracking-[0.14em]',
  cellClassName = 'px-3 py-2',
  theadClassName = 'bg-stone-900',
}: {
  table: Table<TData>;
  frozen: FrozenColumnLayout;
  emptyText: string;
  filteredEmptyText: string;
  isFiltered: boolean;
  headerFilterFor?: (columnId: string) => React.ReactNode;
  onRowClick?: (row: TData) => void;
  headerClassName?: string;
  cellClassName?: string;
  theadClassName?: string;
}) {
  const rowModel = table.getRowModel();
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="border-collapse text-left" style={{ width: table.getTotalSize() }}>
        <thead className={`sticky top-0 z-10 border-b border-stone-200/12 ${theadClassName}`}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`relative select-none border-r border-stone-200/10 font-semibold text-stone-400 ${headerClassName} ${frozen.frozenClass(
                    header.column.id,
                    true,
                  )}`}
                  style={frozen.cellStyle(header.column.id)}
                  aria-sort={
                    header.column.getIsSorted() === 'asc'
                      ? 'ascending'
                      : header.column.getIsSorted() === 'desc'
                        ? 'descending'
                        : header.column.getCanSort()
                          ? 'none'
                          : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    disabled={!header.column.getCanSort()}
                    className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-default"
                  >
                    <span className="truncate">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                    {header.column.getCanSort() && <SortMarker value={header.column.getIsSorted()} />}
                  </button>
                  {headerFilterFor?.(header.column.id)}
                  {header.column.getCanResize() && (
                    <button
                      type="button"
                      aria-label={`Resize ${String(header.column.columnDef.header ?? header.column.id)}`}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-transparent hover:border-emerald-300/70 focus-visible:border-emerald-300"
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rowModel.rows.map((row: Row<TData>) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={`border-b border-stone-200/10 transition-colors hover:bg-white/[0.045] ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`relative isolate border-r border-stone-200/10 align-middle text-sm text-stone-300 ${cellClassName} ${frozen.frozenClass(
                    cell.column.id,
                  )}`}
                  style={frozen.cellStyle(cell.column.id)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {rowModel.rows.length === 0 && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-10 text-center text-xs text-stone-500"
              >
                {isFiltered ? filteredEmptyText : emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
