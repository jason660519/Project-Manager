'use client';

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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TableCoreProps {
  data: Feature[];
  onDispatch: (feature: Feature) => void;
  onRowClick: (feature: Feature) => void;
}

const STATUS_LABELS: Record<FeatureStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  on_hold: 'Blocked',
};

const columnHelper = createColumnHelper<Feature>();

function renderPathCell(value?: string) {
  if (!value) {
    return <span className="text-xs text-stone-500">-</span>;
  }

  return <span className="font-mono text-xs text-stone-300">{value}</span>;
}

export function TableCore({ data, onDispatch, onRowClick }: TableCoreProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'ID',
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
        id: 'featureDevSpec',
        header: 'Feature Dev Spec',
        cell: (info) => renderPathCell(info.getValue()),
      }),
      columnHelper.accessor((row) => row.paths?.tdd, {
        id: 'tddSpec',
        header: 'TDD Spec',
        cell: (info) => renderPathCell(info.getValue()),
      }),
      columnHelper.accessor((row) => row.paths?.tddProgressReport, {
        id: 'tddProgressReport',
        header: 'TDD Progress Report',
        cell: (info) => renderPathCell(info.getValue()),
      }),
      columnHelper.accessor((row) => row.paths?.unitIntegrationTest, {
        id: 'unitAndIntergrationTest',
        header: 'Unit and Intergration Test',
        cell: (info) => renderPathCell(info.getValue()),
      }),
      columnHelper.accessor((row) => row.paths?.e2eAcceptanceTestScriptFolder ?? row.paths?.test, {
        id: 'e2eAccptanceTestScriptFolder',
        header: 'E2E Accptance Test Script Folder',
        cell: (info) => renderPathCell(info.getValue()),
      }),
      columnHelper.accessor((row) => row.paths?.developmentLogSummaryFolder, {
        id: 'devlopmentLogSummaryFolder',
        header: 'Devlopment Log Summary Folder',
        cell: (info) => renderPathCell(info.getValue()),
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
        id: 'actions',
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
    [onDispatch],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto bg-transparent">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-stone-200/12 bg-white/[0.035]">
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
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row.original)}
              className="cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/[0.045]"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-sm text-stone-300">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
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
    on_hold: 'border-amber-200/20 bg-amber-100/10 text-amber-100',
  };
  return (
    <span className={cn('border px-2 py-0.5 text-xs font-medium', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
