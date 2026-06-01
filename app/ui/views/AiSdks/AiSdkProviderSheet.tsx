'use client';

/**
 * One provider's editable parameter sheet — a wide TanStack v8 table:
 *   col-id (frozen) | col-provider | col-model | col-type | col-param-<key>…
 *
 * Columns after col-type are derived from the provider's parameter catalog;
 * each renders an EditableParamCell. Follows the KeysProviderTable contract for
 * search / sort / resize / freeze, persisting view prefs by canonical col- id
 * via useArenaTablePrefs. Row click opens a parameter-metadata detail panel.
 */

import React, { useMemo, useState } from 'react';
import { Info, Plus, RotateCcw, Snowflake, X } from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import {
  buildProviderModelCatalog,
  getParamSpecs,
  type ParamSpec,
  type ParamValue,
} from '../../../../lib/aiSdks/catalog';
import {
  effectiveParamValue,
  validateParam,
  type AiSdksConfig,
} from '../../../../lib/aiSdks/store';
import type { Translations } from '../../../../lib/i18n';
import { useArenaTablePrefs } from '../Keys/ArenaTableViewControls';
import { EditableParamCell } from './EditableParamCell';

type AiSdksCopy = Translations['aiSdks'];

interface AiSdkRow {
  id: string;
  providerLabel: string;
  model: string;
  modelType: string;
  isCustom: boolean;
}

interface AiSdkProviderSheetProps {
  providerId: LlmProviderId;
  store: AiSdksConfig;
  categories: readonly string[];
  readOnly: boolean;
  copy: AiSdksCopy;
  onSetParam: (id: string, key: string, value: ParamValue) => void;
  onSetModelType: (id: string, modelType: string) => void;
  onAddModel: (model: string) => void;
  onAddCategory: (category: string) => void;
  onRestoreProviderDefaults: () => void;
}

const columnHelper = createColumnHelper<AiSdkRow>();

function SortMarker({ value }: { value: false | 'asc' | 'desc' }) {
  if (value === 'asc') return <span className="text-emerald-200">↑</span>;
  if (value === 'desc') return <span className="text-emerald-200">↓</span>;
  return null;
}

function rangeText(spec: ParamSpec): string {
  if (spec.type === 'enum') return (spec.enumValues ?? []).join(' | ');
  if (spec.type === 'boolean') return 'true | false';
  if (spec.type === 'string') return '—';
  const min = spec.min !== undefined ? spec.min : '−∞';
  const max = spec.max !== undefined ? spec.max : '∞';
  return `${min} … ${max}`;
}

export function AiSdkProviderSheet({
  providerId,
  store,
  categories,
  readOnly,
  copy,
  onSetParam,
  onSetModelType,
  onAddModel,
  onAddCategory,
  onRestoreProviderDefaults,
}: AiSdkProviderSheetProps) {
  const specs = useMemo(() => getParamSpecs(providerId), [providerId]);

  const rows = useMemo<AiSdkRow[]>(() => {
    const catalog = buildProviderModelCatalog(providerId).map((entry) => ({
      id: entry.id,
      providerLabel: entry.providerLabel,
      model: entry.model,
      modelType: store.models[entry.id]?.modelType ?? entry.modelType,
      isCustom: false,
    }));
    const custom = store.customModels
      .filter((m) => m.providerId === providerId)
      .map((m) => ({
        id: m.id,
        providerLabel: catalog[0]?.providerLabel ?? providerId,
        model: m.model,
        modelType: store.models[m.id]?.modelType ?? m.modelType ?? 'LLM',
        isCustom: true,
      }));
    return [...catalog, ...custom];
  }, [providerId, store]);

  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newModel, setNewModel] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const columnIds = useMemo(
    () => ['col-id', 'col-provider', 'col-model', 'col-type', ...specs.map((s) => `col-param-${s.key}`)],
    [specs],
  );
  const defaultSizing = useMemo<Record<string, number>>(() => {
    const sizing: Record<string, number> = {
      'col-id': 220,
      'col-provider': 200,
      'col-model': 220,
      'col-type': 150,
    };
    specs.forEach((s) => {
      sizing[`col-param-${s.key}`] = 150;
    });
    return sizing;
  }, [specs]);

  const {
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    frozenColumnIds,
    setFrozenColumnIds,
    resetPrefs,
  } = useArenaTablePrefs({
    storageKey: `projectManager.aiSdks.${providerId}.tablePrefs.v1`,
    columnIds,
    defaultSizing,
    defaultFrozenColumnIds: ['col-id'],
  });

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== 'all' && row.modelType !== typeFilter) return false;
      if (!keyword) return true;
      return [row.id, row.model, row.providerLabel, row.modelType]
        .join('\n')
        .toLowerCase()
        .includes(keyword);
    });
  }, [rows, searchText, typeFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.id, {
        id: 'col-id',
        header: copy.columns.id,
        cell: (info) => <span className="font-mono text-[11px] text-stone-400">{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.providerLabel, {
        id: 'col-provider',
        header: copy.columns.provider,
        enableColumnFilter: true,
        cell: (info) => <span className="font-medium text-stone-100">{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.model, {
        id: 'col-model',
        header: copy.columns.model,
        cell: (info) => <span className="font-mono text-xs text-stone-200">{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.modelType, {
        id: 'col-type',
        header: copy.columns.type,
        enableColumnFilter: true,
        filterFn: 'equalsString',
        cell: (info) => (
          <select
            value={info.getValue()}
            disabled={readOnly}
            aria-label={copy.columns.type}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onSetModelType(info.row.original.id, e.target.value);
            }}
            className="w-full border border-amber-200/25 bg-amber-100/5 px-1.5 py-1 text-[11px] text-amber-100/90 outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-stone-900">{c}</option>
            ))}
          </select>
        ),
      }),
      ...specs.map((spec) =>
        columnHelper.display({
          id: `col-param-${spec.key}`,
          header: () => (
            <span className="inline-flex items-center gap-1">
              {spec.label}
              {spec.unit ? <span className="text-stone-500">({spec.unit})</span> : null}
            </span>
          ),
          cell: ({ row }) => (
            <EditableParamCell
              spec={spec}
              value={effectiveParamValue(spec, store.models[row.original.id])}
              readOnly={readOnly}
              onCommit={(value) => onSetParam(row.original.id, spec.key, value)}
            />
          ),
        }),
      ),
    ],
    [copy, specs, categories, readOnly, store, onSetModelType, onSetParam],
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
  });

  // Freeze offsets (mirrors KeysProviderTable).
  const visibleColumns = table.getVisibleLeafColumns();
  const freezeCandidateIds = visibleColumns.map((c) => c.id);
  const frozenColumnCount = Math.min(
    frozenColumnIds.filter((id) => table.getColumn(id)?.getIsVisible()).length,
    freezeCandidateIds.length,
  );
  const frozenVisibleIds = freezeCandidateIds.slice(0, frozenColumnCount);
  const frozenLeftOffsets = new Map<string, number>();
  let left = 0;
  visibleColumns.forEach((column) => {
    if (!frozenVisibleIds.includes(column.id)) return;
    frozenLeftOffsets.set(column.id, left);
    left += column.getSize();
  });
  const lastFrozenId = frozenVisibleIds[frozenVisibleIds.length - 1];
  const cellStyle = (columnId: string): React.CSSProperties => {
    const column = table.getColumn(columnId);
    const isFrozen = frozenVisibleIds.includes(columnId);
    return {
      width: column?.getSize(),
      minWidth: column?.getSize(),
      maxWidth: column?.getSize(),
      left: isFrozen ? frozenLeftOffsets.get(columnId) : undefined,
      position: isFrozen ? 'sticky' : undefined,
    };
  };
  const frozenClass = (columnId: string, header = false) =>
    frozenVisibleIds.includes(columnId)
      ? `${header ? 'z-30' : 'z-20'} bg-[rgb(var(--pm-rail))]/95 ${lastFrozenId === columnId ? 'shadow-[8px_0_14px_-12px_rgba(255,255,255,0.5)]' : ''}`
      : '';

  const handleFreezeCountChange = (value: string) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed)
      ? Math.max(0, Math.min(freezeCandidateIds.length, Math.round(parsed)))
      : 0;
    setFrozenColumnIds(freezeCandidateIds.slice(0, next));
  };

  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  const handleAddModel = () => {
    const value = newModel.trim();
    if (!value) return;
    onAddModel(value);
    setNewModel('');
  };
  const handleAddCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    onAddCategory(value);
    setNewCategory('');
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 flex-1 flex-col border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
        {/* Toolbar: search | freeze | filter | add model | add category | restore */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/12 bg-white/[0.02] px-4 py-3">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={copy.controls.searchPlaceholder}
            className="h-8 w-56 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
          <div className="flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200">
            <Snowflake size={13} className="text-cyan-300" />
            <label htmlFor={`${providerId}-freeze`} className="text-[10px] text-stone-400">
              {copy.controls.freezeColumns}
            </label>
            <input
              id={`${providerId}-freeze`}
              type="number"
              min={0}
              max={freezeCandidateIds.length}
              value={frozenColumnCount}
              aria-label={copy.controls.freezeColumns}
              onChange={(e) => handleFreezeCountChange(e.target.value)}
              className="h-6 w-11 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-1 text-center text-xs text-stone-100 outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
          </div>
          <select
            value={typeFilter}
            aria-label={copy.filters.type}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-1.5 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          >
            <option value="all" className="bg-stone-900">{copy.filters.allTypes}</option>
            {categories.map((c) => (
              <option key={c} value={c} className="bg-stone-900">{c}</option>
            ))}
          </select>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center border border-stone-200/18">
              <input
                value={newModel}
                disabled={readOnly}
                onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                placeholder={copy.controls.addModelPlaceholder}
                className="h-full w-40 bg-transparent px-2 text-xs text-stone-200 outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddModel}
                disabled={readOnly}
                className="inline-flex h-full items-center gap-1 border-l border-stone-200/18 px-2 text-[11px] text-stone-200 hover:bg-white/[0.04] disabled:opacity-50"
              >
                <Plus size={12} /> {copy.controls.addModel}
              </button>
            </div>
            <div className="flex h-8 items-center border border-stone-200/18">
              <input
                value={newCategory}
                disabled={readOnly}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder={copy.controls.addCategoryPlaceholder}
                className="h-full w-32 bg-transparent px-2 text-xs text-stone-200 outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={readOnly}
                className="inline-flex h-full items-center gap-1 border-l border-stone-200/18 px-2 text-[11px] text-stone-200 hover:bg-white/[0.04] disabled:opacity-50"
              >
                <Plus size={12} /> {copy.controls.addCategory}
              </button>
            </div>
            <button
              type="button"
              onClick={onRestoreProviderDefaults}
              disabled={readOnly}
              title={copy.controls.restoreDefaultsTitle}
              className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <RotateCcw size={13} /> {copy.controls.restoreDefaults}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="border-collapse text-left" style={{ width: table.getTotalSize() }}>
            <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`relative select-none border-r border-stone-200/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 ${frozenClass(header.column.id, true)}`}
                      style={cellStyle(header.column.id)}
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
                        <SortMarker value={header.column.getIsSorted()} />
                      </button>
                      {header.column.getCanResize() && (
                        <button
                          type="button"
                          aria-label={`Resize ${header.column.id}`}
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
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.original.id)}
                  className={`cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/[0.045] ${
                    selectedId === row.original.id ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`relative isolate border-r border-stone-200/10 px-4 py-2 align-middle text-sm text-stone-300 ${frozenClass(cell.column.id)}`}
                      style={cellStyle(cell.column.id)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td
                    colSpan={table.getVisibleLeafColumns().length}
                    className="px-4 py-8 text-center text-xs text-stone-500"
                  >
                    {rows.length === 0 ? copy.empty.noModels : copy.empty.noMatch}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parameter-metadata detail panel */}
      {selectedRow && (
        <aside className="ml-3 hidden w-72 shrink-0 flex-col border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72 md:flex">
          <div className="flex items-center justify-between border-b border-stone-200/12 px-3 py-2">
            <h3 className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-stone-200" title={selectedRow.model}>
              {selectedRow.model}
            </h3>
            <button
              type="button"
              aria-label={copy.detail.close}
              onClick={() => setSelectedId(null)}
              className="flex h-6 w-6 items-center justify-center text-stone-500 hover:text-stone-200"
            >
              <X size={13} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
            {specs.map((spec) => {
              const value = effectiveParamValue(spec, store.models[selectedRow.id]);
              const result = validateParam(spec, value);
              return (
                <div key={spec.key} className="mb-3 border-b border-stone-200/10 pb-2 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-100">{spec.label}</span>
                    <span className="rounded-sm border border-stone-200/18 px-1.5 py-0.5 text-[10px] uppercase text-stone-400">
                      {spec.type}
                    </span>
                  </div>
                  <dl className="mt-1 space-y-0.5 text-[11px] text-stone-400">
                    <div className="flex justify-between gap-2">
                      <dt>{copy.detail.range}</dt>
                      <dd className="font-mono text-stone-300">{rangeText(spec)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{copy.detail.default}</dt>
                      <dd className="font-mono text-stone-300">{spec.default === null ? '—' : String(spec.default)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{copy.detail.value}</dt>
                      <dd className={`font-mono ${result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {value === null || value === '' ? '—' : String(value)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-1 leading-relaxed text-stone-500">{spec.description}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-1.5 border-t border-stone-200/12 px-3 py-2 text-[10px] text-stone-500">
            <Info size={12} className="mt-0.5 shrink-0" /> {copy.detail.selectHint}
          </div>
        </aside>
      )}
    </div>
  );
}
