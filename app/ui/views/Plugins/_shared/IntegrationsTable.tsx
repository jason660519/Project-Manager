'use client';

// @table-classification: basic
// @table-reason: Operational integrations table (toggle/test/method/type columns), sortable,
//   resizable, hidden-cols, table-scoped search, numeric Freeze cols, and method/type filters.
// @table-waivers: shared-primitive — uses bespoke columnSizing state rather than
//   components/table/datasheet. Declared debt, tracked as follow-up.

import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { IntegrationRow } from '../../../../../lib/integrations/types';
import { connectedInstanceSearchText } from '../../../../../lib/integrations/mappers/connected-instances';
import { useI18n } from '../../../../../lib/i18n';
import { uuidv5 } from '../../../../../lib/aiSdks/uuid';
import { COL_ID_COLUMN_HEADER } from '../../../../../components/table/colId';
import { StatusBadge } from './status-badge';

export interface IntegrationRowTestResult {
  ok: boolean;
  testedAt: number;
  detail?: string;
}

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
const INTEGRATION_ROW_ID_NAMESPACE = '2f9c5a7e-2b3f-4a76-9302-26a479e3b6a9';

function integrationRowUuid(rowKey: string): string {
  return uuidv5(rowKey, INTEGRATION_ROW_ID_NAMESPACE);
}

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

const METHOD_STYLES: Record<string, { label: string; className: string }> = {
  local_venv: { label: 'Venv', className: 'border-blue-400/25 bg-blue-500/10 text-blue-200' },
  system_path: { label: 'PATH', className: 'border-purple-400/25 bg-purple-500/10 text-purple-200' },
  desktop_app: { label: 'App', className: 'border-pink-400/25 bg-pink-500/10 text-pink-200' },
  ondemand_npx: { label: 'NPX', className: 'border-orange-400/25 bg-orange-500/10 text-orange-200' },
  remote_url: { label: 'URL', className: 'border-teal-400/25 bg-teal-500/10 text-teal-200' },
  git_clone: { label: 'Git', className: 'border-sky-400/25 bg-sky-500/10 text-sky-200' },
  local_file: { label: 'File', className: 'border-indigo-400/25 bg-indigo-500/10 text-indigo-200' },
  webhook: { label: 'Webhook', className: 'border-lime-400/25 bg-lime-500/10 text-lime-200' },
  poll: { label: 'Poll', className: 'border-amber-400/25 bg-amber-500/10 text-amber-200' },
  arp: { label: 'ARP', className: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200' },
  bonjour: { label: 'Bonjour', className: 'border-teal-400/25 bg-teal-500/10 text-teal-200' },
  docker: { label: 'Docker', className: 'border-blue-400/25 bg-blue-500/10 text-blue-200' },
  nmap: { label: 'nmap', className: 'border-amber-400/25 bg-amber-500/10 text-amber-200' },
  manual: { label: 'Manual', className: 'border-stone-400/25 bg-stone-500/10 text-stone-200' },
  mdns: { label: 'mDNS', className: 'border-teal-400/25 bg-teal-500/10 text-teal-200' },
  stdio: { label: 'STDIO', className: 'border-violet-400/25 bg-violet-500/10 text-violet-200' },
  sse: { label: 'SSE', className: 'border-sky-400/25 bg-sky-500/10 text-sky-200' },
  shttp: { label: 'SHTTP', className: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' },
  http: { label: 'SSE', className: 'border-sky-400/25 bg-sky-500/10 text-sky-200' },
};

function MethodBadge({ method }: { method?: string }) {
  if (!method) return emptyCell();
  const style = METHOD_STYLES[method] || { label: method, className: 'border-stone-400/25 bg-stone-500/10 text-stone-200' };
  return (
    <span
      className={`inline-flex border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${style.className}`}
    >
      {style.label}
    </span>
  );
}

interface IntegrationsTableProps {
  rows: IntegrationRow[];
  selectedRowKey: string | null;
  onRowClick: (row: IntegrationRow) => void;
  onToggleEnabled?: (row: IntegrationRow, enabled: boolean) => void;
  /** When set, only matching rows show an interactive Enabled checkbox (header uses the same filter). */
  canToggleRowEnabled?: (row: IntegrationRow) => boolean;
  /** Row selection checkboxes (multi-select for batch operations). */
  checkedKeys?: ReadonlySet<string>;
  onToggleCheck?: (rowKey: string, checked: boolean) => void;
  /** Called when the header checkbox is toggled. Receives all visible row keys. */
  onToggleCheckAll?: (checked: boolean, visibleRowKeys: string[]) => void;
  /**
   * When provided, renders a Test button on each row that calls back to verify
   * availability/install path. Callers own the actual probe (e.g. checkCommandExists +
   * resolveInstallPath) and refresh row data via state, so the table just shows the
   * latest result reported in `testResults`.
   */
  onTestRow?: (row: IntegrationRow) => void | Promise<void>;
  testResults?: Record<string, IntegrationRowTestResult>;
  testingKeys?: ReadonlySet<string>;
  globalFilter: string;
  columnVisibility?: ColumnVisibility;
  isLoading?: boolean;
  errorMessage?: string | null;
  frozenDataColCount?: number;
  rowDensity?: 'compact' | 'comfortable';
  /** Override Method column header (e.g. Scan method on Connected Instances). */
  methodColumnHeader?: string;
  /** When true, status badges omit extra row.badges in the status cell. */
  compactStatusCell?: boolean;
}

function isTestableRow(row: IntegrationRow): boolean {
  return (
    row.sourceKind === 'plugin-installed' ||
    row.sourceKind === 'plugin-marketplace' ||
    row.sourceKind === 'connected-instance'
  );
}

export function IntegrationsTable({
  rows,
  selectedRowKey,
  onRowClick,
  onToggleEnabled,
  canToggleRowEnabled,
  checkedKeys,
  onToggleCheck,
  onToggleCheckAll,
  onTestRow,
  testResults,
  testingKeys,
  globalFilter,
  columnVisibility = DEFAULT_VISIBILITY,
  isLoading = false,
  errorMessage = null,
  frozenDataColCount = 0,
  rowDensity = 'comfortable',
  methodColumnHeader,
  compactStatusCell = false,
}: IntegrationsTableProps) {
  const { t } = useI18n();
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const columns = useMemo(
    () => [
      ...(onToggleCheck || onToggleEnabled
        ? [
            columnHelper.display({
              id: 'col-check',
              enableSorting: false,
              size: 88,
              header: ({ table }) => {
                const visibleRows = table.getRowModel().rows.map((r) => r.original);
                const visibleKeys = visibleRows.map((r) => r.rowKey);
                const selectionOnly = Boolean(onToggleCheck && !onToggleEnabled);
                const enabledRows = canToggleRowEnabled
                  ? visibleRows.filter((r) => canToggleRowEnabled(r))
                  : visibleRows;
                const allChecked = selectionOnly
                  ? visibleKeys.length > 0 && visibleKeys.every((k) => checkedKeys?.has(k))
                  : enabledRows.length > 0 && enabledRows.every((r) => r.enabled);
                const someChecked = selectionOnly
                  ? !allChecked && visibleKeys.some((k) => checkedKeys?.has(k))
                  : !allChecked && enabledRows.some((r) => r.enabled);
                const headerDisabled = !selectionOnly && enabledRows.length === 0;
                return (
                  <div className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      disabled={headerDisabled}
                      ref={(el) => { if (el) el.indeterminate = someChecked; }}
                      onChange={(e) => {
                        e.stopPropagation();
                        const next = e.target.checked;
                        if (selectionOnly) {
                          onToggleCheckAll?.(next, visibleKeys);
                          return;
                        }
                        enabledRows.forEach((row) => {
                          if (row.enabled === next) return;
                          onToggleEnabled?.(row, next);
                          onToggleCheck?.(row.rowKey, next);
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 shrink-0 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                      title={allChecked ? t.integrations.deselectAll : t.integrations.selectAll}
                    />
                    <span className="whitespace-nowrap normal-case tracking-normal text-stone-400">
                      {t.integrations.colEnabled}
                    </span>
                  </div>
                );
              },
              cell: ({ row }) => {
                const selectionOnly = Boolean(onToggleCheck && !onToggleEnabled);
                const rowToggleable = !canToggleRowEnabled || canToggleRowEnabled(row.original);
                const checked = selectionOnly
                  ? (checkedKeys?.has(row.original.rowKey) ?? false)
                  : row.original.enabled;
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!selectionOnly && !rowToggleable}
                    onChange={(e) => {
                      e.stopPropagation();
                      const next = e.target.checked;
                      if (selectionOnly) {
                        onToggleCheck?.(row.original.rowKey, next);
                        return;
                      }
                      if (!rowToggleable || row.original.enabled === next) return;
                      onToggleEnabled?.(row.original, next);
                      onToggleCheck?.(row.original.rowKey, next);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                    title={t.integrations.colEnabled}
                  />
                );
              },
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
      columnHelper.accessor((row) => integrationRowUuid(row.rowKey), {
        id: 'col-id',
        header: COL_ID_COLUMN_HEADER,
        cell: (info) => {
          const uuid = info.getValue();
          return (
            <span
              className="block max-w-[160px] truncate font-mono text-[11px] text-stone-300"
              title={`${uuid} · ${info.row.original.rowKey}`}
            >
              {uuid}
            </span>
          );
        },
        size: 144,
      }),
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
      columnHelper.display({
        id: 'col-method',
        header: methodColumnHeader ?? t.integrations.colMethod,
        cell: ({ row }) => <MethodBadge method={row.original.installMethod} />,
        size: 80,
      }),
      columnHelper.display({
        id: 'col-status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge status={row.original.status} label={row.original.statusLabel} />
            {!compactStatusCell &&
              row.original.badges.slice(0, 2).map((b) => (
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
      ...(onTestRow
        ? [
            columnHelper.display({
              id: 'col-test',
              header: t.integrations.colTest,
              enableSorting: false,
              size: 92,
              cell: ({ row }) => {
                const r = row.original;
                if (!isTestableRow(r)) return emptyCell();
                const result = testResults?.[r.rowKey];
                const testing = testingKeys?.has(r.rowKey) ?? false;
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onTestRow(r);
                    }}
                    disabled={testing}
                    title={
                      testing
                        ? 'Testing…'
                        : result
                          ? `${result.ok ? 'Available' : 'Unavailable'}${
                              result.detail ? ` — ${result.detail}` : ''
                            } · ${new Date(result.testedAt).toLocaleTimeString()}`
                          : t.integrations.colTestAvailabilityHint
                    }
                    className={`inline-flex h-6 items-center gap-1 border px-2 text-[10px] font-medium uppercase tracking-[0.08em] transition-colors ${
                      testing
                        ? 'cursor-wait border-stone-200/15 bg-stone-200/5 text-stone-400'
                        : result?.ok === true
                          ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                          : result?.ok === false
                            ? 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20'
                            : 'border-stone-200/25 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10'
                    }`}
                  >
                    {testing ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : result?.ok === true ? (
                      <CheckCircle2 size={11} />
                    ) : result?.ok === false ? (
                      <XCircle size={11} />
                    ) : null}
                    Test
                  </button>
                );
              },
            }),
            columnHelper.display({
              id: 'col-test-result',
              header: t.integrations.colTestResult,
              enableSorting: false,
              size: 200,
              cell: ({ row }) => {
                const r = row.original;
                if (!isTestableRow(r)) return emptyCell();
                const result = testResults?.[r.rowKey];
                const testing = testingKeys?.has(r.rowKey) ?? false;
                if (testing) {
                  return (
                    <span className="font-mono text-[10px] text-stone-500 italic">testing…</span>
                  );
                }
                if (!result) return emptyCell();
                const text = result.detail ?? (result.ok ? 'OK' : 'Failed');
                const MAX = 32;
                const display = text.length > MAX ? `${text.slice(0, MAX)}…` : text;
                return (
                  <span
                    title={text}
                    className={`block max-w-[190px] truncate font-mono text-[10px] ${
                      result.ok ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {display}
                  </span>
                );
              },
            }),
          ]
        : []),
      columnHelper.accessor('lastUpdated', {
        id: 'col-updated',
        header: t.integrations.colUpdated,
        cell: (info) => <span className="font-mono text-[10px] text-stone-400">{info.getValue() || '—'}</span>,
        size: 88,
      }),
      ...(columnVisibility.notes
        ? [
            columnHelper.accessor('notes', {
              id: 'col-notes',
              header: t.integrations.colNotes,
              cell: (info) => truncateCell(info.getValue(), 24),
            }),
          ]
        : []),
    ],
    [
      columnVisibility,
      onToggleCheck,
      onToggleCheckAll,
      checkedKeys,
      onToggleEnabled,
      canToggleRowEnabled,
      onTestRow,
      testResults,
      testingKeys,
      t,
      methodColumnHeader,
      compactStatusCell,
    ],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, columnSizing },
    onColumnSizingChange: setColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 56, size: 150, maxSize: 480 },
    onGlobalFilterChange: () => {},
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      if (!q) return true;
      const r = row.original;
      if (r.sourceKind === 'connected-instance') {
        return `${integrationRowUuid(r.rowKey)} ${connectedInstanceSearchText(r)}`.includes(q);
      }
      return (
        integrationRowUuid(r.rowKey).includes(q) ||
        r.rowKey.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.category1.toLowerCase().includes(q) ||
        r.category2.toLowerCase().includes(q) ||
        r.installPath.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.badges.some((badge) => badge.toLowerCase().includes(q))
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const leafColumns = table.getVisibleLeafColumns();
  const clampedFrozenCols = Math.max(0, Math.min(frozenDataColCount, leafColumns.length));
  const frozenLeftOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    leafColumns.forEach((col, idx) => {
      offsets[idx] = acc;
      if (idx < clampedFrozenCols) {
        acc += col.getSize();
      }
    });
    return offsets;
  }, [leafColumns, clampedFrozenCols, columnSizing]);
  const rowPaddingClass = rowDensity === 'compact' ? 'py-2' : 'py-3';

  if (isLoading) {
    return (
      <div className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/72 px-4 py-8 text-center">
        <p className="text-xs text-stone-400">Loading table data...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="border border-red-400/20 bg-red-950/20 px-4 py-6">
        <p className="text-xs text-red-200">Failed to load table data: {errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="pm-scroll h-full overflow-auto border border-stone-200/12 bg-[rgb(var(--pm-panel))]/72">
      <table className="w-full table-fixed min-w-[960px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-40 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                  className={`relative overflow-hidden select-none px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400 ${
                    h.column.getCanSort() ? 'cursor-pointer' : ''
                  }`}
                  style={{
                    width: h.column.getSize(),
                    minWidth: h.column.getSize(),
                    left: h.column.getIndex() < clampedFrozenCols ? frozenLeftOffsets[h.column.getIndex()] : undefined,
                    position: h.column.getIndex() < clampedFrozenCols ? 'sticky' : undefined,
                    zIndex: h.column.getIndex() < clampedFrozenCols ? 50 : undefined,
                    background:
                      h.column.getIndex() < clampedFrozenCols
                        ? 'rgb(var(--pm-panel))'
                        : undefined,
                  }}
                >
                  <div className="inline-flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getCanSort() && (
                      <span className="text-[10px] text-stone-500">
                        {h.column.getIsSorted() === 'asc' ? '↑' : h.column.getIsSorted() === 'desc' ? '↓' : '↕'}
                      </span>
                    )}
                  </div>
                  {h.column.getCanResize() && (
                    <span
                      onMouseDown={h.getResizeHandler()}
                      onTouchStart={h.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none border-r border-stone-200/0 hover:border-emerald-300/60"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
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
                  <td
                    key={cell.id}
                    className={`overflow-hidden px-3 ${rowPaddingClass} align-middle text-sm text-stone-300`}
                    style={{
                      width: cell.column.getSize(),
                      minWidth: cell.column.getSize(),
                      left:
                        cell.column.getIndex() < clampedFrozenCols
                          ? frozenLeftOffsets[cell.column.getIndex()]
                          : undefined,
                      position: cell.column.getIndex() < clampedFrozenCols ? 'sticky' : undefined,
                      zIndex: cell.column.getIndex() < clampedFrozenCols ? 20 : undefined,
                      background:
                        cell.column.getIndex() < clampedFrozenCols
                          ? active
                            ? 'rgba(6, 78, 59, 0.45)'
                            : 'rgb(var(--pm-panel))'
                          : undefined,
                    }}
                  >
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
