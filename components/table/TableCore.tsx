'use client';

// @table-classification: basic
// @table-reason: Core feature-catalog table (operational dataset, repeated use). Row actions and
//   selection are owned here; surrounding search/filter/view controls are provided by the parent
//   dashboard frame.
// @table-waivers: search, freeze, resize, sort, hidden, shared-primitive — this primitive
//   component renders rows only; full in-table control set + components/table/datasheet adoption
//   tracked as follow-up debt.

import React, { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Bot } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Feature, FeatureStatus } from '../../lib/types';
import { COL_ID_COLUMN_HEADER } from './colId';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TableCoreProps {
  data: Feature[];
  onDispatch: (feature: Feature) => void;
  onRowClick: (feature: Feature) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const STATUS_LABELS: Record<FeatureStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  on_hold: 'Blocked',
};

const columnHelper = createColumnHelper<Feature>();

function renderPathCell(value?: string, label?: string) {
  if (!value) {
    return <span className="text-xs text-stone-500">—</span>;
  }

  return (
    <span className="block max-w-[200px] truncate font-mono text-xs text-stone-300" title={value}>
      {label ?? value}
    </span>
  );
}

export function TableCore({ data, onDispatch, onRowClick, selectedIds, onToggleSelect }: TableCoreProps) {
  const columns = useMemo(
    () => [
      // Checkbox column — only rendered when selection handlers are provided
      ...(onToggleSelect
        ? [
            columnHelper.display({
              id: 'col-select',
              header: '',
              cell: (info) => (
                <input
                  type="checkbox"
                  checked={selectedIds?.has(info.row.original.id) ?? false}
                  onChange={() => onToggleSelect(info.row.original.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 cursor-pointer accent-emerald-400"
                />
              ),
            }),
          ]
        : []),
      columnHelper.accessor((row) => (row.metadata?.sourceProjectName as string | undefined) ?? '—', {
        id: 'col-project',
        header: 'Project',
        cell: (info) => (
          <span className="whitespace-nowrap font-medium text-stone-100">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('id', {
        header: COL_ID_COLUMN_HEADER,
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        size: 60,
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        cell: (info) => (
          <span className="border border-amber-200/20 bg-amber-100/10 px-2 py-1 text-xs text-amber-100/90">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('name', {
        header: 'Function/Feature',
        cell: (info) => <span className="font-medium text-stone-100">{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.paths?.spec, {
        id: 'col-spec',
        header: 'Feature Dev Spec',
        cell: (info) => renderPathCell(info.getValue(), 'feature-spec.md'),
      }),
      columnHelper.accessor((row) => row.paths?.tdd, {
        id: 'col-tdd',
        header: 'TDD Spec',
        cell: (info) => renderPathCell(info.getValue(), 'tdd-spec.md'),
      }),
      columnHelper.accessor((row) => row.paths?.debugRetro, {
        id: 'col-debug-retro',
        header: 'Debug Retro',
        cell: (info) => renderPathCell(info.getValue(), 'debug-retro.md'),
      }),
      columnHelper.accessor((row) => row.paths?.testScenarios, {
        id: 'col-test-scenarios',
        header: 'Test Scenarios',
        cell: (info) => renderPathCell(info.getValue(), 'test-scenarios.md'),
      }),
      columnHelper.accessor((row) => row.paths?.tddProgressReport, {
        id: 'col-tdd-report',
        header: 'TDD Progress Report',
        cell: (info) => renderPathCell(info.getValue(), 'tdd-report.md'),
      }),
      columnHelper.accessor((row) => row.paths?.unitIntegrationTest, {
        id: 'col-unit-test',
        header: 'Unit & Integration Test',
        cell: (info) => renderPathCell(info.getValue()),
      }),
      columnHelper.accessor((row) => row.paths?.e2eAcceptanceTestScriptFolder ?? row.paths?.test, {
        id: 'col-e2e',
        header: 'E2E Acceptance Test',
        cell: (info) => renderPathCell(info.getValue()),
      }),
      columnHelper.accessor((row) => row.paths?.developmentLogSummaryFolder, {
        id: 'col-dev-log',
        header: 'Dev Log Summary',
        cell: (info) => renderPathCell(info.getValue(), 'dev-log.md'),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('progress', {
        header: 'Progress',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 bg-stone-200/15">
              <div
                className="h-2 bg-emerald-400"
                style={{ width: `${Math.min(100, Math.max(0, info.getValue()))}%` }}
              />
            </div>
            <span className="w-9 text-right font-mono text-xs text-stone-400">
              {info.getValue()}%
            </span>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'col-actions',
        header: '',
        cell: (info) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDispatch(info.row.original);
            }}
            className="inline-flex h-7 items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-2.5 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18"
            title="Dispatch to Agent"
          >
            <Bot size={13} />
            Dispatch
          </button>
        ),
      }),
    ],
    [onDispatch, onToggleSelect, selectedIds],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="pm-scroll overflow-x-auto bg-transparent">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-40 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isSelected = selectedIds?.has(row.original.id);
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.original)}
                className={cn(
                  'cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/[0.045]',
                  isSelected && 'bg-emerald-950/20',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-stone-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-8 text-center text-xs text-stone-500"
              >
                No features match the current filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: FeatureStatus }) {
  const styles: Record<FeatureStatus, string> = {
    todo: 'border-stone-300/20 bg-stone-200/10 text-stone-200',
    in_progress: 'border-cyan-200/20 bg-cyan-100/10 text-cyan-100',
    done: 'border-emerald-200/20 bg-emerald-100/10 text-emerald-100',
    on_hold: 'border-red-400/20 bg-red-500/15 text-red-400',
  };
  return (
    <span className={cn('border px-2 py-0.5 text-xs font-medium', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
