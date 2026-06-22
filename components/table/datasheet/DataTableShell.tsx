'use client';

import React from 'react';
import { flexRender, type Row, type Table } from '@tanstack/react-table';
import { useInAppPrompt } from '../../ui/InAppDialog';
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
  const resizePrompt = useInAppPrompt();
  const [rowHeightById, setRowHeightById] = React.useState<Record<string, number>>({});
  const [contextMenu, setContextMenu] = React.useState<
    | { type: 'column'; columnId: string; x: number; y: number }
    | { type: 'row'; rowId: string; x: number; y: number }
    | null
  >(null);
  const rowModel = table.getRowModel();
  const contextColumnId = contextMenu?.type === 'column' ? contextMenu.columnId : null;
  const contextRowId = contextMenu?.type === 'row' ? contextMenu.rowId : null;
  const contextTargetClass = 'outline outline-1 -outline-offset-1 outline-emerald-300/45 bg-emerald-500/10';

  const resizeColumn = React.useCallback(
    async (columnId: string) => {
      const column = table.getColumn(columnId);
      if (!column) return;
      const input = await resizePrompt.open({
        title: 'Resize column',
        message: 'Set column width in px.',
        defaultValue: String(column.getSize()),
      });
      if (input === null) return;
      const parsed = Number(input);
      if (!Number.isFinite(parsed)) return;
      table.setColumnSizing((prev) => ({ ...prev, [columnId]: Math.max(56, Math.min(640, parsed)) }));
    },
    [resizePrompt, table],
  );

  const resizeRow = React.useCallback(
    async (rowId: string) => {
      const input = await resizePrompt.open({
        title: 'Resize row',
        message: 'Set row height in px.',
        defaultValue: String(rowHeightById[rowId] ?? 44),
      });
      if (input === null) return;
      const parsed = Number(input);
      if (!Number.isFinite(parsed)) return;
      setRowHeightById((prev) => ({ ...prev, [rowId]: Math.max(32, Math.min(180, parsed)) }));
    },
    [resizePrompt, rowHeightById],
  );

  const startRowResizeDrag = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, rowId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight = rowHeightById[rowId] ?? 44;
      const onMove = (moveEvent: MouseEvent) => {
        setRowHeightById((prev) => ({
          ...prev,
          [rowId]: Math.max(32, Math.min(180, startHeight + moveEvent.clientY - startY)),
        }));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [rowHeightById],
  );

  return (
    <div className="pm-scroll min-h-0 flex-1 overflow-auto" onClick={() => setContextMenu(null)}>
      <table className="table-fixed border-collapse text-left" style={{ width: table.getTotalSize() }}>
        <thead className={`sticky top-0 z-40 border-b border-stone-200/12 ${theadClassName}`}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  data-context-target={contextColumnId === header.column.id ? 'column' : undefined}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu({
                      type: 'column',
                      columnId: header.column.id,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  className={`relative overflow-hidden select-none border-r border-stone-200/10 font-semibold text-stone-400 ${headerClassName} ${frozen.frozenClass(
                    header.column.id,
                    true,
                  )} ${contextColumnId === header.column.id ? contextTargetClass : ''}`}
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
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({ type: 'row', rowId: row.id, x: event.clientX, y: event.clientY });
              }}
              data-context-target={contextRowId === row.id ? 'row' : undefined}
              className={`border-b border-stone-200/10 transition-colors hover:bg-white/[0.045] ${
                onRowClick ? 'cursor-pointer' : ''
              } ${contextRowId === row.id ? 'bg-emerald-500/10' : ''}`}
              style={{ height: rowHeightById[row.id] }}
            >
              {row.getVisibleCells().map((cell, cellIndex) => (
                <td
                  key={cell.id}
                  data-context-target={
                    contextRowId === row.id
                      ? 'row'
                      : contextColumnId === cell.column.id
                        ? 'column'
                        : undefined
                  }
                  className={`relative isolate overflow-hidden border-r border-stone-200/10 align-middle text-sm text-stone-300 ${cellClassName} ${frozen.frozenClass(
                    cell.column.id,
                  )} ${contextRowId === row.id || contextColumnId === cell.column.id ? contextTargetClass : ''}`}
                  style={frozen.cellStyle(cell.column.id)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  {cellIndex === 0 && (
                    <button
                      type="button"
                      aria-label="Resize row"
                      title="Resize row"
                      onMouseDown={(event) => startRowResizeDrag(event, row.id)}
                      className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize border-b border-transparent hover:border-emerald-300/70 focus-visible:border-emerald-300"
                    />
                  )}
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
      {contextMenu && (
        <div
          className="fixed z-50 min-w-44 border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-1 text-xs text-stone-200 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.type === 'column' ? (
            <>
              <button
                type="button"
                className="block w-full px-2 py-1.5 text-left hover:bg-white/10"
                onClick={() => {
                  table.getColumn(contextMenu.columnId)?.toggleSorting();
                  setContextMenu(null);
                }}
              >
                Sort / reset sort
              </button>
              <button
                type="button"
                className="block w-full px-2 py-1.5 text-left hover:bg-white/10"
                onClick={() => {
                  void resizeColumn(contextMenu.columnId);
                  setContextMenu(null);
                }}
              >
                Resize column
              </button>
              <button
                type="button"
                className="block w-full px-2 py-1.5 text-left hover:bg-white/10"
                onClick={() => {
                  table.getColumn(contextMenu.columnId)?.toggleVisibility(false);
                  setContextMenu(null);
                }}
              >
                Hide column
              </button>
            </>
          ) : (
            <button
              type="button"
              className="block w-full px-2 py-1.5 text-left hover:bg-white/10"
              onClick={() => {
                void resizeRow(contextMenu.rowId);
                setContextMenu(null);
              }}
            >
              Resize row
            </button>
          )}
        </div>
      )}
      {resizePrompt.dialog}
    </div>
  );
}
