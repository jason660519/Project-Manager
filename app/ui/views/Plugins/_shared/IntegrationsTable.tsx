'use client';

import { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { IntegrationRow } from '../../../../../lib/integrations/types';
import { StatusBadge } from './status-badge';

export type ColumnVisibility = {
  lv: boolean;
  githubUrl: boolean;
  license: boolean;
  port: boolean;
  installPath: boolean;
  notes: boolean;
};

const DEFAULT_VISIBILITY: ColumnVisibility = {
  lv: false,
  githubUrl: false,
  license: false,
  port: false,
  installPath: true,
  notes: false,
};

const columnHelper = createColumnHelper<IntegrationRow>();

function emptyCell() {
  return <span className="text-xs text-stone-500">—</span>;
}

function truncateCell(value: string, max = 28) {
  if (!value) return emptyCell();
  return (
    <span className="block max-w-[200px] truncate font-mono text-xs text-stone-300" title={value}>
      {value.length > max ? `${value.slice(0, max)}…` : value}
    </span>
  );
}

interface IntegrationsTableProps {
  rows: IntegrationRow[];
  selectedRowKey: string | null;
  onRowClick: (row: IntegrationRow) => void;
  onToggleEnabled?: (row: IntegrationRow, enabled: boolean) => void;
  globalFilter: string;
  columnVisibility?: ColumnVisibility;
}

export function IntegrationsTable({
  rows,
  selectedRowKey,
  onRowClick,
  onToggleEnabled,
  globalFilter,
  columnVisibility = DEFAULT_VISIBILITY,
}: IntegrationsTableProps) {
  const columns = useMemo(
    () => [
      ...(onToggleEnabled
        ? [
            columnHelper.display({
              id: 'col-enable',
              header: 'On',
              cell: ({ row }) => (
                <input
                  type="checkbox"
                  checked={row.original.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleEnabled(row.original, e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 accent-emerald-400"
                />
              ),
              size: 40,
            }),
          ]
        : []),
      ...(columnVisibility.lv
        ? [
            columnHelper.accessor('lv', {
              id: 'col-lv',
              header: 'LV',
              cell: (info) => (
                <span className="font-mono text-xs text-stone-400">{info.getValue() ?? '—'}</span>
              ),
              size: 44,
            }),
          ]
        : []),
      columnHelper.accessor('category1', {
        id: 'col-cat1',
        header: 'Cat.1',
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-stone-300">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('category2', {
        id: 'col-cat2',
        header: 'Cat.2',
        cell: (info) => <span className="whitespace-nowrap text-xs text-stone-400">{info.getValue() || '—'}</span>,
      }),
      ...(columnVisibility.githubUrl
        ? [
            columnHelper.accessor('githubUrl', {
              id: 'col-url',
              header: 'URL',
              cell: (info) => truncateCell(info.getValue()),
            }),
          ]
        : []),
      columnHelper.accessor('company', {
        id: 'col-company',
        header: 'Company',
        cell: (info) => <span className="whitespace-nowrap text-xs text-stone-300">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('name', {
        id: 'col-name',
        header: 'Name',
        cell: (info) => (
          <span className="font-medium text-stone-100">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('version', {
        id: 'col-version',
        header: 'Ver.',
        cell: (info) => <span className="font-mono text-xs text-stone-400">{info.getValue() || '—'}</span>,
        size: 64,
      }),
      ...(columnVisibility.license
        ? [
            columnHelper.accessor('license', {
              id: 'col-license',
              header: 'License',
              cell: (info) => <span className="text-xs text-stone-400">{info.getValue() || '—'}</span>,
            }),
          ]
        : []),
      columnHelper.accessor('scope', {
        id: 'col-scope',
        header: 'Scope',
        cell: (info) => (
          <span className="text-[10px] uppercase tracking-[0.08em] text-stone-400">
            {info.getValue() || '—'}
          </span>
        ),
      }),
      ...(columnVisibility.port
        ? [
            columnHelper.accessor('port', {
              id: 'col-port',
              header: 'Port',
              cell: (info) => <span className="font-mono text-xs text-stone-400">{info.getValue() || '—'}</span>,
            }),
          ]
        : []),
      ...(columnVisibility.installPath
        ? [
            columnHelper.accessor('installPath', {
              id: 'col-path',
              header: 'Path / Address',
              cell: (info) => truncateCell(info.getValue(), 36),
            }),
          ]
        : []),
      columnHelper.display({
        id: 'col-status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge status={row.original.status} label={row.original.statusLabel} />
            {row.original.badges.slice(0, 2).map((b) => (
              <span
                key={b}
                className="border border-stone-300/20 bg-stone-200/5 px-1 py-0.5 text-[9px] text-stone-300"
              >
                {b}
              </span>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor('lastUpdated', {
        id: 'col-updated',
        header: 'Updated',
        cell: (info) => <span className="font-mono text-[10px] text-stone-400">{info.getValue() || '—'}</span>,
        size: 88,
      }),
      ...(columnVisibility.notes
        ? [
            columnHelper.accessor('notes', {
              id: 'col-notes',
              header: 'Notes',
              cell: (info) => truncateCell(info.getValue(), 24),
            }),
          ]
        : []),
    ],
    [columnVisibility, onToggleEnabled],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: () => {},
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      if (!q) return true;
      const r = row.original;
      return (
        r.name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.category1.toLowerCase().includes(q) ||
        r.category2.toLowerCase().includes(q) ||
        r.installPath.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="overflow-x-auto border border-stone-200/12 bg-[rgb(var(--pm-panel))]/72">
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                  className={`select-none px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400 ${
                    h.column.getCanSort() ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="inline-flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getCanSort() && (
                      <span className="text-[10px] text-stone-500">
                        {h.column.getIsSorted() === 'asc' ? '↑' : h.column.getIsSorted() === 'desc' ? '↓' : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const active = row.original.rowKey === selectedRowKey;
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.original)}
                className={`cursor-pointer border-b border-stone-200/10 transition-colors ${
                  active ? 'bg-emerald-950/20' : 'hover:bg-white/[0.045]'
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-3 align-middle text-sm text-stone-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-8 text-center text-xs text-stone-500"
              >
                No rows match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export { DEFAULT_VISIBILITY };
