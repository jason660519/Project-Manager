'use client';

import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Bot, ExternalLink } from 'lucide-react';
import { Feature, FeatureStatus } from '../../lib/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TableCoreProps {
  data: Feature[];
  onDispatch: (feature: Feature) => void;
  onOpenFile: (feature: Feature, type: keyof Feature['paths']) => void;
}

const columnHelper = createColumnHelper<Feature>();

export function TableCore({ data, onDispatch, onOpenFile }: TableCoreProps) {
  const columns = useMemo(() => [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: info => <span className="font-mono text-xs">{info.getValue()}</span>,
      size: 60,
    }),
    columnHelper.accessor('category', {
      header: '分類',
      cell: info => (
        <span className="border border-amber-200/20 bg-amber-100/10 px-2 py-1 text-xs text-amber-100/90">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('name', {
      header: '功能名稱',
      cell: info => <span className="font-medium text-stone-100">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      header: '狀態',
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('progress', {
      header: '進度',
      cell: info => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-28 bg-stone-200/15">
            <div 
              className="h-2 bg-emerald-400" 
              style={{ width: `${Math.min(100, Math.max(0, info.getValue()))}%` }}
            />
          </div>
          <span className="w-9 text-right font-mono text-xs text-stone-400">{info.getValue()}%</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '操作',
      cell: info => (
        <div className="flex gap-2">
          <button 
            onClick={() => onDispatch(info.row.original)}
            className="inline-flex h-8 items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-2.5 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18"
            title="派遣到 Agent"
          >
            <Bot size={14} />
            派遣
          </button>
          <button 
            onClick={() => onOpenFile(info.row.original, 'implementation')}
            className="inline-flex h-8 items-center gap-1.5 border border-stone-200/20 px-2.5 text-xs font-medium text-stone-200 hover:bg-white/5"
            title="開啟實作路徑"
          >
            <ExternalLink size={14} />
            開啟
          </button>
        </div>
      ),
    }),
  ], [onDispatch, onOpenFile]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto bg-transparent">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-stone-200/12 bg-white/[0.035]">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="border-b border-stone-200/10 transition-colors hover:bg-white/[0.045]">
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="px-4 py-3 text-sm text-stone-300">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: FeatureStatus }) {
  const styles = {
    todo: 'border-stone-300/20 bg-stone-200/10 text-stone-200',
    in_progress: 'border-cyan-200/20 bg-cyan-100/10 text-cyan-100',
    done: 'border-emerald-200/20 bg-emerald-100/10 text-emerald-100',
    on_hold: 'border-amber-200/20 bg-amber-100/10 text-amber-100',
  };
  return (
    <span className={cn('border px-2 py-0.5 text-xs font-medium', styles[status])}>
      {status}
    </span>
  );
}
