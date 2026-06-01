'use client';

import React, { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { CodingCandidateRow } from '../../../../lib/keys/codingCandidates';
import { codingCandidateId } from '../../../../lib/keys/codingCandidates';
import type { Translations } from '../../../../lib/i18n';

interface ProviderLike {
  id: LlmProviderId;
  label: string;
  availableModels: string[];
  defaultModel?: string;
}

interface CodingTableRow {
  index: number;
  row: CodingCandidateRow;
}

interface CodingAgentCandidateTableProps {
  copy: Translations['keysArena']['coding'];
  rows: CodingCandidateRow[];
  providers: readonly ProviderLike[];
  canAdd: boolean;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onUpdateModel: (index: number, providerId: string, model: string) => void;
  onToggleEnabled: (index: number, enabled: boolean) => void;
  onNoteChange: (index: number, note: string) => void;
  onMoveRow: (fromIndex: number, toIndex: number) => void;
}

const helper = createColumnHelper<CodingTableRow>();

// Manual curation order is the meaning here, so TanStack sorting is disabled —
// users order the short-list themselves via the move up/down actions.
export function CodingAgentCandidateTable({
  copy,
  rows,
  providers,
  canAdd,
  onAddRow,
  onRemoveRow,
  onUpdateModel,
  onToggleEnabled,
  onNoteChange,
  onMoveRow,
}: CodingAgentCandidateTableProps) {
  const data = useMemo<CodingTableRow[]>(
    () => rows.map((row, index) => ({ index, row })),
    [rows],
  );

  const columns = useMemo(
    () => [
      helper.display({
        id: 'col-id',
        header: copy.columns.id,
        size: 130,
        cell: ({ row }) => {
          const id = codingCandidateId(row.original.row.provider, row.original.row.model);
          return (
            <span className="font-mono text-[11px] text-stone-500" title={id}>
              {id.slice(0, 8)}…
            </span>
          );
        },
      }),
      helper.display({
        id: 'col-no',
        header: copy.columns.no,
        size: 48,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-stone-400">{row.original.index + 1}</span>
        ),
      }),
      helper.display({
        id: 'col-active',
        header: copy.columns.active,
        size: 64,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.original.row.enabled}
            aria-label={`${copy.columns.active}: ${row.original.row.model}`}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onToggleEnabled(row.original.index, e.target.checked);
            }}
            className="h-4 w-4 cursor-pointer accent-emerald-400"
          />
        ),
      }),
      helper.display({
        id: 'col-provider',
        header: copy.columns.provider,
        size: 160,
        cell: ({ row }) => {
          const { provider } = row.original.row;
          return (
            <select
              value={provider}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const next = providers.find((p) => p.id === e.target.value);
                onUpdateModel(
                  row.original.index,
                  e.target.value,
                  next?.defaultModel && next.availableModels.includes(next.defaultModel)
                    ? next.defaultModel
                    : next?.availableModels[0] ?? '',
                );
              }}
              className="w-full min-w-[140px] border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id} className="bg-stone-900">
                  {p.label}
                </option>
              ))}
            </select>
          );
        },
      }),
      helper.display({
        id: 'col-model',
        header: copy.columns.model,
        size: 240,
        cell: ({ row }) => {
          const { provider, model } = row.original.row;
          const available = providers.find((p) => p.id === provider)?.availableModels ?? [];
          return (
            <select
              value={model}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateModel(row.original.index, provider, e.target.value)}
              className="w-full min-w-[200px] border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 font-mono text-xs text-stone-200 outline-none"
            >
              {available.map((m) => (
                <option key={m} value={m} className="bg-stone-900">
                  {m}
                </option>
              ))}
            </select>
          );
        },
      }),
      helper.display({
        id: 'col-note',
        header: copy.columns.note,
        size: 280,
        cell: ({ row }) => (
          <input
            type="text"
            value={row.original.row.note}
            placeholder={copy.notePlaceholder}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onNoteChange(row.original.index, e.target.value)}
            className="w-full min-w-[200px] border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none placeholder:text-stone-500"
          />
        ),
      }),
      helper.display({
        id: 'col-actions',
        header: copy.columns.actions,
        size: 120,
        cell: ({ row }) => {
          const { index } = row.original;
          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={copy.moveUpTitle}
                aria-label={copy.moveUpTitle}
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveRow(index, index - 1);
                }}
                className="inline-flex h-7 w-7 items-center justify-center border border-stone-200/20 text-stone-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                title={copy.moveDownTitle}
                aria-label={copy.moveDownTitle}
                disabled={index === rows.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveRow(index, index + 1);
                }}
                className="inline-flex h-7 w-7 items-center justify-center border border-stone-200/20 text-stone-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                title={copy.deleteRowTitle}
                aria-label={copy.deleteRowTitle}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveRow(index);
                }}
                className="inline-flex h-7 w-7 items-center justify-center border border-red-300/25 text-red-300 hover:bg-red-500/15"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        },
      }),
    ],
    [copy, providers, rows.length, onUpdateModel, onToggleEnabled, onNoteChange, onMoveRow, onRemoveRow],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => String(r.index),
  });

  const colCount = table.getVisibleLeafColumns().length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-200">
          {copy.tableTitle}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">
            {rows.length} {copy.countLabel}
          </span>
          <button
            type="button"
            onClick={onAddRow}
            disabled={!canAdd}
            className="inline-flex h-8 items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-3 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} />
            {copy.addCandidate}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-stone-200/12">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-stone-900">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b border-stone-200/10 hover:bg-white/[0.045]">
                {r.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-xs text-stone-500">
                  {copy.emptyNoRows}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
