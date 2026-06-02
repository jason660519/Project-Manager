'use client';

// @table-classification: basic
// @table-reason: API Key Validation provider matrix — operational, horizontally scrolling,
//   repeated use. Compliant: useArenaTablePrefs + numeric Freeze cols, per-header
//   provider/category/status/model filters, search, sort arrows, resize+persist, hidden cols.
//   This is the reference numeric-freeze implementation.

/**
 * TanStack v8 table that lists every provider PM knows about, showing
 * at-a-glance: official provider links / configured / validated / model count
 * / last check.
 *
 * The parent (`ApiKeyValidationSheet`) owns provider row data, persistence,
 * and detail-sheet actions. This component owns table-scoped controls:
 * search, column-header filters, sorting, resize, freeze, restore providers,
 * Add Row, delete/hide row, and row reorder.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cog,
  DollarSign,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldQuestion,
  Snowflake,
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
  useArenaTablePrefs,
} from './ArenaTableViewControls';

export type KeysRowStatus = 'verified' | 'configured' | 'not_set' | 'failed';
type ProviderDisplayCategory = 'model_factory' | 'model_channel' | 'local_model' | 'integration';
type KeysValidationTableCopy = Translations['keysValidation']['table'];

export interface KeysRowData {
  rowId: string;
  provider: ProviderSpec;
  isCustom?: boolean;
  active: boolean;
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
  onRestoreDefaultProviders: () => void;
  onPatchCustomProvider: (providerId: string, patch: Partial<ProviderSpec>) => void;
  onUpdateProviderActive: (provider: ProviderSpec, active: boolean) => Promise<void>;
  onDeleteProvider: (provider: ProviderSpec) => Promise<void>;
  onUpdateKey: (provider: ProviderSpec, apiKey: string) => Promise<void>;
  onRefreshModels: (provider: ProviderSpec) => void;
  refreshingProviderIds: Set<string>;
  onShowAllRows: () => void;
  copy: KeysValidationTableCopy;
}

const columnHelper = createColumnHelper<KeysRowData>();
const API_KEYS_STORAGE_KEY = 'projectManager.keys.apiKeyValidation.tablePrefs.v1';
const API_KEYS_COLUMN_IDS = [
  'col-id',
  'col-active',
  'col-provider',
  'col-category',
  'col-key-var-name',
  'col-key-value',
  'col-status',
  'col-model-list',
  'col-last-validated',
  'col-actions',
];

const API_KEYS_DEFAULT_SIZING: Record<string, number> = {
  'col-id': 260,
  'col-active': 96,
  'col-provider': 300,
  'col-category': 130,
  'col-key-var-name': 180,
  'col-key-value': 180,
  'col-status': 210,
  'col-model-list': 310,
  'col-last-validated': 150,
  'col-actions': 96,
};

function assertNever(value: never): never {
  throw new Error(`Unhandled KeysRowStatus: ${String(value)}`);
}

function StatusRefreshButton({
  row,
  isRefreshing,
  onRefreshModels,
}: {
  row: KeysRowData;
  isRefreshing: boolean;
  onRefreshModels: (provider: ProviderSpec) => void;
}) {
  if (!row.canRefreshModels) return null;
  const label = `Re-verify ${row.provider.label} and refresh available models`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onRefreshModels(row.provider);
      }}
      disabled={isRefreshing}
      className="inline-flex h-6 w-6 items-center justify-center border border-stone-200/18 bg-stone-200/5 text-stone-300 hover:bg-stone-200/10 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
    </button>
  );
}

function StatusCell({
  row,
  copy,
  isRefreshing,
  onRefreshModels,
}: {
  row: KeysRowData;
  copy: KeysValidationTableCopy;
  isRefreshing: boolean;
  onRefreshModels: (provider: ProviderSpec) => void;
}) {
  const failure = row.errorReason ? classifyValidationFailure(row.errorReason) : null;
  const refreshButton = (
    <StatusRefreshButton
      row={row}
      isRefreshing={isRefreshing}
      onRefreshModels={onRefreshModels}
    />
  );
  switch (row.status) {
    case 'verified':
      return (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 border border-emerald-200/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/90"
            title={row.lastValidatedAt ? `Validated ${formatRelativeTime(row.lastValidatedAt)}` : undefined}
          >
            <CheckCircle2 size={11} /> {copy.status.verified}
          </span>
          {refreshButton}
        </div>
      );
    case 'failed':
      return (
        <div className="flex max-w-[220px] items-start gap-1.5">
          <div className="min-w-0">
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
          {refreshButton}
        </div>
      );
    case 'configured':
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 border border-amber-200/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-300/90">
            <ShieldQuestion size={11} /> {copy.status.configured}
          </span>
          {refreshButton}
        </div>
      );
    case 'not_set':
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 border border-stone-200/18 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
            <ShieldQuestion size={11} /> {copy.status.notSet}
          </span>
          {refreshButton}
        </div>
      );
    default:
      return assertNever(row.status);
  }
}

function ProviderIconLink({
  href,
  label,
  title,
  children,
}: {
  href: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={title}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-6 w-6 items-center justify-center border border-stone-200/18 text-stone-400 transition-colors hover:border-emerald-200/35 hover:bg-emerald-100/10 hover:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-300/50"
    >
      {children}
    </a>
  );
}

function ProviderCell({ row, copy }: { row: KeysRowData; copy: KeysValidationTableCopy }) {
  const { provider } = row;
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center">
        <span className="truncate font-medium text-stone-100">{provider.label}</span>
      </div>
      <ProviderLinks row={row} copy={copy} />
    </div>
  );
}

function ProviderModelListStateIcon({ state }: { state: ModelListState }) {
  const stateClassName =
    state.kind === 'refreshed'
      ? 'border-emerald-200/30 text-emerald-300'
      : state.kind === 'stale'
        ? 'border-amber-200/30 text-amber-200'
        : state.kind === 'failed'
          ? 'border-rose-300/35 text-rose-200'
          : 'border-stone-200/18 text-stone-400';

  return (
    <span
      aria-label={`Model list: ${state.label}`}
      title={state.detail}
      className={`inline-flex h-6 w-6 items-center justify-center border ${stateClassName}`}
    >
      <Cog size={12} aria-hidden="true" />
    </span>
  );
}

function ProviderModelCount({ row, copy }: { row: KeysRowData; copy: KeysValidationTableCopy }) {
  const title = `${copy.columns.models}: ${row.models.length}${row.modelsAreDynamic ? ` ${copy.live}` : ''}`;
  return (
    <span
      aria-label={title}
      title={title}
      className="inline-flex h-6 min-w-6 items-center justify-center border border-stone-200/18 px-1.5 font-mono text-[11px] text-stone-300"
    >
      {row.models.length}
    </span>
  );
}

function ProviderLinks({ row, copy }: { row: KeysRowData; copy: KeysValidationTableCopy }) {
  const { provider } = row;
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <ProviderModelListStateIcon state={row.modelListState} />
      <ProviderIconLink
        href={provider.apiKeyUrl}
        label={copy.links.apiKeyPage}
        title={replacePlaceholder(copy.links.apiKeyTitle, { provider: provider.label })}
      >
        <KeyRound size={12} aria-hidden="true" />
      </ProviderIconLink>
      <ProviderIconLink
        href={provider.usageUrl}
        label={copy.links.usage}
        title={replacePlaceholder(copy.links.usageTitle, { provider: provider.label })}
      >
        <DollarSign size={12} aria-hidden="true" />
      </ProviderIconLink>
      <ProviderIconLink
        href={provider.developerDocsUrl}
        label={copy.links.docs}
        title={replacePlaceholder(copy.links.docsTitle, { provider: provider.label })}
      >
        <BookOpen size={12} aria-hidden="true" />
      </ProviderIconLink>
      <ProviderModelCount row={row} copy={copy} />
    </div>
  );
}

function CustomProviderCell({
  row,
  copy,
  onPatchCustomProvider,
}: {
  row: KeysRowData;
  copy: KeysValidationTableCopy;
  onPatchCustomProvider: (providerId: string, patch: Partial<ProviderSpec>) => void;
}) {
  const { provider } = row;
  return (
    <div className="min-w-0">
      <EditableTextCell
        value={provider.label}
        placeholder="Custom provider"
        onCommit={(label) => onPatchCustomProvider(provider.id, { label })}
      />
      <ProviderLinks row={row} copy={copy} />
    </div>
  );
}

function getProviderDisplayCategory(provider: ProviderSpec): ProviderDisplayCategory {
  if (provider.category === 'integration') return 'integration';
  if (['openrouter', 'perplexity', 'together', 'ollama-cloud'].includes(provider.id)) {
    return 'model_channel';
  }
  if (['ollama-local', 'lm-studio', 'llm-studio', 'llama-cpp', 'llamacpp'].includes(provider.id)) {
    return 'local_model';
  }
  return 'model_factory';
}

function getProviderDisplayCategoryLabel(provider: ProviderSpec, copy: KeysValidationTableCopy) {
  const category = getProviderDisplayCategory(provider);
  switch (category) {
    case 'model_factory':
      return copy.category.modelFactory;
    case 'model_channel':
      return copy.category.modelChannel;
    case 'local_model':
      return copy.category.localModel;
    case 'integration':
      return copy.category.integration;
    default:
      return assertNever(category);
  }
}

function defaultKeyVarName(provider: ProviderSpec): string {
  return provider.envVarNames[0] ?? provider.keychainKey;
}

function ActiveCell({
  row,
  onUpdateProviderActive,
}: {
  row: KeysRowData;
  onUpdateProviderActive: (provider: ProviderSpec, active: boolean) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const toggle = async (checked: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await onUpdateProviderActive(row.provider, checked);
    } finally {
      setSaving(false);
    }
  };
  return (
    <label
      className="inline-flex items-center gap-2 text-[11px] text-stone-300"
      onClick={(event) => event.stopPropagation()}
      title={row.active ? 'Active provider' : 'Inactive provider'}
    >
      <input
        type="checkbox"
        checked={row.active}
        disabled={saving}
        aria-label={`Active: ${row.provider.label}`}
        onChange={(event) => void toggle(event.target.checked)}
        className="h-4 w-4 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
      />
      <span className={row.active ? 'text-emerald-300/90' : 'text-stone-500'}>
        {row.active ? 'Active' : 'Off'}
      </span>
    </label>
  );
}

function DeleteProviderCell({
  row,
  copy,
  onRequestDelete,
}: {
  row: KeysRowData;
  copy: KeysValidationTableCopy;
  onRequestDelete: (row: KeysRowData) => void;
}) {
  const label = row.isCustom ? copy.actions.deleteCustomRow : copy.actions.hideProviderRow;
  return (
    <button
      type="button"
      aria-label={`${label}: ${row.provider.label}`}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onRequestDelete(row);
      }}
      className="inline-flex h-7 items-center gap-1.5 border border-rose-300/25 px-2 text-[11px] text-rose-200 hover:bg-rose-950/35 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Trash2 size={12} />
      {copy.actions.delete}
    </button>
  );
}

function DeleteProviderConfirmDialog({
  row,
  copy,
  deleting,
  onCancel,
  onConfirm,
}: {
  row: KeysRowData;
  copy: KeysValidationTableCopy;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title = row.isCustom ? copy.actions.deleteCustomRow : copy.actions.hideProviderRow;
  const message = row.isCustom
    ? `Delete ${row.provider.label}? This clears its saved key and validation metadata.`
    : `Remove ${row.provider.label} from this list? This hides the row, turns Active off, and clears its saved key and validation metadata.`;
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={deleting ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keys-delete-provider-title"
        className="w-full max-w-md border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-200/12 px-4 py-3">
          <h3 id="keys-delete-provider-title" className="text-sm font-semibold text-stone-100">
            {title}
          </h3>
          <p className="mt-2 text-xs leading-5 text-stone-400">
            {message}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="border border-stone-200/18 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-stone-300 hover:bg-stone-200/8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="inline-flex min-w-[110px] items-center justify-center gap-1.5 border border-rose-300/35 bg-rose-950/30 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-rose-100 hover:bg-rose-950/45 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {copy.actions.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyValueCell({
  row,
  copy,
  onUpdateKey,
}: {
  row: KeysRowData;
  copy: KeysValidationTableCopy;
  onUpdateKey: (provider: ProviderSpec, apiKey: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);
  const trimmed = draft.trim();

  const submit = async () => {
    if (saving) return;
    if (!trimmed) {
      setFeedback({ kind: 'error', message: copy.keyValueEditor.required });
      return;
    }
    if (row.provider.validatePattern && !row.provider.validatePattern.test(trimmed)) {
      setFeedback({ kind: 'error', message: copy.keyValueEditor.patternMismatch });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await onUpdateKey(row.provider, trimmed);
      setDraft('');
      setRevealed(false);
      setFeedback({ kind: 'ok', message: copy.keyValueEditor.updated });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-[220px]" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <input
          type={revealed ? 'text' : 'password'}
          value={draft}
          disabled={saving}
          placeholder={row.maskedKey ?? 'Paste API key'}
          aria-label={`${row.provider.label} Key Value`}
          onChange={(event) => {
            setDraft(event.target.value);
            setFeedback(null);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
          className="relative z-10 h-7 min-w-0 scroll-mt-16 flex-1 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 font-mono text-[11px] text-stone-100 outline-none placeholder:text-stone-500 focus:ring-1 focus:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          aria-label={revealed ? copy.keyValueEditor.hide : copy.keyValueEditor.show}
          title={revealed ? copy.keyValueEditor.hide : copy.keyValueEditor.show}
          disabled={saving}
          onClick={() => setRevealed((value) => !value)}
          className="relative z-10 inline-flex h-7 w-7 shrink-0 scroll-mt-16 items-center justify-center border border-stone-200/18 text-stone-300 hover:bg-stone-200/8 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          type="button"
          aria-label={copy.keyValueEditor.update}
          title={copy.keyValueEditor.update}
          disabled={saving || !trimmed}
          onClick={() => void submit()}
          className="relative z-10 inline-flex h-7 w-7 shrink-0 scroll-mt-16 items-center justify-center border border-emerald-200/30 text-emerald-100 hover:bg-emerald-100/10 disabled:cursor-not-allowed disabled:border-stone-200/15 disabled:text-stone-500"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        </button>
      </div>
      {feedback && (
        <p
          role={feedback.kind === 'ok' ? 'status' : 'alert'}
          className={`mt-1 truncate text-[10px] ${
            feedback.kind === 'ok' ? 'text-emerald-300/85' : 'text-rose-300'
          }`}
          title={feedback.message}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function EditableTextCell({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  // Local draft so typing does NOT re-render the parent table on every keystroke
  // (which would rebuild `columns` and remount this input, dropping focus).
  // Commit on blur / Enter; resync when the committed value changes externally.
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
      onClick={(event) => event.stopPropagation()}
      className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
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

function SortMarker({ value }: { value: false | 'asc' | 'desc' }) {
  if (value === 'asc') return <span className="text-emerald-200">↑</span>;
  if (value === 'desc') return <span className="text-emerald-200">↓</span>;
  return null;
}

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 h-7 w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-1.5 text-[10px] normal-case tracking-0 text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-stone-900">
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function KeysProviderTable({
  rows,
  hiddenBuiltInCount = 0,
  onRowClick,
  onAddRow,
  onRestoreDefaultProviders,
  onPatchCustomProvider,
  onUpdateProviderActive,
  onDeleteProvider,
  onUpdateKey,
  onRefreshModels,
  refreshingProviderIds,
  onShowAllRows,
  copy,
}: KeysProviderTableProps) {
  const [searchText, setSearchText] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProviderDisplayCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | KeysRowStatus>('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteTarget, setDeleteTarget] = useState<KeysRowData | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const {
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    frozenColumnIds,
    setFrozenColumnIds,
    resetPrefs,
  } = useArenaTablePrefs({
    storageKey: API_KEYS_STORAGE_KEY,
    columnIds: API_KEYS_COLUMN_IDS,
    defaultSizing: API_KEYS_DEFAULT_SIZING,
    defaultFrozenColumnIds: ['col-id'],
  });

  const restoreFilterDefaults = () => {
    setSearchText('');
    setProviderFilter('all');
    setActiveFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setModelFilter('all');
    setSorting([]);
    resetPrefs();
  };

  const handleRestoreDefaultProviders = () => {
    restoreFilterDefaults();
    onRestoreDefaultProviders();
  };

  const confirmDeleteTarget = async () => {
    if (!deleteTarget || deleteInFlight) return;
    setDeleteInFlight(true);
    try {
      await onDeleteProvider(deleteTarget.provider);
      setDeleteTarget(null);
    } finally {
      setDeleteInFlight(false);
    }
  };

  const providerFilterOptions = useMemo(
    () => [
      { value: 'all', label: copy.filters.allProviders },
      ...rows
        .map((row) => ({ value: row.provider.id, label: row.provider.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [copy.filters.allProviders, rows],
  );

  const modelFilterOptions = useMemo(() => {
    const models = Array.from(new Set(rows.flatMap((row) => row.models))).sort((a, b) => a.localeCompare(b));
    return [
      { value: 'all', label: copy.filters.allModels },
      ...models.map((model) => ({ value: model, label: model })),
    ];
  }, [copy.filters.allModels, rows]);

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      if (providerFilter !== 'all' && row.provider.id !== providerFilter) return false;
      if (activeFilter === 'active' && !row.active) return false;
      if (activeFilter === 'inactive' && row.active) return false;
      const displayCategory = getProviderDisplayCategory(row.provider);
      if (categoryFilter !== 'all' && displayCategory !== categoryFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (modelFilter !== 'all' && !row.models.includes(modelFilter)) return false;
      if (!keyword) return true;
      return [
        row.rowId,
        row.active ? 'active' : 'inactive',
        row.provider.id,
        row.provider.label,
        displayCategory,
        getProviderDisplayCategoryLabel(row.provider, copy),
        defaultKeyVarName(row.provider),
        row.provider.keychainKey,
        row.maskedKey ?? '',
        row.status,
        row.models.join(' '),
        row.errorReason ?? '',
      ].join('\n').toLowerCase().includes(keyword);
    });
  }, [copy, rows, searchText, providerFilter, activeFilter, categoryFilter, statusFilter, modelFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.rowId, {
        id: 'col-id',
        header: 'ID',
        size: API_KEYS_DEFAULT_SIZING['col-id'],
        cell: (info) => (
          <span
            className="block truncate font-mono text-[11px] text-stone-300"
            title={`${info.getValue()} · ${info.row.original.provider.id}`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.active, {
        id: 'col-active',
        header: copy.columns.active,
        size: API_KEYS_DEFAULT_SIZING['col-active'],
        cell: (info) => (
          <ActiveCell
            row={info.row.original}
            onUpdateProviderActive={onUpdateProviderActive}
          />
        ),
      }),
      columnHelper.accessor((row) => row.provider.label, {
        id: 'col-provider',
        header: copy.columns.provider,
        size: API_KEYS_DEFAULT_SIZING['col-provider'],
        cell: (info) => {
          const original = info.row.original;
          return original.isCustom ? (
            <CustomProviderCell
              row={original}
              copy={copy}
              onPatchCustomProvider={onPatchCustomProvider}
            />
          ) : (
            <ProviderCell row={original} copy={copy} />
          );
        },
      }),
      columnHelper.accessor((row) => getProviderDisplayCategory(row.provider), {
        id: 'col-category',
        header: copy.columns.category,
        size: API_KEYS_DEFAULT_SIZING['col-category'],
        cell: (info) => {
          const original = info.row.original;
          return (
            <span className="inline-flex rounded-sm border border-amber-200/20 bg-amber-100/10 px-2 py-0.5 text-[11px] text-amber-100/90">
              {getProviderDisplayCategoryLabel(original.provider, copy)}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => defaultKeyVarName(row.provider), {
        id: 'col-key-var-name',
        header: copy.columns.keyVarName,
        size: API_KEYS_DEFAULT_SIZING['col-key-var-name'],
        cell: (info) => {
          const original = info.row.original;
          if (original.isCustom) {
            return (
              <EditableTextCell
                value={info.getValue()}
                placeholder="CUSTOM_PROVIDER_API_KEY"
                onCommit={(keyVarName) => onPatchCustomProvider(original.provider.id, { envVarNames: [keyVarName] })}
              />
            );
          }
          return (
            <span
              className="font-mono text-[11px] text-stone-300"
              title={original.provider.envVarNames.join(', ') || info.getValue()}
            >
              {info.getValue()}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.maskedKey, {
        id: 'col-key-value',
        header: copy.columns.keyValue,
        size: API_KEYS_DEFAULT_SIZING['col-key-value'],
        cell: (info) => <KeyValueCell row={info.row.original} copy={copy} onUpdateKey={onUpdateKey} />,
      }),
      columnHelper.accessor((row) => row.status, {
        id: 'col-status',
        header: copy.columns.status,
        size: API_KEYS_DEFAULT_SIZING['col-status'],
        cell: (info) => (
          <StatusCell
            row={info.row.original}
            copy={copy}
            isRefreshing={refreshingProviderIds.has(info.row.original.provider.id)}
            onRefreshModels={onRefreshModels}
          />
        ),
      }),
      columnHelper.accessor((row) => row.models.join('\n'), {
        id: 'col-model-list',
        header: copy.columns.availableModels,
        size: API_KEYS_DEFAULT_SIZING['col-model-list'],
        cell: (info) => <ModelsPreviewCell models={info.row.original.models} copy={copy} />,
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
          <DeleteProviderCell
            row={info.row.original}
            copy={copy}
            onRequestDelete={setDeleteTarget}
          />
        ),
      }),
    ],
    [
      copy,
      onDeleteProvider,
      onPatchCustomProvider,
      onRefreshModels,
      onUpdateKey,
      onUpdateProviderActive,
      refreshingProviderIds,
    ],
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
  const freezeCandidateIds = visibleColumns.map((column) => column.id);
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

  const frozenClass = (columnId: string, header = false) => (
    frozenVisibleIds.includes(columnId)
      ? `${header ? 'z-30' : 'z-20'} bg-[rgb(var(--pm-rail))]/95 ${lastFrozenId === columnId ? 'shadow-[8px_0_14px_-12px_rgba(255,255,255,0.5)]' : ''}`
      : ''
  );

  const handleFreezeColumnCountChange = (value: string) => {
    const parsed = Number(value);
    const nextCount = Number.isFinite(parsed)
      ? Math.max(0, Math.min(freezeCandidateIds.length, Math.round(parsed)))
      : 0;
    setFrozenColumnIds(freezeCandidateIds.slice(0, nextCount));
  };

  const headerFilterFor = (columnId: string) => {
    if (columnId === 'col-provider') {
      return (
        <FilterSelect
          value={providerFilter}
          onChange={setProviderFilter}
          options={providerFilterOptions}
          ariaLabel={copy.filters.provider}
        />
      );
    }
    if (columnId === 'col-active') {
      return (
        <FilterSelect
          value={activeFilter}
          onChange={(value) => setActiveFilter(value as typeof activeFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          ariaLabel="Active filter"
        />
      );
    }
    if (columnId === 'col-category') {
      return (
        <FilterSelect
          value={categoryFilter}
          onChange={(value) => setCategoryFilter(value as typeof categoryFilter)}
          options={[
            { value: 'all', label: copy.category.all },
            { value: 'model_factory', label: copy.category.modelFactory },
            { value: 'model_channel', label: copy.category.modelChannel },
            { value: 'local_model', label: copy.category.localModel },
            { value: 'integration', label: copy.category.integration },
          ]}
          ariaLabel={copy.filters.category}
        />
      );
    }
    if (columnId === 'col-status') {
      return (
        <FilterSelect
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as typeof statusFilter)}
          options={[
            { value: 'all', label: copy.status.all },
            { value: 'verified', label: copy.status.verified },
            { value: 'configured', label: copy.status.configured },
            { value: 'failed', label: copy.status.failed },
            { value: 'not_set', label: copy.status.notSet },
          ]}
          ariaLabel={copy.filters.status}
        />
      );
    }
    if (columnId === 'col-model-list') {
      return (
        <FilterSelect
          value={modelFilter}
          onChange={setModelFilter}
          options={modelFilterOptions}
          ariaLabel={copy.filters.availableModels}
        />
      );
    }
    return null;
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
          <div className="flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200">
            <Snowflake size={13} className="text-cyan-300" />
            <label htmlFor="api-key-validation-freeze-cols" className="text-[10px] text-stone-400">
              {copy.controls.freezeColumns}
            </label>
            <input
              id="api-key-validation-freeze-cols"
              type="number"
              min={0}
              max={freezeCandidateIds.length}
              value={frozenColumnCount}
              aria-label={copy.controls.freezeColumns}
              onChange={(event) => handleFreezeColumnCountChange(event.target.value)}
              className="h-6 w-11 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-1 text-center text-xs text-stone-100 outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
          </div>
          <button
            onClick={handleRestoreDefaultProviders}
            title={copy.controls.restoreDefaultProvidersTitle}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]"
          >
            <RotateCcw size={13} /> {copy.controls.restoreDefaultProviders}
          </button>
          {hiddenBuiltInCount > 0 && (
            <button onClick={onShowAllRows} className="inline-flex h-8 items-center gap-1 border border-amber-200/25 px-2 text-xs text-amber-100 hover:bg-amber-100/10">
              {replacePlaceholder(copy.controls.showHiddenRows, { count: hiddenBuiltInCount })}
            </button>
          )}
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
                    {headerFilterFor(header.column.id)}
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
                    className={`relative isolate border-r border-stone-200/10 px-4 py-3 align-middle text-sm text-stone-300 ${cell.column.id === 'col-key-value' ? 'z-10' : ''} ${frozenClass(cell.column.id)}`}
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
      {deleteTarget && (
        <DeleteProviderConfirmDialog
          row={deleteTarget}
          copy={copy}
          deleting={deleteInFlight}
          onCancel={() => {
            if (!deleteInFlight) setDeleteTarget(null);
          }}
          onConfirm={() => void confirmDeleteTarget()}
        />
      )}
    </div>
  );
}
