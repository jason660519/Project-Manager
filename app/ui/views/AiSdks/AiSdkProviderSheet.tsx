'use client';

// @table-classification: basic
// @table-reason: Operational AI SDKs provider/model/param sheet (dynamic columns, horizontal
//   overflow, repeated use). Compliant via useAiSdksTablePrefs (approved primitive) + numeric
//   freeze, category filters, search, sort, resize+persist, hidden cols, row density.

/**
 * One provider's editable parameter sheet — a wide TanStack v8 table:
 *   col-id (frozen) | col-provider | col-model | col-type | col-param-<key>…
 *
 * Implements the company Basic Table Sheet contract (see
 * `.project-manager/features/F43/README.md` for the classification + documented
 * exceptions): table-scoped debounced search, category filter with chips +
 * clear, freeze cols, column resize, density / per-row height, hide + restore
 * columns and rows, column & row right-click context menus (no ⋮ icons on headers/rows),
 * default/asc/desc sort arrows
 * with `aria-sort`, Reset view, and auto-saved view preferences
 * (`useAiSdksTablePrefs`). Row click / "View details" opens the metadata panel.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Info,
  Plus,
  RefreshCw,
  RotateCcw,
  Rows3,
  Snowflake,
  X,
} from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { ModelListState } from '../../../../lib/keys/providerMetadata';
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
import { EditableParamCell } from './EditableParamCell';
import { TableMenu, type TableMenuItem } from './TableMenu';
import {
  DENSITY_ROW_HEIGHT,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  useAiSdksTablePrefs,
  type RowDensity,
} from './useAiSdksTablePrefs';
import { useInAppPrompt } from '../../../../components/ui/InAppDialog';

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
  dynamicModels: readonly string[];
  modelListStatus: ModelListState;
  rescanBusy: boolean;
  onRescan: () => void;
  onSetParam: (id: string, key: string, value: ParamValue) => void;
  onSetModelType: (id: string, modelType: string) => void;
  onSetCandidate: (id: string, candidate: boolean) => void;
  onAddModel: (model: string) => void;
}

const columnHelper = createColumnHelper<AiSdkRow>();
const DENSITIES: readonly RowDensity[] = ['compact', 'comfortable', 'expanded'];

function replacePlaceholder(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), template);
}

function rangeText(spec: ParamSpec): string {
  if (spec.type === 'enum') return (spec.enumValues ?? []).join(' | ');
  if (spec.type === 'boolean') return 'true | false';
  if (spec.type === 'string') return '—';
  const min = spec.min !== undefined ? spec.min : '−∞';
  const max = spec.max !== undefined ? spec.max : '∞';
  return `${min} … ${max}`;
}

const CONTEXT_MENU_MARGIN = 8;
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_ITEM_HEIGHT = 30;
const CONTEXT_MENU_SEPARATOR_HEIGHT = 9;
const CONTEXT_MENU_VERTICAL_PADDING = 8;

function estimateContextMenuHeight(items: TableMenuItem[]) {
  return items.reduce(
    (height, item) =>
      height + ('separator' in item ? CONTEXT_MENU_SEPARATOR_HEIGHT : CONTEXT_MENU_ITEM_HEIGHT),
    CONTEXT_MENU_VERTICAL_PADDING,
  );
}

function getSafeContextMenuPosition(clientX: number, clientY: number, items: TableMenuItem[]) {
  if (typeof window === 'undefined') return { x: clientX, y: clientY };

  const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN);
  const maxY = Math.max(
    CONTEXT_MENU_MARGIN,
    window.innerHeight - estimateContextMenuHeight(items) - CONTEXT_MENU_MARGIN,
  );

  return {
    x: Math.max(CONTEXT_MENU_MARGIN, Math.min(clientX, maxX)),
    y: Math.max(CONTEXT_MENU_MARGIN, Math.min(clientY, maxY)),
  };
}

export function AiSdkProviderSheet({
  providerId,
  store,
  categories,
  readOnly,
  copy,
  dynamicModels,
  modelListStatus,
  rescanBusy,
  onRescan,
  onSetParam,
  onSetModelType,
  onSetCandidate,
  onAddModel,
}: AiSdkProviderSheetProps) {
  const resizePrompt = useInAppPrompt();
  const specs = useMemo(() => getParamSpecs(providerId), [providerId]);

  const rows = useMemo<AiSdkRow[]>(() => {
    const catalog = buildProviderModelCatalog(providerId, dynamicModels).map((entry) => ({
      id: entry.id,
      providerLabel: entry.providerLabel,
      model: entry.model,
      modelType: store.models[entry.id]?.modelType ?? entry.modelType,
      isCustom: false,
    }));
    const catalogIds = new Set(catalog.map((row) => row.id));
    const custom = store.customModels
      .filter((m) => m.providerId === providerId && !catalogIds.has(m.id))
      .map((m) => ({
        id: m.id,
        providerLabel: catalog[0]?.providerLabel ?? providerId,
        model: m.model,
        modelType: store.models[m.id]?.modelType ?? m.modelType ?? 'LLM',
        isCustom: true,
      }));
    return [...catalog, ...custom];
  }, [providerId, store, dynamicModels]);

  const columnIds = useMemo(
    () => ['col-id', 'col-candidate', 'col-provider', 'col-model', 'col-type', ...specs.map((s) => `col-param-${s.key}`)],
    [specs],
  );
  const defaultSizing = useMemo<Record<string, number>>(() => {
    const sizing: Record<string, number> = {
      'col-id': 240,
      'col-candidate': 120,
      'col-provider': 200,
      'col-model': 220,
      'col-type': 150,
    };
    specs.forEach((s) => {
      sizing[`col-param-${s.key}`] = 150;
    });
    return sizing;
  }, [specs]);

  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const prefs = useAiSdksTablePrefs({
    storageKey: `projectManager.aiSdks.${providerId}.tableView.v1`,
    columnIds,
    rowIds,
    defaultSizing,
    defaultFrozenColumnIds: ['col-id'],
  });
  const {
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    frozenColumnIds,
    setFrozenColumnIds,
    sorting,
    setSorting,
    typeFilter,
    setTypeFilter,
    density,
    setDensity,
    rowHeightById,
    setRowHeight,
    hiddenRowIds,
    setHiddenRowIds,
    resetView,
  } = prefs;

  // Table-scoped search with a 200 ms debounce (company 2.1).
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<
    | { type: 'column'; columnId: string; x: number; y: number }
    | { type: 'row'; rowId: string; x: number; y: number }
    | null
  >(null);

  const hiddenRowSet = useMemo(() => new Set(hiddenRowIds), [hiddenRowIds]);
  const filtersActive = typeFilter !== 'all' || search.trim() !== '';

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (hiddenRowSet.has(row.id)) return false;
      if (typeFilter !== 'all' && row.modelType !== typeFilter) return false;
      if (!keyword) return true;
      return [row.id, row.model, row.providerLabel, row.modelType]
        .join('\n')
        .toLowerCase()
        .includes(keyword);
    });
  }, [rows, search, typeFilter, hiddenRowSet]);

  const colLabel = useMemo(() => {
    const map = new Map<string, string>([
      ['col-id', copy.columns.id],
      ['col-candidate', copy.columns.candidate],
      ['col-provider', copy.columns.provider],
      ['col-model', copy.columns.model],
      ['col-type', copy.columns.type],
    ]);
    specs.forEach((s) => map.set(`col-param-${s.key}`, s.label));
    return map;
  }, [copy, specs]);

  // Row context-menu handlers — defined before `columns`, which closes over them.
  const hideRow = (rowId: string) => {
    if (filteredRows.length <= 1) return; // never hide the last visible row
    setHiddenRowIds((prev) => (prev.includes(rowId) ? prev : [...prev, rowId]));
  };
  const restoreRow = (rowId: string) =>
    setHiddenRowIds((prev) => prev.filter((id) => id !== rowId));
  const promptResizeRow = async (rowId: string) => {
    const current = rowHeightById[rowId] ?? DENSITY_ROW_HEIGHT[density];
    const input = await resizePrompt.open({
      title: copy.menu.resizeRow,
      message: replacePlaceholder(copy.menu.resizeRowPrompt, { min: MIN_ROW_HEIGHT, max: MAX_ROW_HEIGHT }),
      defaultValue: String(current),
    });
    if (input === null) return;
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return;
    setRowHeight(rowId, parsed);
  };

  // Columns close over per-render row handlers, so they are rebuilt each render
  // (the table is tiny — well under 20 rows — so this is cheap).
  const columns = [
      columnHelper.accessor((row) => row.id, {
        id: 'col-id',
        header: copy.columns.id,
        cell: (info) => (
          <span
            className="block truncate font-mono text-[11px] text-stone-400"
            title={`${providerId}:${info.row.original.model}`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      // Candidate checkbox — when checked, the model joins the AI Assistant's
      // candidate list (consumed there as a follow-up). Checkbox columns are not
      // sortable per company governance.
      columnHelper.display({
        id: 'col-candidate',
        header: copy.columns.candidate,
        cell: ({ row }) => {
          const checked = store.models[row.original.id]?.candidate === true;
          return (
            <input
              type="checkbox"
              checked={checked}
              disabled={readOnly}
              aria-label={`${copy.columns.candidate}: ${row.original.model}`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onSetCandidate(row.original.id, e.target.checked);
              }}
              className="h-4 w-4 cursor-pointer accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            />
          );
        },
      }),
      columnHelper.accessor((row) => row.providerLabel, {
        id: 'col-provider',
        header: copy.columns.provider,
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
  ];

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

  // ── Freeze offsets (mirrors KeysProviderTable) ────────────────────────────
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
      ? `${header ? 'z-50' : 'z-20'} bg-[rgb(var(--pm-rail))]/95 ${lastFrozenId === columnId ? 'shadow-[8px_0_14px_-12px_rgba(255,255,255,0.5)]' : ''}`
      : '';

  // ── View-control handlers ─────────────────────────────────────────────────
  const handleFreezeCountChange = (value: string) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed)
      ? Math.max(0, Math.min(freezeCandidateIds.length, Math.round(parsed)))
      : 0;
    setFrozenColumnIds(freezeCandidateIds.slice(0, next));
  };
  const freezeThrough = (columnId: string) => {
    const idx = freezeCandidateIds.indexOf(columnId);
    if (idx >= 0) setFrozenColumnIds(freezeCandidateIds.slice(0, idx + 1));
  };
  const promptResizeColumn = async (columnId: string) => {
    const current = columnSizing[columnId] ?? defaultSizing[columnId] ?? 150;
    const input = await resizePrompt.open({
      title: copy.menu.resizeColumn,
      message: replacePlaceholder(copy.menu.resizeColumnPrompt, { min: MIN_COLUMN_WIDTH, max: MAX_COLUMN_WIDTH }),
      defaultValue: String(current),
    });
    if (input === null) return;
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(parsed)));
    setColumnSizing((prev) => ({ ...prev, [columnId]: clamped }));
  };
  const hideColumn = (columnId: string) =>
    setColumnVisibility((prev) => ({ ...prev, [columnId]: false }));
  const restoreColumn = (columnId: string) =>
    setColumnVisibility((prev) => ({ ...prev, [columnId]: true }));
  const restoreAllColumns = () =>
    setColumnVisibility(Object.fromEntries(columnIds.map((id) => [id, true])));

  const handleResetView = () => {
    resetView();
    setSearchInput('');
    setSearch('');
  };
  const clearFilters = () => {
    setTypeFilter('all');
    setSearchInput('');
    setSearch('');
  };

  const hiddenColumnIds = columnIds.filter((id) => columnVisibility[id] === false);
  const visibleDataColCount = table.getVisibleLeafColumns().length;

  const columnMenuItems = (columnId: string): TableMenuItem[] => {
    const column = table.getColumn(columnId);
    const m = copy.menu;
    const items: TableMenuItem[] = [];
    if (column?.getCanSort()) {
      items.push({ key: 'asc', label: m.sortAsc, icon: <ArrowUp size={12} />, onSelect: () => column.toggleSorting(false) });
      items.push({ key: 'desc', label: m.sortDesc, icon: <ArrowDown size={12} />, onSelect: () => column.toggleSorting(true) });
      items.push({ key: 'reset-sort', label: m.resetSort, onSelect: () => column.clearSorting() });
      items.push({ key: 'sep-sort', separator: true });
    }
    if (columnId === 'col-type') {
      items.push({ key: 'f-all', label: copy.filters.allTypes, checked: typeFilter === 'all', onSelect: () => setTypeFilter('all') });
      categories.forEach((c) =>
        items.push({ key: `f-${c}`, label: c, checked: typeFilter === c, onSelect: () => setTypeFilter(c) }),
      );
      items.push({ key: 'sep-filter', separator: true });
    }
    items.push({ key: 'resize', label: m.resizeColumn, onSelect: () => void promptResizeColumn(columnId) });
    items.push({ key: 'freeze', label: m.freezeThrough, icon: <Snowflake size={12} />, onSelect: () => freezeThrough(columnId) });
    items.push({
      key: 'hide',
      label: m.hideColumn,
      icon: <EyeOff size={12} />,
      disabled: columnId === 'col-id' || visibleDataColCount <= 1,
      onSelect: () => hideColumn(columnId),
    });
    if (hiddenColumnIds.length > 0) {
      items.push({ key: 'restore-cols', label: m.restoreColumns, icon: <Eye size={12} />, onSelect: restoreAllColumns });
    }
    items.push({ key: 'sep-reset', separator: true });
    items.push({ key: 'reset-view', label: m.resetView, icon: <RotateCcw size={12} />, onSelect: handleResetView });
    return items;
  };

  const rowMenuItems = (rowId: string): TableMenuItem[] => {
    const m = copy.menu;
    const items: TableMenuItem[] = [
      { key: 'details', label: m.viewDetails, icon: <Info size={12} />, onSelect: () => setSelectedId(rowId) },
      { key: 'resize', label: m.resizeRow, onSelect: () => void promptResizeRow(rowId) },
      {
        key: 'hide',
        label: m.hideRow,
        icon: <EyeOff size={12} />,
        disabled: filteredRows.length <= 1,
        onSelect: () => hideRow(rowId),
      },
    ];
    if (hiddenRowIds.length > 0) {
      items.push({ key: 'sep-restore', separator: true });
      hiddenRowIds.forEach((id) =>
        items.push({
          key: `restore-${id}`,
          label: `${m.restoreRows}: ${rows.find((r) => r.id === id)?.model ?? id}`,
          icon: <Eye size={12} />,
          onSelect: () => restoreRow(id),
        }),
      );
      items.push({ key: 'restore-all', label: copy.controls.restoreAll, onSelect: () => setHiddenRowIds([]) });
    }
    return items;
  };

  const contextMenuItems = contextMenu
    ? contextMenu.type === 'column'
      ? columnMenuItems(contextMenu.columnId)
      : rowMenuItems(contextMenu.rowId)
    : [];
  const contextColumnId = contextMenu?.type === 'column' ? contextMenu.columnId : null;
  const contextRowId = contextMenu?.type === 'row' ? contextMenu.rowId : null;
  const contextTargetClass = 'outline outline-1 -outline-offset-1 outline-emerald-300/45 bg-emerald-500/10';

  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  const handleAddModel = async () => {
    const input = await resizePrompt.open({
      title: copy.controls.addModel,
      message: copy.controls.addModelPlaceholder,
      confirmLabel: copy.controls.addModel,
    });
    const value = input?.trim();
    if (value) onAddModel(value);
  };

  return (
    <div className="flex h-full min-h-0 w-full" onClick={() => setContextMenu(null)}>
      {/* min-w-0 lets this flex item clamp to the available width instead of
          growing to the table's content width — so the table pane (not the page)
          owns the horizontal scroll and the .pm-scroll bar becomes reachable. */}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
        {/* Toolbar: Search | Filters | Freeze | Hidden cols | Hidden rows | Density | Reset view | Dataset actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/12 bg-white/[0.02] px-4 py-3">
          <div className="relative">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={copy.controls.searchPlaceholder}
              className="h-8 w-56 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 pr-7 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
            {searchInput && (
              <button
                type="button"
                aria-label={copy.controls.searchClear}
                onClick={() => setSearchInput('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200"
              >
                <X size={13} />
              </button>
            )}
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

          {/* Hidden cols recovery */}
          <TableMenu
            triggerLabel={copy.controls.hiddenColumns}
            triggerClassName="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-300 hover:bg-white/[0.04] disabled:opacity-50"
            trigger={<span>{replacePlaceholder('{label} ({count})', { label: copy.controls.hiddenColumns, count: hiddenColumnIds.length })}</span>}
            align="left"
            items={
              hiddenColumnIds.length === 0
                ? [{ key: 'none', label: copy.menu.none, disabled: true, onSelect: () => {} }]
                : [
                    ...hiddenColumnIds.map((id) => ({
                      key: id,
                      label: colLabel.get(id) ?? id,
                      icon: <Eye size={12} />,
                      onSelect: () => restoreColumn(id),
                    })),
                    { key: 'sep', separator: true as const },
                    { key: 'all', label: copy.controls.restoreAll, onSelect: restoreAllColumns },
                  ]
            }
          />

          {/* Hidden rows recovery */}
          <TableMenu
            triggerLabel={copy.controls.hiddenRows}
            triggerClassName="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-300 hover:bg-white/[0.04]"
            trigger={<span>{replacePlaceholder('{label} ({count})', { label: copy.controls.hiddenRows, count: hiddenRowIds.length })}</span>}
            align="left"
            items={
              hiddenRowIds.length === 0
                ? [{ key: 'none', label: copy.menu.none, disabled: true, onSelect: () => {} }]
                : [
                    ...hiddenRowIds.map((id) => ({
                      key: id,
                      label: rows.find((r) => r.id === id)?.model ?? id,
                      icon: <Eye size={12} />,
                      onSelect: () => restoreRow(id),
                    })),
                    { key: 'sep', separator: true as const },
                    { key: 'all', label: copy.controls.restoreAll, onSelect: () => setHiddenRowIds([]) },
                  ]
            }
          />

          {/* Density (single dropdown) */}
          <div className="flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200">
            <Rows3 size={13} className="text-stone-400" />
            <select
              value={density}
              aria-label={copy.controls.density}
              title={copy.controls.density}
              onChange={(e) => setDensity(e.target.value as RowDensity)}
              className="h-6 bg-transparent text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
            >
              {DENSITIES.map((d) => (
                <option key={d} value={d} className="bg-stone-900">{copy.density[d]}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleResetView}
            title={copy.controls.resetViewTitle}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]"
          >
            <RotateCcw size={13} /> {copy.controls.resetView}
          </button>

          {/* Dataset actions — visually separated from view controls */}
          <div className="ml-auto flex flex-wrap items-center gap-2 border-l border-stone-200/12 pl-2">
            <span
              className={`max-w-[min(28rem,50vw)] truncate text-[10px] uppercase tracking-[0.12em] ${
                modelListStatus.kind === 'failed'
                  ? 'text-rose-400'
                  : modelListStatus.kind === 'stale'
                    ? 'text-amber-300/90'
                    : 'text-stone-500'
              }`}
              title={modelListStatus.detail}
            >
              {modelListStatus.label}
            </span>
            <button
              type="button"
              onClick={onRescan}
              disabled={readOnly || rescanBusy}
              title={copy.controls.rescanTitle}
              className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <RefreshCw size={13} className={rescanBusy ? 'animate-spin' : undefined} /> {copy.controls.rescan}
            </button>
            <button
              type="button"
              onClick={() => void handleAddModel()}
              disabled={readOnly}
              title={copy.controls.addModelTitle}
              className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <Plus size={13} /> {copy.controls.addModel}
            </button>
          </div>
        </div>

        {/* Active filter chips */}
        {filtersActive && (
          <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/10 bg-white/[0.01] px-4 py-2 text-[11px]">
            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 border border-amber-200/25 bg-amber-100/10 px-2 py-0.5 text-amber-100/90">
                {copy.columns.type}: {typeFilter}
                <button type="button" aria-label={copy.controls.clearFilters} onClick={() => setTypeFilter('all')} className="hover:text-white">
                  <X size={11} />
                </button>
              </span>
            )}
            {search.trim() && (
              <span className="inline-flex items-center gap-1 border border-stone-200/25 bg-white/[0.04] px-2 py-0.5 text-stone-200">
                “{search.trim()}”
                <button type="button" aria-label={copy.controls.searchClear} onClick={() => setSearchInput('')} className="hover:text-white">
                  <X size={11} />
                </button>
              </span>
            )}
            <button type="button" onClick={clearFilters} className="text-stone-400 underline-offset-2 hover:text-stone-100 hover:underline">
              {copy.controls.clearFilters}
            </button>
          </div>
        )}

        {/* Table */}
        <div className="pm-scroll min-h-0 flex-1 overflow-auto">
          <table className="table-fixed border-collapse text-left" style={{ width: table.getTotalSize() }}>
            <thead className="sticky top-0 z-40 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const ariaSort = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
                    return (
                      <th
                        key={header.id}
                        aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                        data-context-target={contextColumnId === header.column.id ? 'column' : undefined}
                        className={`relative overflow-hidden select-none border-r border-stone-200/10 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 ${frozenClass(header.column.id, true)} ${
                          contextColumnId === header.column.id ? contextTargetClass : ''
                        }`}
                        style={cellStyle(header.column.id)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          const items = columnMenuItems(header.column.id);
                          const position = getSafeContextMenuPosition(event.clientX, event.clientY, items);
                          setContextMenu({
                            type: 'column',
                            columnId: header.column.id,
                            x: position.x,
                            y: position.y,
                          });
                        }}
                      >
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          disabled={!header.column.getCanSort()}
                          className="flex w-full min-w-0 items-center gap-1.5 text-left disabled:cursor-default"
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {header.column.getCanSort() && (
                            <span className="shrink-0 text-stone-500">
                              {sorted === 'asc' ? (
                                <ArrowUp size={12} className="text-emerald-200" />
                              ) : sorted === 'desc' ? (
                                <ArrowDown size={12} className="text-emerald-200" />
                              ) : (
                                <ChevronsUpDown size={12} className="opacity-50" />
                              )}
                            </span>
                          )}
                        </button>
                        {header.column.getCanResize() && (
                          <button
                            type="button"
                            aria-label={`${copy.menu.resizeColumn} ${colLabel.get(header.column.id) ?? header.column.id}`}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-transparent hover:border-emerald-300/70 focus-visible:border-emerald-300"
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const height = rowHeightById[row.original.id] ?? DENSITY_ROW_HEIGHT[density];
                return (
                  <tr
                    key={row.id}
                    data-context-target={contextRowId === row.original.id ? 'row' : undefined}
                    onClick={() => setSelectedId(row.original.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const items = rowMenuItems(row.original.id);
                      const position = getSafeContextMenuPosition(event.clientX, event.clientY, items);
                      setContextMenu({
                        type: 'row',
                        rowId: row.original.id,
                        x: position.x,
                        y: position.y,
                      });
                    }}
                    style={{ height }}
                    className={`cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/[0.045] ${
                      selectedId === row.original.id ? 'bg-emerald-500/5' : ''
                    } ${contextRowId === row.original.id ? contextTargetClass : ''}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`relative isolate overflow-hidden border-r border-stone-200/10 px-3 py-1.5 align-middle text-sm text-stone-300 ${frozenClass(cell.column.id)} ${
                          contextColumnId === cell.column.id || contextRowId === row.original.id
                            ? contextTargetClass
                            : ''
                        }`}
                        style={cellStyle(cell.column.id)}
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
                    {rows.length === 0 ? (
                      copy.empty.noModels
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span>{copy.empty.noMatch}</span>
                        {(filtersActive || hiddenRowIds.length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              clearFilters();
                              setHiddenRowIds([]);
                            }}
                            className="border border-stone-200/20 px-2 py-1 text-stone-200 hover:bg-white/[0.04]"
                          >
                            {copy.empty.clearSearch}
                          </button>
                        )}
                      </div>
                    )}
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
          <div className="pm-scroll min-h-0 flex-1 overflow-auto p-3 text-xs">
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
      {contextMenu && (
        <div
          role="menu"
          aria-label={contextMenu.type === 'column' ? copy.menu.column : copy.menu.row}
          className="fixed z-50 min-w-[220px] border border-stone-200/20 bg-[rgb(var(--pm-panel))] py-1 text-xs text-stone-200 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenuItems.map((item) =>
            'separator' in item ? (
              <div key={item.key} role="separator" className="my-1 border-t border-stone-200/12" />
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect();
                  setContextMenu(null);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger
                    ? 'text-rose-200 hover:bg-rose-500/15'
                    : 'text-stone-200 hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-stone-400">
                  {item.icon ?? (item.checked ? '✓' : null)}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
      {resizePrompt.dialog}
    </div>
  );
}
