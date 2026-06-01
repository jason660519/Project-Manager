'use client';

// @table-classification: basic
// @table-reason: Editable, operational curation list (provider/model/note/active rows) that
//   can overflow horizontally and is reused repeatedly to feed the AI Assistant coding picker.
//   Uses the shared datasheet primitive, so search / numeric Freeze cols / resize+persist /
//   hidden cols / sort / filters / reset are provided by construction.

import React, { useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Download, Import, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { CodingCandidateRow } from '../../../../lib/keys/codingCandidates';
import { codingCandidateId } from '../../../../lib/keys/codingCandidates';
import type { Translations } from '../../../../lib/i18n';
import {
  buildCsv,
  downloadTextFile,
  parseModelRowsFromText,
  useArenaTablePrefs,
  validateImportedModels,
} from './ArenaTableViewControls';
import {
  applyFreezeColumnCount,
  DataTableShell,
  FreezeColsControl,
  getFrozenColumnLayout,
  HiddenColsMenu,
} from '../../../../components/table/datasheet';

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
  maxRows: number;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onUpdateModel: (index: number, providerId: string, model: string) => void;
  onToggleEnabled: (index: number, enabled: boolean) => void;
  onNoteChange: (index: number, note: string) => void;
  onMoveRow: (fromIndex: number, toIndex: number) => void;
  onImportModels: (models: { provider: LlmProviderId; model: string }[]) => void;
}

const col = createColumnHelper<CodingTableRow>();
const CODING_STORAGE_KEY = 'projectManager.keys.codingCandidate.tablePrefs.v1';
const CODING_COLUMN_IDS = [
  'col-id',
  'col-no',
  'col-active',
  'col-provider',
  'col-model',
  'col-note',
  'col-actions',
];
const CODING_DEFAULT_SIZING: Record<string, number> = {
  'col-id': 130,
  'col-no': 64,
  'col-active': 72,
  'col-provider': 170,
  'col-model': 250,
  'col-note': 300,
  'col-actions': 132,
};
const CODING_DEFAULT_FROZEN = ['col-id', 'col-no'];
const HIDEABLE_IDS = new Set(['col-id', 'col-active', 'col-note']);

export function CodingAgentCandidateTable({
  copy,
  rows,
  providers,
  canAdd,
  maxRows,
  onAddRow,
  onRemoveRow,
  onUpdateModel,
  onToggleEnabled,
  onNoteChange,
  onMoveRow,
  onImportModels,
}: CodingAgentCandidateTableProps) {
  const [searchText, setSearchText] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const {
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    frozenColumnIds,
    setFrozenColumnIds,
    resetPrefs,
  } = useArenaTablePrefs({
    storageKey: CODING_STORAGE_KEY,
    columnIds: CODING_COLUMN_IDS,
    defaultSizing: CODING_DEFAULT_SIZING,
    defaultFrozenColumnIds: CODING_DEFAULT_FROZEN,
  });

  const tableRows = useMemo<CodingTableRow[]>(() => rows.map((row, index) => ({ index, row })), [rows]);

  const isFiltered = searchText.trim() !== '' || providerFilter !== 'all' || activeFilter !== 'all';
  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return tableRows.filter((item) => {
      if (providerFilter !== 'all' && item.row.provider !== providerFilter) return false;
      if (activeFilter === 'active' && !item.row.enabled) return false;
      if (activeFilter === 'inactive' && item.row.enabled) return false;
      if (!keyword) return true;
      return [item.row.provider, item.row.model, item.row.note].join('\n').toLowerCase().includes(keyword);
    });
  }, [tableRows, searchText, providerFilter, activeFilter]);

  const columns = useMemo(
    () => [
      col.accessor((item) => codingCandidateId(item.row.provider, item.row.model), {
        id: 'col-id',
        header: copy.columns.id,
        size: CODING_DEFAULT_SIZING['col-id'],
        cell: ({ getValue }) => {
          const id = getValue();
          return (
            <span className="font-mono text-[11px] text-stone-500" title={id}>
              {id.slice(0, 8)}…
            </span>
          );
        },
      }),
      col.accessor((item) => item.index, {
        id: 'col-no',
        header: copy.columns.no,
        size: CODING_DEFAULT_SIZING['col-no'],
        cell: ({ row }) => <span className="font-mono text-xs text-stone-400">{row.original.index + 1}</span>,
      }),
      col.accessor((item) => item.row.enabled, {
        id: 'col-active',
        header: copy.columns.active,
        size: CODING_DEFAULT_SIZING['col-active'],
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
      col.accessor((item) => item.row.provider, {
        id: 'col-provider',
        header: copy.columns.provider,
        size: CODING_DEFAULT_SIZING['col-provider'],
        cell: ({ row }) => (
          <select
            value={row.original.row.provider}
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
            className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} className="bg-stone-900">
                {p.label}
              </option>
            ))}
          </select>
        ),
      }),
      col.accessor((item) => item.row.model, {
        id: 'col-model',
        header: copy.columns.model,
        size: CODING_DEFAULT_SIZING['col-model'],
        cell: ({ row }) => {
          const available = providers.find((p) => p.id === row.original.row.provider)?.availableModels ?? [];
          return (
            <select
              value={row.original.row.model}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateModel(row.original.index, row.original.row.provider, e.target.value)}
              className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 font-mono text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
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
      col.accessor((item) => item.row.note, {
        id: 'col-note',
        header: copy.columns.note,
        size: CODING_DEFAULT_SIZING['col-note'],
        cell: ({ row }) => (
          <input
            type="text"
            value={row.original.row.note}
            placeholder={copy.notePlaceholder}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onNoteChange(row.original.index, e.target.value)}
            className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none placeholder:text-stone-500 focus:ring-1 focus:ring-emerald-400/50"
          />
        ),
      }),
      col.display({
        id: 'col-actions',
        header: copy.columns.actions,
        size: CODING_DEFAULT_SIZING['col-actions'],
        enableSorting: false,
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
    data: filteredRows,
    columns,
    state: { sorting, columnSizing, columnVisibility },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (r) => String(r.index),
  });

  const frozen = getFrozenColumnLayout(table, frozenColumnIds);
  const hideableOptions = useMemo(
    () =>
      table
        .getAllLeafColumns()
        .filter((c) => HIDEABLE_IDS.has(c.id))
        .map((c) => ({ id: c.id, label: String(c.columnDef.header ?? c.id) })),
    [table, copy],
  );
  const providerOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.provider))), [rows]);

  const handleExport = () => {
    const exportRows = table.getRowModel().rows.map(({ original }, i) => ({
      no: i + 1,
      provider: original.row.provider,
      model: original.row.model,
      active: original.row.enabled ? 'yes' : 'no',
      note: original.row.note,
    }));
    downloadTextFile(
      'coding-agent-candidates.csv',
      buildCsv(exportRows, [
        { key: 'no', label: 'No' },
        { key: 'provider', label: 'Provider' },
        { key: 'model', label: 'Model' },
        { key: 'active', label: 'Active' },
        { key: 'note', label: 'Note' },
      ]),
    );
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const models = validateImportedModels(parseModelRowsFromText(text), providers, maxRows);
    if (models.length > 0) onImportModels(models);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-sm border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200/12 bg-white/[0.02] px-4 py-3">
        <h2 className="shrink-0 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
          {copy.tableTitle}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search provider, model, note"
            aria-label="Search candidates"
            className="h-8 w-56 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            aria-label="Filter by provider"
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">All providers</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider} className="bg-stone-900">{provider}</option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
            aria-label="Filter by active"
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">All</option>
            <option value="active" className="bg-stone-900">Active</option>
            <option value="inactive" className="bg-stone-900">Inactive</option>
          </select>
          <HiddenColsMenu table={table} options={hideableOptions} />
          <FreezeColsControl
            id="coding-candidate-freeze-cols"
            count={frozen.frozenColumnCount}
            max={frozen.freezeCandidateIds.length}
            label="Freeze cols"
            onChangeCount={(value) => applyFreezeColumnCount(setFrozenColumnIds, frozen.freezeCandidateIds, value)}
          />
          <button
            onClick={resetPrefs}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04] disabled:opacity-40"
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]"
          >
            <Import size={13} /> Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
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

      <DataTableShell
        table={table}
        frozen={frozen}
        isFiltered={isFiltered}
        emptyText={copy.emptyNoRows}
        filteredEmptyText="No candidates match the current filters."
      />
    </section>
  );
}
