'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  Gauge,
  History,
  Import,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
} from 'lucide-react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { Translations } from '../../../../lib/i18n';
import type { ArenaModelSpec, ArenaResult } from './useArenaChat';
import type { LlmArenaResultRow } from './LlmArenaEvaluation';
import {
  buildCsv,
  downloadTextFile,
  parseModelRowsFromText,
  useArenaTablePrefs,
  validateImportedModels,
  type ArenaTablePreset,
} from './ArenaTableViewControls';
import {
  evaluationMeta,
  executionPlaneLabel,
  inferExecutionPlane,
  invocationPathLabel,
  statusMeta,
  type EvaluationLevel,
  type LlmArenaCopy,
  type RunHistoryEntry,
} from './LlmArenaTypes';

interface ProviderLike {
  id: LlmProviderId;
  label: string;
  availableModels: string[];
}

interface LlmArenaTableRow {
  index: number;
  spec: ArenaModelSpec;
  result?: ArenaResult;
  resultRow?: LlmArenaResultRow;
  resultKey: string;
  historyCount: number;
}

interface LlmArenaMatrixTableProps {
  copy: LlmArenaCopy;
  commonCopy: Translations['keysArena']['common'];
  selectedModels: ArenaModelSpec[];
  providers: readonly ProviderLike[];
  results: Record<string, ArenaResult>;
  isRunning: boolean;
  runningIndexes: Set<number>;
  userPrompt: string;
  enabledByIndex: Record<number, boolean>;
  evaluationByIndex: Record<number, EvaluationLevel>;
  noteByIndex: Record<number, string>;
  promptOverrideByIndex: Record<number, string>;
  historyByResultKey: Record<string, RunHistoryEntry[]>;
  onClearAll: () => void;
  onAddModel: () => void;
  onImportModels: (models: ArenaModelSpec[]) => void;
  onMoveModel: (fromIndex: number, toIndex: number) => void;
  onRunSelectedRows: () => void;
  onRunSingleRow: (index: number) => void;
  onRemoveModel: (index: number) => void;
  onUpdateModel: (index: number, providerId: string, modelId: string) => void;
  onToggleEnabled: (index: number, enabled: boolean) => void;
  onEvaluationChange: (index: number, level: EvaluationLevel) => void;
  onNoteChange: (index: number, note: string) => void;
  onRowPromptChange: (index: number, value: string) => void;
  onOpenDetail: (index: number) => void;
}

const col = createColumnHelper<LlmArenaTableRow>();
const LLM_STORAGE_KEY = 'projectManager.keys.llmArena.tablePrefs.v1';
const LLM_COLUMN_IDS = [
  'col-no',
  'col-test',
  'col-provider',
  'col-model',
  'col-effective-model',
  'col-invocation',
  'col-plane',
  'col-run',
  'col-status',
  'col-prompt',
  'col-raw',
  'col-rendered',
  'col-eval',
  'col-http-status',
  'col-ttft',
  'col-e2e',
  'col-tps',
  'col-token',
  'col-history',
  'col-actions',
];

const LLM_DEFAULT_SIZING: Record<string, number> = {
  'col-no': 72,
  'col-test': 72,
  'col-provider': 170,
  'col-model': 260,
  'col-effective-model': 240,
  'col-invocation': 130,
  'col-plane': 130,
  'col-run': 112,
  'col-status': 116,
  'col-prompt': 320,
  'col-raw': 300,
  'col-rendered': 300,
  'col-eval': 210,
  'col-http-status': 88,
  'col-ttft': 92,
  'col-e2e': 104,
  'col-tps': 96,
  'col-token': 128,
  'col-history': 96,
  'col-actions': 184,
};

const LLM_PRESETS: ArenaTablePreset[] = [
  {
    id: 'full',
    label: 'Full',
    frozenColumnIds: ['col-no', 'col-test', 'col-provider', 'col-model'],
  },
  {
    id: 'run-review',
    label: 'Run review',
    frozenColumnIds: ['col-no', 'col-provider', 'col-model'],
    columnVisibility: Object.fromEntries(LLM_COLUMN_IDS.map((id) => [id, !['col-invocation', 'col-ttft'].includes(id)])),
  },
  {
    id: 'compact',
    label: 'Compact',
    frozenColumnIds: ['col-no', 'col-provider'],
    columnVisibility: Object.fromEntries(
      LLM_COLUMN_IDS.map((id) => [
        id,
        !['col-effective-model', 'col-invocation', 'col-raw', 'col-rendered', 'col-ttft', 'col-tps'].includes(id),
      ]),
    ),
  },
];

function SortMarker({ value }: { value: false | 'asc' | 'desc' }) {
  if (value === 'asc') return <span className="text-emerald-200">↑</span>;
  if (value === 'desc') return <span className="text-emerald-200">↓</span>;
  return null;
}

export function LlmArenaMatrixTable({
  copy,
  commonCopy,
  selectedModels,
  providers,
  results,
  isRunning,
  runningIndexes,
  userPrompt,
  enabledByIndex,
  evaluationByIndex,
  noteByIndex,
  promptOverrideByIndex,
  historyByResultKey,
  onClearAll,
  onAddModel,
  onImportModels,
  onMoveModel,
  onRunSelectedRows,
  onRunSingleRow,
  onRemoveModel,
  onUpdateModel,
  onToggleEnabled,
  onEvaluationChange,
  onNoteChange,
  onRowPromptChange,
  onOpenDetail,
}: LlmArenaMatrixTableProps) {
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState<'all' | 'vendor_saas' | 'on_prem' | 'unknown'>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const columnOptions = useMemo(
    () => [
      { id: 'col-no', label: 'No', freezable: true },
      { id: 'col-test', label: copy.columns.test, freezable: true },
      { id: 'col-provider', label: copy.columns.provider, freezable: true },
      { id: 'col-model', label: copy.columns.model, freezable: true },
      { id: 'col-effective-model', label: 'Requested / Effective', hideable: true, freezable: true },
      { id: 'col-invocation', label: copy.columns.invocationPath, hideable: true },
      { id: 'col-plane', label: copy.columns.executionPlane, hideable: true },
      { id: 'col-run', label: copy.columns.run, freezable: true },
      { id: 'col-status', label: copy.columns.status, hideable: true },
      { id: 'col-prompt', label: copy.columns.testPrompt, hideable: true },
      { id: 'col-raw', label: copy.columns.rawOutput, hideable: true },
      { id: 'col-rendered', label: copy.columns.renderedOutput, hideable: true },
      { id: 'col-eval', label: copy.columns.evaluation, hideable: true },
      { id: 'col-http-status', label: 'HTTP', hideable: true },
      { id: 'col-ttft', label: copy.columns.ttft, hideable: true },
      { id: 'col-e2e', label: copy.columns.e2e, hideable: true },
      { id: 'col-tps', label: copy.columns.tokensPerSecond, hideable: true },
      { id: 'col-token', label: copy.columns.token, hideable: true },
      { id: 'col-history', label: copy.columns.history, hideable: true },
      { id: 'col-actions', label: copy.columns.actions, freezable: true },
    ],
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
    storageKey: LLM_STORAGE_KEY,
    columnIds: LLM_COLUMN_IDS,
    defaultSizing: LLM_DEFAULT_SIZING,
    defaultFrozenColumnIds: ['col-no', 'col-test', 'col-provider', 'col-model'],
  });

  const rows = useMemo<LlmArenaTableRow[]>(
    () =>
      selectedModels.map((spec, index) => {
        const resultKey = `${spec.provider}-${spec.model}`;
        return {
          index,
          spec,
          result: results[resultKey],
          resultRow: historyByResultKey[resultKey]?.[0]?.resultRow,
          resultKey,
          historyCount: (historyByResultKey[resultKey] ?? []).length,
        };
      }),
    [selectedModels, results, historyByResultKey],
  );

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      const plane = inferExecutionPlane(row.spec.provider);
      if (category !== 'all' && plane !== category) return false;
      if (!keyword) return true;
      const searchBlob = [
        row.spec.provider,
        row.spec.model,
        row.result?.content ?? '',
        row.result?.error ?? '',
        invocationPathLabel('http', copy),
        executionPlaneLabel(plane, copy),
      ]
        .join('\n')
        .toLowerCase();
      return searchBlob.includes(keyword);
    });
  }, [rows, searchText, category, copy]);

  const columns = useMemo(
    () => [
      col.accessor((row) => row.index + 1, {
        id: 'col-no',
        header: 'No',
        size: LLM_DEFAULT_SIZING['col-no'],
        cell: ({ row }) => <span className="font-mono text-xs text-stone-300">{row.original.index + 1}</span>,
      }),
      col.accessor((row) => enabledByIndex[row.index] !== false, {
        id: 'col-test',
        header: copy.columns.test,
        size: LLM_DEFAULT_SIZING['col-test'],
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={enabledByIndex[row.original.index] !== false}
            onChange={(event) => onToggleEnabled(row.original.index, event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            className="h-3.5 w-3.5 accent-emerald-400"
          />
        ),
      }),
      col.accessor((row) => row.spec.provider, {
        id: 'col-provider',
        header: copy.columns.provider,
        size: LLM_DEFAULT_SIZING['col-provider'],
        cell: ({ row }) => {
          const { spec, index } = row.original;
          return (
            <select
              value={spec.provider}
              onChange={(event) => {
                const nextProvider = providers.find((p) => p.id === event.target.value);
                onUpdateModel(index, event.target.value, nextProvider?.availableModels[0] || '');
              }}
              disabled={runningIndexes.has(index)}
              onClick={(event) => event.stopPropagation()}
              className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50"
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
      col.accessor((row) => row.spec.model, {
        id: 'col-model',
        header: copy.columns.model,
        size: LLM_DEFAULT_SIZING['col-model'],
        cell: ({ row }) => {
          const { spec, index } = row.original;
          const provider = providers.find((p) => p.id === spec.provider);
          return (
            <select
              value={spec.model}
              onChange={(event) => onUpdateModel(index, spec.provider, event.target.value)}
              disabled={runningIndexes.has(index)}
              onClick={(event) => event.stopPropagation()}
              className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none font-mono focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50"
            >
              {(provider?.availableModels ?? []).map((model) => (
                <option key={model} value={model} className="bg-stone-900">
                  {model}
                </option>
              ))}
            </select>
          );
        },
      }),
      col.accessor((row) => row.resultRow?.effective_model ?? row.result?.effectiveModel ?? '', {
        id: 'col-effective-model',
        header: 'Requested / Effective',
        size: LLM_DEFAULT_SIZING['col-effective-model'],
        cell: ({ row }) => {
          const requested = row.original.resultRow?.requested_model ?? row.original.spec.model;
          const effective = row.original.resultRow?.effective_model ?? row.original.result?.effectiveModel ?? '—';
          return (
            <div className="space-y-1 font-mono text-[11px] text-stone-400">
              <p className="truncate" title={requested}>指定：{requested}</p>
              <p className="truncate" title={effective}>實際：{effective || '—'}</p>
            </div>
          );
        },
      }),
      col.accessor(() => 'http', {
        id: 'col-invocation',
        header: copy.columns.invocationPath,
        size: LLM_DEFAULT_SIZING['col-invocation'],
        cell: () => (
          <span className="inline-flex rounded-full bg-stone-500/20 px-2 py-0.5 text-[10px] text-stone-300">
            {invocationPathLabel('http', copy)}
          </span>
        ),
      }),
      col.accessor((row) => inferExecutionPlane(row.spec.provider), {
        id: 'col-plane',
        header: copy.columns.executionPlane,
        size: LLM_DEFAULT_SIZING['col-plane'],
        cell: ({ row }) => (
          <span className="inline-flex rounded-full bg-stone-500/20 px-2 py-0.5 text-[10px] text-stone-300">
            {executionPlaneLabel(inferExecutionPlane(row.original.spec.provider), copy)}
          </span>
        ),
      }),
      col.display({
        id: 'col-run',
        header: copy.columns.run,
        size: LLM_DEFAULT_SIZING['col-run'],
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRunSingleRow(row.original.index);
            }}
            disabled={runningIndexes.has(row.original.index) || !(promptOverrideByIndex[row.original.index] ?? userPrompt).trim()}
            className="inline-flex h-7 items-center gap-1 rounded border border-emerald-200/25 bg-emerald-100/10 px-2 text-[11px] font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:opacity-40"
            title={copy.runSingleTitle}
          >
            {runningIndexes.has(row.original.index) ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {copy.columns.run}
          </button>
        ),
      }),
      col.accessor((row) => statusMeta(row.result, copy).text, {
        id: 'col-status',
        header: copy.columns.status,
        size: LLM_DEFAULT_SIZING['col-status'],
        cell: ({ row }) => {
          const meta = statusMeta(row.original.result, copy);
          return <span className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>{meta.text}</span>;
        },
      }),
      col.accessor((row) => promptOverrideByIndex[row.index] ?? userPrompt, {
        id: 'col-prompt',
        header: copy.columns.testPrompt,
        size: LLM_DEFAULT_SIZING['col-prompt'],
        cell: ({ row }) => {
          const idx = row.original.index;
          const value = promptOverrideByIndex[idx] ?? userPrompt;
          return (
            <textarea
              value={value}
              onChange={(event) => onRowPromptChange(idx, event.target.value)}
              onClick={(event) => event.stopPropagation()}
              placeholder={userPrompt || '—'}
              rows={3}
              className="w-full resize-y bg-[rgb(var(--pm-input))] border border-stone-200/15 p-1.5 font-mono text-[11px] leading-relaxed text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
          );
        },
      }),
      col.accessor((row) => row.resultRow?.raw_output || row.result?.error || row.result?.content || '', {
        id: 'col-raw',
        header: copy.columns.rawOutput,
        size: LLM_DEFAULT_SIZING['col-raw'],
        cell: ({ row }) => {
          const rawBody = row.original.result ? row.original.result.error ?? row.original.result.content ?? '' : '';
          const rawOutput = row.original.resultRow?.raw_output || rawBody;
          return (
            <div className="max-h-24 overflow-auto rounded-md border border-stone-200/15 bg-black/25 px-2 py-1 font-mono text-xs text-stone-300 whitespace-pre-wrap break-words">
              {rawOutput || copy.noOutput}
            </div>
          );
        },
      }),
      col.accessor((row) => row.result?.content ?? '', {
        id: 'col-rendered',
        header: copy.columns.renderedOutput,
        size: LLM_DEFAULT_SIZING['col-rendered'],
        cell: ({ row }) => (
          <div className="max-h-24 overflow-auto rounded-md border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-xs text-stone-300 whitespace-pre-wrap break-words">
            {row.original.result?.content?.trim() || (row.original.result?.error ? copy.errorReply : copy.noOutput)}
          </div>
        ),
      }),
      col.accessor((row) => evaluationByIndex[row.index] ?? 'pending', {
        id: 'col-eval',
        header: copy.columns.evaluation,
        size: LLM_DEFAULT_SIZING['col-eval'],
        cell: ({ row }) => {
          const idx = row.original.index;
          const level = evaluationByIndex[idx] ?? 'pending';
          const badge = evaluationMeta(level, copy);
          return (
            <div className="space-y-1.5">
              <span
                className={`inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
              >
                {badge.text}
              </span>
              <select
                value={level}
                onChange={(event) => onEvaluationChange(idx, event.target.value as EvaluationLevel)}
                onClick={(event) => event.stopPropagation()}
                className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
              >
                <option value="pending" className="bg-stone-900">{copy.evaluationOptions.pending}</option>
                <option value="pass" className="bg-stone-900">{copy.evaluationOptions.pass}</option>
                <option value="warning" className="bg-stone-900">{copy.evaluationOptions.warning}</option>
                <option value="fail" className="bg-stone-900">{copy.evaluationOptions.fail}</option>
              </select>
              <input
                value={noteByIndex[idx] ?? ''}
                onChange={(event) => onNoteChange(idx, event.target.value)}
                onClick={(event) => event.stopPropagation()}
                placeholder={copy.evaluationNotePlaceholder}
                className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
              />
              {row.original.resultRow ? (
                <div className="space-y-0.5 font-mono text-[10px] text-stone-400">
                  <p>overall: {row.original.resultRow.overall_score}</p>
                  <p>q:{row.original.resultRow.quality_score} s:{row.original.resultRow.stability_score}</p>
                  <p>lat:{row.original.resultRow.latency_score} cost:{row.original.resultRow.cost_score}</p>
                  <p>comp:{row.original.resultRow.compliance_score}</p>
                </div>
              ) : null}
            </div>
          );
        },
      }),
      col.accessor((row) => row.resultRow?.http_status ?? null, {
        id: 'col-http-status',
        header: 'HTTP',
        size: LLM_DEFAULT_SIZING['col-http-status'],
        cell: ({ row }) => <span className="text-xs font-mono text-stone-400">{row.original.resultRow?.http_status ?? '—'}</span>,
      }),
      col.accessor(() => null, {
        id: 'col-ttft',
        header: copy.columns.ttft,
        size: LLM_DEFAULT_SIZING['col-ttft'],
        cell: () => <span className="text-xs font-mono text-stone-400">—</span>,
      }),
      col.accessor((row) => row.result?.latencyMs ?? null, {
        id: 'col-e2e',
        header: copy.columns.e2e,
        size: LLM_DEFAULT_SIZING['col-e2e'],
        cell: ({ row }) =>
          row.original.result ? (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-stone-400">
              <Gauge size={11} />
              {row.original.result.latencyMs}
            </span>
          ) : (
            <span className="text-xs font-mono text-stone-400">—</span>
          ),
      }),
      col.accessor((row) => {
        const result = row.result;
        return result && result.latencyMs > 0 ? ((result.outputTokens ?? 0) * 1000) / result.latencyMs : null;
      }, {
        id: 'col-tps',
        header: copy.columns.tokensPerSecond,
        size: LLM_DEFAULT_SIZING['col-tps'],
        cell: ({ row }) => {
          const result = row.original.result;
          const speed = result && result.latencyMs > 0 ? (((result.outputTokens ?? 0) * 1000) / result.latencyMs).toFixed(2) : '—';
          return <span className="text-xs font-mono text-stone-400">{speed}</span>;
        },
      }),
      col.accessor((row) => (row.result?.inputTokens ?? 0) + (row.result?.outputTokens ?? 0), {
        id: 'col-token',
        header: copy.columns.token,
        size: LLM_DEFAULT_SIZING['col-token'],
        cell: ({ row }) => (
          <span className="text-xs font-mono text-stone-400">
            {row.original.result ? `${row.original.result.inputTokens ?? 0}↓ ${row.original.result.outputTokens ?? 0}↑` : '—'}
          </span>
        ),
      }),
      col.accessor((row) => row.historyCount, {
        id: 'col-history',
        header: copy.columns.history,
        size: LLM_DEFAULT_SIZING['col-history'],
        cell: ({ row }) => (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail(row.original.index);
            }}
            className="inline-flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/[0.04]"
          >
            <History size={12} />
            {row.original.historyCount}
          </button>
        ),
      }),
      col.display({
        id: 'col-actions',
        header: copy.columns.actions,
        size: LLM_DEFAULT_SIZING['col-actions'],
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onMoveModel(row.original.index, row.original.index - 1);
              }}
              disabled={row.original.index === 0}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10 disabled:opacity-35"
              title="Move row up"
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onMoveModel(row.original.index, row.original.index + 1);
              }}
              disabled={row.original.index >= selectedModels.length - 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10 disabled:opacity-35"
              title="Move row down"
            >
              <ArrowDown size={13} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetail(row.original.index);
              }}
              className="inline-flex items-center gap-1 rounded border border-stone-300/20 bg-stone-200/5 px-2 py-1 text-[11px] text-stone-200 hover:bg-stone-200/10"
              title={copy.viewDetailTitle}
            >
              <Eye size={13} />
              {commonCopy.view}
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onRemoveModel(row.original.index);
              }}
              className="inline-flex items-center gap-1 rounded border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
              title={copy.deleteRowTitle}
            >
              <Trash2 size={13} />
              {commonCopy.delete}
            </button>
          </div>
        ),
      }),
    ],
    [
      enabledByIndex,
      commonCopy,
      copy,
      evaluationByIndex,
      runningIndexes,
      noteByIndex,
      onEvaluationChange,
      onMoveModel,
      onNoteChange,
      onOpenDetail,
      onRemoveModel,
      onRunSingleRow,
      onRowPromptChange,
      onToggleEnabled,
      onUpdateModel,
      promptOverrideByIndex,
      providers,
      selectedModels.length,
      userPrompt,
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
  const frozenVisibleIds = frozenColumnIds.filter((id) => table.getColumn(id)?.getIsVisible());
  const frozenLeftOffsets = new Map<string, number>();
  let left = 0;
  visibleColumns.forEach((column) => {
    if (!frozenVisibleIds.includes(column.id)) return;
    frozenLeftOffsets.set(column.id, left);
    left += column.getSize();
  });
  const lastFrozenId = frozenVisibleIds[frozenVisibleIds.length - 1];
  const hiddenCount = columnOptions.filter((option) => option.hideable && table.getColumn(option.id)?.getIsVisible() === false).length;

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
      no: original.index + 1,
      provider: original.spec.provider,
      model: original.spec.model,
      plane: inferExecutionPlane(original.spec.provider),
      status: statusMeta(original.result, copy).text,
      evaluation: evaluationByIndex[original.index] ?? 'pending',
      http_status: original.resultRow?.http_status ?? '',
      e2e_ms: original.result?.latencyMs ?? '',
      history: original.historyCount,
    }));
    downloadTextFile(
      'llm-arena-rows.csv',
      buildCsv(exportRows, [
        { key: 'no', label: 'No' },
        { key: 'provider', label: 'Provider' },
        { key: 'model', label: 'Model' },
        { key: 'plane', label: 'Execution Plane' },
        { key: 'status', label: 'Status' },
        { key: 'evaluation', label: 'Evaluation' },
        { key: 'http_status', label: 'HTTP' },
        { key: 'e2e_ms', label: 'E2E ms' },
        { key: 'history', label: 'History' },
      ]),
    );
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const models = validateImportedModels(parseModelRowsFromText(text), providers, 10);
    if (models.length > 0) onImportModels(models);
  };

  return (
    <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 shadow-xl backdrop-blur-sm rounded-sm flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200/12 px-4 py-3 bg-white/[0.02]">
        <h2 className="shrink-0 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{copy.tableTitle}</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="h-8 w-60 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          >
            <option value="all" className="bg-stone-900">{copy.allPlanes}</option>
            <option value="vendor_saas" className="bg-stone-900">{copy.executionPlane.vendorSaas}</option>
            <option value="on_prem" className="bg-stone-900">{copy.executionPlane.onPrem}</option>
            <option value="unknown" className="bg-stone-900">{copy.executionPlane.unknown}</option>
          </select>
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
              <Settings2 size={13} /> Hidden ({hiddenCount})
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
              Freeze cols
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
            aria-label="View preset"
            onChange={(event) => {
              const preset = LLM_PRESETS.find((item) => item.id === event.target.value);
              if (preset) applyPreset(preset);
              event.currentTarget.value = '';
            }}
            defaultValue=""
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="" disabled className="bg-stone-900">Preset</option>
            {LLM_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-stone-900">{preset.label}</option>
            ))}
          </select>
          <button onClick={resetPrefs} className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={handleExport} className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
            <Download size={13} /> Export
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]"
          >
            <Import size={13} /> Import
          </button>
          <input ref={importInputRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={handleImportFile} className="hidden" />
          <button onClick={onClearAll} className="h-8 px-2 text-[11px] text-stone-400 hover:text-stone-200 uppercase tracking-widest">
            {copy.clearResults}
          </button>
          <button
            onClick={onAddModel}
            disabled={selectedModels.length >= 10}
            className="flex h-8 items-center gap-1 border border-stone-200/22 px-3 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors disabled:opacity-50"
          >
            <Plus size={12} /> Add Row
          </button>
          <button
            onClick={onRunSelectedRows}
            disabled={isRunning || !userPrompt.trim() || selectedModels.length === 0}
            className="inline-flex h-8 items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 px-3 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {copy.runAll}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-left" style={{ width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-stone-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`relative select-none border-r border-stone-200/10 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400 ${frozenClass(header.column.id, true)}`}
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
              <tr key={row.id} className="border-b border-stone-200/10 hover:bg-white/[0.03]">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`relative isolate border-r border-stone-200/10 px-3 py-2 text-sm text-stone-300 ${frozenClass(cell.column.id)}`}
                    style={cellStyle(cell.column.id)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-8 text-center text-xs text-stone-500">
                  {selectedModels.length === 0
                    ? copy.emptyNoModels
                    : copy.emptyNoFilteredRows}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
