'use client';

/**
 * TanStack v8 table that lists every provider PM knows about, showing
 * at-a-glance: official provider links / configured / validated / model count
 * / last check.
 *
 * The parent (`ApiKeyValidationSheet`) owns provider row data, persistence,
 * and detail-sheet actions. This component owns table-scoped controls:
 * search, filters, sorting, resize, freeze, hidden columns, presets, import,
 * export, Add Row, delete/hide row, and row reorder.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  ExternalLink,
  Import,
  KeyRound,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldQuestion,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

import type { ProviderSpec } from '../../../../lib/keys/registry';
import {
  classifyValidationFailure,
  formatRelativeTime,
  type ModelListState,
} from '../../../../lib/keys/providerMetadata';
import type { Translations } from '../../../../lib/i18n';
import {
  buildCsv,
  downloadTextFile,
  useArenaTablePrefs,
  type ArenaTablePreset,
} from './ArenaTableViewControls';

export type KeysRowStatus = 'verified' | 'configured' | 'not_set' | 'failed';
type KeysValidationTableCopy = Translations['keysValidation']['table'];

export interface KeysRowData {
  provider: ProviderSpec;
  isCustom?: boolean;
  hasKey: boolean;
  maskedKey: string | null;
  status: KeysRowStatus;
  models: string[];
  modelsAreDynamic: boolean;
  modelListState: ModelListState;
  canRefreshModels: boolean;
  lastValidatedAt: string | null;
  errorReason: string | null;
}

interface KeysProviderTableProps {
  rows: KeysRowData[];
  hiddenBuiltInCount?: number;
  onRowClick: (provider: ProviderSpec) => void;
  onAddRow: () => void;
  onMoveRow: (providerId: string, direction: 'up' | 'down') => void;
  onDeleteRow: (providerId: string) => void;
  onPatchCustomProvider: (providerId: string, patch: Partial<ProviderSpec>) => void;
  onRefreshModels: (provider: ProviderSpec) => void;
  isRefreshingModels: boolean;
  onImportRows: (text: string) => void;
  onShowAllRows: () => void;
  copy: KeysValidationTableCopy;
}

const columnHelper = createColumnHelper<KeysRowData>();
const API_KEYS_STORAGE_KEY = 'projectManager.keys.apiKeyValidation.tablePrefs.v1';
const API_KEYS_COLUMN_IDS = [
  'col-provider',
  'col-category',
  'col-api-key-url',
  'col-usage-url',
  'col-developer-docs-url',
  'col-key',
  'col-status',
  'col-model-count',
  'col-model-state',
  'col-model-list',
  'col-last-validated',
  'col-actions',
];

const API_KEYS_DEFAULT_SIZING: Record<string, number> = {
  'col-provider': 240,
  'col-category': 130,
  'col-api-key-url': 170,
  'col-usage-url': 160,
  'col-developer-docs-url': 160,
  'col-key': 180,
  'col-status': 170,
  'col-model-count': 110,
  'col-model-state': 160,
  'col-model-list': 310,
  'col-last-validated': 150,
  'col-actions': 230,
};

const API_KEYS_PRESETS: ArenaTablePreset[] = [
  { id: 'full', label: 'Full', frozenColumnIds: ['col-provider'] },
  {
    id: 'validation',
    label: 'Validation',
    frozenColumnIds: ['col-provider'],
    columnVisibility: Object.fromEntries(
      API_KEYS_COLUMN_IDS.map((id) => [
        id,
        !['col-api-key-url', 'col-usage-url', 'col-developer-docs-url', 'col-model-list'].includes(id),
      ]),
    ),
  },
  {
    id: 'links',
    label: 'Links',
    frozenColumnIds: ['col-provider'],
    columnVisibility: Object.fromEntries(
      API_KEYS_COLUMN_IDS.map((id) => [
        id,
        !['col-key', 'col-model-list', 'col-last-validated'].includes(id),
      ]),
    ),
  },
];

function assertNever(value: never): never {
  throw new Error(`Unhandled KeysRowStatus: ${String(value)}`);
}

function StatusCell({ row, copy }: { row: KeysRowData; copy: KeysValidationTableCopy }) {
  const failure = row.errorReason ? classifyValidationFailure(row.errorReason) : null;
  switch (row.status) {
    case 'verified':
      return (
        <span
          className="inline-flex items-center gap-1.5 border border-emerald-200/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/90"
          title={row.lastValidatedAt ? `Validated ${formatRelativeTime(row.lastValidatedAt)}` : undefined}
        >
          <CheckCircle2 size={11} /> {copy.status.verified}
        </span>
      );
    case 'failed':
      return (
        <div className="max-w-[220px]">
          <span
            className="inline-flex items-center gap-1.5 border border-rose-300/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-rose-300"
            title={failure ? `${failure.label}: ${failure.detail}` : undefined}
          >
            <AlertTriangle size={11} /> {copy.status.failed}
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
          <ShieldQuestion size={11} /> {copy.status.configured}
        </span>
      );
    case 'not_set':
      return (
        <span className="inline-flex items-center gap-1.5 border border-stone-200/18 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
          <ShieldQuestion size={11} /> {copy.status.notSet}
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

function ProviderLinkCell({
  href,
  label,
  title,
}: {
  href: string;
  label: string;
  title: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-w-max items-center gap-1.5 border border-stone-200/18 px-2 py-1 text-[11px] text-stone-300 transition-colors hover:border-emerald-200/35 hover:bg-emerald-100/10 hover:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
    >
      <span>{label}</span>
      <ExternalLink size={11} aria-hidden="true" />
    </a>
  );
}

function EditableTextCell({
  value,
  onCommit,
  placeholder,
  monospace = false,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onCommit(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      className={`w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50 ${monospace ? 'font-mono' : ''}`}
    />
  );
}

function replacePlaceholder(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function ModelsPreviewCell({ models, copy }: { models: string[]; copy: KeysValidationTableCopy }) {
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
          className="rounded-sm border border-stone-700 bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] text-stone-300"
        >
          {m}
        </span>
      ))}
      {remainder > 0 && (
        <span className="px-1.5 py-0.5 font-mono text-[10px] text-stone-500">
          {replacePlaceholder(copy.moreModels, { count: remainder })}
        </span>
      )}
    </div>
  );
}

function ModelListStateCell({ state }: { state: ModelListState }) {
  const className =
    state.kind === 'refreshed'
      ? 'border-emerald-200/25 bg-emerald-500/10 text-emerald-200'
      : state.kind === 'stale'
        ? 'border-amber-200/25 bg-amber-500/10 text-amber-100'
        : state.kind === 'failed'
          ? 'border-rose-300/30 bg-rose-500/10 text-rose-200'
          : 'border-stone-200/18 bg-stone-200/5 text-stone-300';

  return (
    <span
      className={`inline-flex max-w-full items-center border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${className}`}
      title={state.detail}
    >
      <span className="truncate">{state.label}</span>
    </span>
  );
}

function SortMarker({ value }: { value: false | 'asc' | 'desc' }) {
  if (value === 'asc') return <span className="text-emerald-200">↑</span>;
  if (value === 'desc') return <span className="text-emerald-200">↓</span>;
  return null;
}

export function KeysProviderTable({
  rows,
  hiddenBuiltInCount = 0,
  onRowClick,
  onAddRow,
  onMoveRow,
  onDeleteRow,
  onPatchCustomProvider,
  onRefreshModels,
  isRefreshingModels,
  onImportRows,
  onShowAllRows,
  copy,
}: KeysProviderTableProps) {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'ai' | 'integration'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | KeysRowStatus>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const columnOptions = useMemo(
    () => [
      { id: 'col-provider', label: copy.columns.provider, freezable: true },
      { id: 'col-category', label: copy.columns.category, hideable: true },
      { id: 'col-api-key-url', label: copy.columns.apiKeyPage, hideable: true },
      { id: 'col-usage-url', label: copy.columns.usage, hideable: true },
      { id: 'col-developer-docs-url', label: copy.columns.docs, hideable: true },
      { id: 'col-key', label: copy.columns.key, hideable: true },
      { id: 'col-status', label: copy.columns.status, hideable: true, freezable: true },
      { id: 'col-model-count', label: copy.columns.models, hideable: true },
      { id: 'col-model-state', label: 'Model list', hideable: true },
      { id: 'col-model-list', label: copy.columns.availableModels, hideable: true },
      { id: 'col-last-validated', label: copy.columns.lastValidated, hideable: true },
      { id: 'col-actions', label: copy.columns.actions, freezable: true },
    ],
    [copy],
  );
  const localizedPresets = useMemo<ArenaTablePreset[]>(
    () => API_KEYS_PRESETS.map((preset) => ({
      ...preset,
      label: preset.id === 'full'
        ? copy.presets.full
        : preset.id === 'validation'
          ? copy.presets.validation
          : copy.presets.links,
    })),
    [copy],
  );
  const {
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    frozenColumnIds,
    setFrozenColumnIds,
    resetPrefs,
    applyPreset,
  } = useArenaTablePrefs({
    storageKey: API_KEYS_STORAGE_KEY,
    columnIds: API_KEYS_COLUMN_IDS,
    defaultSizing: API_KEYS_DEFAULT_SIZING,
    defaultFrozenColumnIds: ['col-provider'],
  });

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter !== 'all' && row.provider.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!keyword) return true;
      return [
        row.provider.id,
        row.provider.label,
        row.provider.category,
        row.maskedKey ?? '',
        row.status,
        row.models.join(' '),
        row.errorReason ?? '',
      ].join('\n').toLowerCase().includes(keyword);
    });
  }, [rows, searchText, categoryFilter, statusFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.provider.label, {
        id: 'col-provider',
        header: copy.columns.provider,
        size: API_KEYS_DEFAULT_SIZING['col-provider'],
        cell: (info) => {
          const original = info.row.original;
          return original.isCustom ? (
            <EditableTextCell
              value={original.provider.label}
              placeholder="Custom provider"
              onCommit={(label) => onPatchCustomProvider(original.provider.id, { label })}
            />
          ) : (
            <ProviderCell provider={original.provider} />
          );
        },
      }),
      columnHelper.accessor((row) => row.provider.category, {
        id: 'col-category',
        header: copy.columns.category,
        size: API_KEYS_DEFAULT_SIZING['col-category'],
        cell: (info) => {
          const original = info.row.original;
          if (original.isCustom) {
            return (
              <select
                value={original.provider.category}
                onChange={(event) => onPatchCustomProvider(original.provider.id, { category: event.target.value as ProviderSpec['category'] })}
                onClick={(event) => event.stopPropagation()}
                className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none"
              >
                <option value="ai" className="bg-stone-900">{copy.category.ai}</option>
                <option value="integration" className="bg-stone-900">{copy.category.integration}</option>
              </select>
            );
          }
          return (
            <span className="inline-flex rounded-sm border border-amber-200/20 bg-amber-100/10 px-2 py-0.5 text-[11px] text-amber-100/90">
              {original.provider.category === 'ai' ? copy.category.ai : copy.category.integration}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.provider.apiKeyUrl, {
        id: 'col-api-key-url',
        header: copy.columns.apiKeyPage,
        size: API_KEYS_DEFAULT_SIZING['col-api-key-url'],
        cell: (info) => (
          info.row.original.isCustom ? (
            <EditableTextCell
              value={info.getValue()}
              placeholder="https://..."
              monospace
              onCommit={(apiKeyUrl) => onPatchCustomProvider(info.row.original.provider.id, { apiKeyUrl, docUrl: apiKeyUrl })}
            />
          ) : (
            <ProviderLinkCell
              href={info.getValue()}
              label={copy.links.apiKeyPage}
              title={replacePlaceholder(copy.links.apiKeyTitle, { provider: info.row.original.provider.label })}
            />
          )
        ),
      }),
      columnHelper.accessor((row) => row.provider.usageUrl, {
        id: 'col-usage-url',
        header: copy.columns.usage,
        size: API_KEYS_DEFAULT_SIZING['col-usage-url'],
        cell: (info) => (
          info.row.original.isCustom ? (
            <EditableTextCell
              value={info.getValue()}
              placeholder="https://..."
              monospace
              onCommit={(usageUrl) => onPatchCustomProvider(info.row.original.provider.id, { usageUrl })}
            />
          ) : (
            <ProviderLinkCell
              href={info.getValue()}
              label={copy.links.usage}
              title={replacePlaceholder(copy.links.usageTitle, { provider: info.row.original.provider.label })}
            />
          )
        ),
      }),
      columnHelper.accessor((row) => row.provider.developerDocsUrl, {
        id: 'col-developer-docs-url',
        header: copy.columns.docs,
        size: API_KEYS_DEFAULT_SIZING['col-developer-docs-url'],
        cell: (info) => (
          info.row.original.isCustom ? (
            <EditableTextCell
              value={info.getValue()}
              placeholder="https://..."
              monospace
              onCommit={(developerDocsUrl) => onPatchCustomProvider(info.row.original.provider.id, { developerDocsUrl })}
            />
          ) : (
            <ProviderLinkCell
              href={info.getValue()}
              label={copy.links.docs}
              title={replacePlaceholder(copy.links.docsTitle, { provider: info.row.original.provider.label })}
            />
          )
        ),
      }),
      columnHelper.accessor((row) => row.maskedKey, {
        id: 'col-key',
        header: copy.columns.key,
        size: API_KEYS_DEFAULT_SIZING['col-key'],
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
        id: 'col-status',
        header: copy.columns.status,
        size: API_KEYS_DEFAULT_SIZING['col-status'],
        cell: (info) => <StatusCell row={info.row.original} copy={copy} />,
      }),
      columnHelper.accessor((row) => row.models.length, {
        id: 'col-model-count',
        header: copy.columns.models,
        size: API_KEYS_DEFAULT_SIZING['col-model-count'],
        cell: (info) => {
          const count = info.getValue();
          if (count === 0) return <span className="text-stone-500">—</span>;
          return (
            <span className="font-mono text-xs text-stone-200">
              {count}
              {info.row.original.modelsAreDynamic && (
                <span className="ml-1 text-[9px] uppercase tracking-[0.14em] text-emerald-400/70">
                  {copy.live}
                </span>
              )}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.models.join('\n'), {
        id: 'col-model-list',
        header: copy.columns.availableModels,
        size: API_KEYS_DEFAULT_SIZING['col-model-list'],
        cell: (info) => <ModelsPreviewCell models={info.row.original.models} copy={copy} />,
      }),
      columnHelper.accessor((row) => row.modelListState.label, {
        id: 'col-model-state',
        header: 'Model list',
        size: API_KEYS_DEFAULT_SIZING['col-model-state'],
        sortingFn: (a, b) => a.original.modelListState.label.localeCompare(b.original.modelListState.label),
        cell: (info) => <ModelListStateCell state={info.row.original.modelListState} />,
      }),
      columnHelper.accessor((row) => row.lastValidatedAt, {
        id: 'col-last-validated',
        header: copy.columns.lastValidated,
        size: API_KEYS_DEFAULT_SIZING['col-last-validated'],
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
        id: 'col-actions',
        header: copy.columns.actions,
        size: API_KEYS_DEFAULT_SIZING['col-actions'],
        enableSorting: false,
        cell: (info) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRefreshModels(info.row.original.provider);
              }}
              disabled={!info.row.original.canRefreshModels || isRefreshingModels}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10 disabled:cursor-not-allowed disabled:opacity-35"
              title="Refresh Models list"
            >
              {isRefreshingModels ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMoveRow(info.row.original.provider.id, 'up');
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10"
              title={copy.actions.moveRowUp}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMoveRow(info.row.original.provider.id, 'down');
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10"
              title={copy.actions.moveRowDown}
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteRow(info.row.original.provider.id);
              }}
              className="inline-flex items-center gap-1 rounded-sm border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
              title={info.row.original.isCustom ? copy.actions.deleteCustomRow : copy.actions.hideProviderRow}
            >
              <Trash2 size={13} />
              {copy.actions.delete}
            </button>
          </div>
        ),
      }),
    ],
    [copy, isRefreshingModels, onDeleteRow, onMoveRow, onPatchCustomProvider, onRefreshModels],
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

  const visibleColumns = table.getVisibleLeafColumns();
  const frozenVisibleIds = frozenColumnIds.filter((id) => table.getColumn(id)?.getIsVisible());
  const frozenLeftOffsets = new Map<string, number>();
  let left = 0;
  visibleColumns.forEach((column) => {
    if (!frozenVisibleIds.includes(column.id)) return;
    frozenLeftOffsets.set(column.id, left);
    left += column.getSize();
  });
  const lastFrozenId = frozenVisibleIds[frozenVisibleIds.length - 1];
  const hiddenColumnCount = columnOptions.filter((option) => option.hideable && table.getColumn(option.id)?.getIsVisible() === false).length;

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

  const frozenClass = (columnId: string, header = false) => (
    frozenVisibleIds.includes(columnId)
      ? `${header ? 'z-30' : 'z-20'} bg-[rgb(var(--pm-rail))]/95 ${lastFrozenId === columnId ? 'shadow-[8px_0_14px_-12px_rgba(255,255,255,0.5)]' : ''}`
      : ''
  );

  const handleExport = () => {
    const exportRows = table.getRowModel().rows.map(({ original }) => ({
      id: original.provider.id,
      label: original.provider.label,
      category: original.provider.category,
      status: original.status,
      has_key: original.hasKey ? 'yes' : 'no',
      model_count: original.models.length,
      model_list_state: original.modelListState.label,
      api_key_url: original.provider.apiKeyUrl,
      usage_url: original.provider.usageUrl,
      developer_docs_url: original.provider.developerDocsUrl,
      last_validated_at: original.lastValidatedAt ?? '',
      custom: original.isCustom ? 'yes' : 'no',
    }));
    downloadTextFile(
      'api-key-validation-providers.csv',
      buildCsv(exportRows, [
        { key: 'id', label: 'id' },
        { key: 'label', label: 'label' },
        { key: 'category', label: 'category' },
        { key: 'status', label: 'status' },
        { key: 'has_key', label: 'has_key' },
        { key: 'model_count', label: 'model_count' },
        { key: 'model_list_state', label: 'model_list_state' },
        { key: 'api_key_url', label: 'api_key_url' },
        { key: 'usage_url', label: 'usage_url' },
        { key: 'developer_docs_url', label: 'developer_docs_url' },
        { key: 'last_validated_at', label: 'last_validated_at' },
        { key: 'custom', label: 'custom' },
      ]),
    );
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onImportRows(await file.text());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/12 bg-white/[0.02] px-4 py-3">
        <h2 className="shrink-0 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
          {copy.controls.title}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={copy.controls.searchPlaceholder}
            className="h-8 w-64 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">{copy.category.all}</option>
            <option value="ai" className="bg-stone-900">{copy.category.ai}</option>
            <option value="integration" className="bg-stone-900">{copy.category.integration}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">{copy.status.all}</option>
            <option value="verified" className="bg-stone-900">{copy.status.verified}</option>
            <option value="configured" className="bg-stone-900">{copy.status.configured}</option>
            <option value="failed" className="bg-stone-900">{copy.status.failed}</option>
            <option value="not_set" className="bg-stone-900">{copy.status.notSet}</option>
          </select>
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
              <Settings2 size={13} /> {replacePlaceholder(copy.controls.hiddenColumns, { count: hiddenColumnCount })}
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-56 border border-stone-200/15 bg-stone-950 p-2 shadow-xl">
              {columnOptions.filter((option) => option.hideable).map((option) => (
                <label key={option.id} className="flex items-center gap-2 px-2 py-1 text-xs text-stone-300">
                  <input
                    type="checkbox"
                    checked={table.getColumn(option.id)?.getIsVisible() ?? true}
                    onChange={(event) => table.getColumn(option.id)?.toggleVisibility(event.target.checked)}
                    className="accent-emerald-400"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </details>
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
              {copy.controls.freezeColumns}
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-56 border border-stone-200/15 bg-stone-950 p-2 shadow-xl">
              {columnOptions.filter((option) => option.freezable).map((option) => (
                <label key={option.id} className="flex items-center gap-2 px-2 py-1 text-xs text-stone-300">
                  <input
                    type="checkbox"
                    checked={frozenColumnIds.includes(option.id)}
                    onChange={(event) => {
                      setFrozenColumnIds((prev) => (
                        event.target.checked
                          ? [...prev, option.id]
                          : prev.filter((id) => id !== option.id)
                      ));
                    }}
                    className="accent-emerald-400"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </details>
          <select
            onChange={(event) => {
              const preset = localizedPresets.find((item) => item.id === event.target.value);
              if (preset) applyPreset(preset);
              event.currentTarget.value = '';
            }}
            defaultValue=""
            aria-label={copy.controls.viewPreset}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="" disabled className="bg-stone-900">{copy.controls.presetPlaceholder}</option>
            {localizedPresets.map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-stone-900">{preset.label}</option>
            ))}
          </select>
          <button onClick={resetPrefs} className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
            <RotateCcw size={13} /> {copy.controls.reset}
          </button>
          {hiddenBuiltInCount > 0 && (
            <button onClick={onShowAllRows} className="inline-flex h-8 items-center gap-1 border border-amber-200/25 px-2 text-xs text-amber-100 hover:bg-amber-100/10">
              {replacePlaceholder(copy.controls.showHiddenRows, { count: hiddenBuiltInCount })}
            </button>
          )}
          <button onClick={handleExport} className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
            <Download size={13} /> {copy.controls.export}
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]"
          >
            <Import size={13} /> {copy.controls.import}
          </button>
          <input ref={importInputRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={handleImportFile} className="hidden" />
          <button
            onClick={onAddRow}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/22 px-3 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors"
          >
            <Plus size={12} /> {copy.controls.addRow}
          </button>
        </div>
      </div>
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
                      <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      <SortMarker value={header.column.getIsSorted()} />
                    </button>
                    {header.column.getCanResize() && (
                      <button
                        type="button"
                        aria-label={`Resize ${String(header.column.columnDef.header ?? header.column.id)}`}
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
                onClick={() => onRowClick(row.original.provider)}
                className="cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/[0.045]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`relative isolate border-r border-stone-200/10 px-4 py-3 align-middle text-sm text-stone-300 ${frozenClass(cell.column.id)}`}
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
                  <KeyRound size={14} className="mx-auto mb-2 opacity-60" />
                  {rows.length === 0 ? copy.noProviders : copy.noProvidersMatch}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
