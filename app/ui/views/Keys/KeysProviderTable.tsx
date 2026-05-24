'use client';

/**
 * Six-column TanStack v8 table that lists every provider PM knows about,
 * showing at-a-glance: configured / validated / model count / last check.
 *
 * The table is purely a dumb renderer — its parent (`ApiConfigSheet`) is
 * responsible for loading data, persisting changes, and opening the detail
 * sheet on row click. Keeping the table this thin makes it easy to mock for
 * tests and reuse in the .env import preview.
 *
 * Layout note: this sits inside the WorkstationFrame established by KeysView,
 * so no extra panel chrome here. Sticky header alignment follows the
 * TableCore pattern (`sticky top-0` with `bg-[rgb(var(--pm-panel))]`).
 */

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Plug,
  ShieldQuestion,
  Sparkles,
} from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import type { ProviderSpec } from '../../../../lib/keys/registry';
import {
  classifyValidationFailure,
  formatRelativeTime,
} from '../../../../lib/keys/providerMetadata';

export type KeysRowStatus = 'verified' | 'configured' | 'not_set' | 'failed';

export interface KeysRowData {
  provider: ProviderSpec;
  hasKey: boolean;
  maskedKey: string | null;
  status: KeysRowStatus;
  models: string[];
  modelsAreDynamic: boolean;
  lastValidatedAt: string | null;
  errorReason: string | null;
}

interface KeysProviderTableProps {
  rows: KeysRowData[];
  onRowClick: (provider: ProviderSpec) => void;
}

const columnHelper = createColumnHelper<KeysRowData>();

/** Exhaustiveness guard — fail loud if a new KeysRowStatus lands without UI coverage. */
function assertNever(value: never): never {
  throw new Error(`Unhandled KeysRowStatus: ${String(value)}`);
}

function StatusCell({ row }: { row: KeysRowData }) {
  const failure = row.errorReason ? classifyValidationFailure(row.errorReason) : null;
  switch (row.status) {
    case 'verified':
      return (
        <span
          className="inline-flex items-center gap-1.5 border border-emerald-200/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/90"
          title={row.lastValidatedAt ? `Validated ${formatRelativeTime(row.lastValidatedAt)}` : undefined}
        >
          <CheckCircle2 size={11} /> Verified
        </span>
      );
    case 'failed':
      return (
        <div className="max-w-[220px]">
          <span
            className="inline-flex items-center gap-1.5 border border-rose-300/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-rose-300"
            title={failure ? `${failure.label}: ${failure.detail}` : undefined}
          >
            <AlertTriangle size={11} /> Failed
          </span>
          {failure && (
            <p className="mt-1 truncate text-[10px] normal-case tracking-0 text-rose-200/75" title={failure.detail}>
              {failure.label}
            </p>
          )}
        </div>
      );
    case 'configured':
      return (
        <span className="inline-flex items-center gap-1.5 border border-amber-200/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-300/90">
          <ShieldQuestion size={11} /> Configured
        </span>
      );
    case 'not_set':
      return (
        <span className="inline-flex items-center gap-1.5 border border-stone-200/18 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
          <ShieldQuestion size={11} /> Not set
        </span>
      );
    default:
      return assertNever(row.status);
  }
}

function ProviderCell({ provider }: { provider: ProviderSpec }) {
  const Icon = provider.category === 'ai' ? Sparkles : Plug;
  return (
    <div className="flex items-center gap-2">
      <Icon
        size={13}
        className={provider.category === 'ai' ? 'text-emerald-400/80' : 'text-stone-400/80'}
      />
      <span className="font-medium text-stone-100">{provider.label}</span>
    </div>
  );
}

function ModelsPreviewCell({ models }: { models: string[] }) {
  if (models.length === 0) {
    return <span className="text-stone-500">—</span>;
  }
  const preview = models.slice(0, 3);
  const remainder = models.length - preview.length;
  return (
    <div className="flex flex-wrap gap-1" title={models.join(', ')}>
      {preview.map((m) => (
        <span
          key={m}
          className="px-1.5 py-0.5 rounded-sm bg-stone-800 border border-stone-700 text-[10px] text-stone-300 font-mono"
        >
          {m}
        </span>
      ))}
      {remainder > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] text-stone-500 font-mono">
          +{remainder} more
        </span>
      )}
    </div>
  );
}

export function KeysProviderTable({ rows, onRowClick }: KeysProviderTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.provider.label, {
        id: 'provider',
        header: 'Provider',
        cell: (info) => <ProviderCell provider={info.row.original.provider} />,
      }),
      columnHelper.accessor((row) => row.maskedKey, {
        id: 'key',
        header: 'Key',
        cell: (info) => {
          const masked = info.getValue();
          return masked ? (
            <span className="font-mono text-xs text-stone-300">{masked}</span>
          ) : (
            <span className="text-xs text-stone-500">—</span>
          );
        },
      }),
      columnHelper.accessor((row) => row.status, {
        id: 'status',
        header: 'Status',
        cell: (info) => <StatusCell row={info.row.original} />,
      }),
      columnHelper.accessor((row) => row.models.length, {
        id: 'modelCount',
        header: 'Models',
        cell: (info) => {
          const count = info.getValue();
          if (count === 0) return <span className="text-stone-500">—</span>;
          return (
            <span className="font-mono text-xs text-stone-200">
              {count}
              {info.row.original.modelsAreDynamic && (
                <span className="ml-1 text-[9px] uppercase tracking-[0.14em] text-emerald-400/70">
                  live
                </span>
              )}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.models, {
        id: 'modelList',
        header: 'Available models',
        cell: (info) => <ModelsPreviewCell models={info.getValue()} />,
      }),
      columnHelper.accessor((row) => row.lastValidatedAt, {
        id: 'lastValidated',
        header: 'Last validated',
        cell: (info) => {
          const ts = info.getValue();
          return ts ? (
            <span
              className="text-xs text-stone-400"
              title={new Date(ts).toLocaleString()}
            >
              {formatRelativeTime(ts)}
            </span>
          ) : (
            <span className="text-xs text-stone-500">—</span>
          );
        },
      }),
      columnHelper.display({
        id: 'chevron',
        header: '',
        cell: () => (
          <ChevronRight size={14} className="text-stone-600" />
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400"
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
              onClick={() => onRowClick(row.original.provider)}
              className="cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/[0.045]"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle text-sm text-stone-300">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-8 text-center text-xs text-stone-500"
              >
                <KeyRound size={14} className="mx-auto mb-2 opacity-60" />
                No providers available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
