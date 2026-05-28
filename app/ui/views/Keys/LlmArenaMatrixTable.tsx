'use client';

import React, { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Eye, Gauge, History, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { Translations } from '../../../../lib/i18n';
import type { ArenaModelSpec, ArenaResult } from './useArenaChat';
import type { LlmArenaResultRow } from './LlmArenaEvaluation';
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
      col.display({
        id: 'col-no',
        header: 'No',
        cell: ({ row }) => <span className="font-mono text-xs text-stone-300">{row.original.index + 1}</span>,
      }),
      col.display({
        id: 'col-test',
        header: copy.columns.test,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={enabledByIndex[row.original.index] !== false}
            onChange={(event) => onToggleEnabled(row.original.index, event.target.checked)}
          />
        ),
      }),
      col.display({
        id: 'col-provider',
        header: copy.columns.provider,
        cell: ({ row }) => {
          const { spec, index } = row.original;
          return (
            <select
              value={spec.provider}
              onChange={(e) => {
                const nextProvider = providers.find((p) => p.id === e.target.value);
                onUpdateModel(index, e.target.value, nextProvider?.availableModels[0] || '');
              }}
              className="w-full min-w-[150px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
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
      col.display({
        id: 'col-model',
        header: copy.columns.model,
        cell: ({ row }) => {
          const { spec, index } = row.original;
          const provider = providers.find((p) => p.id === spec.provider);
          return (
            <select
              value={spec.model}
              onChange={(e) => onUpdateModel(index, spec.provider, e.target.value)}
              className="w-full min-w-[220px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none font-mono"
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
      col.display({
        id: 'col-effective-model',
        header: 'Requested / Effective',
        cell: ({ row }) => {
          const requested = row.original.resultRow?.requested_model ?? row.original.spec.model;
          const effective = row.original.resultRow?.effective_model ?? row.original.result?.effectiveModel ?? '—';
          return (
            <div className="min-w-[220px] space-y-1 font-mono text-[11px] text-stone-400">
              <p title={requested}>指定：{requested}</p>
              <p title={effective}>實際：{effective || '—'}</p>
            </div>
          );
        },
      }),
      col.display({
        id: 'col-invocation',
        header: copy.columns.invocationPath,
        cell: () => (
          <span className="inline-flex rounded-full bg-stone-500/20 px-2 py-0.5 text-[10px] text-stone-300">
            {invocationPathLabel('http', copy)}
          </span>
        ),
      }),
      col.display({
        id: 'col-plane',
        header: copy.columns.executionPlane,
        cell: ({ row }) => (
          <span className="inline-flex rounded-full bg-stone-500/20 px-2 py-0.5 text-[10px] text-stone-300">
            {executionPlaneLabel(inferExecutionPlane(row.original.spec.provider), copy)}
          </span>
        ),
      }),
      col.display({
        id: 'col-run',
        header: copy.columns.run,
        cell: ({ row }) => (
          <button
            onClick={() => onRunSingleRow(row.original.index)}
            disabled={runningIndexes.has(row.original.index) || !(promptOverrideByIndex[row.original.index] ?? userPrompt).trim()}
            className="inline-flex h-7 items-center gap-1 rounded border border-emerald-200/25 bg-emerald-100/10 px-2 text-[11px] font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:opacity-40"
            title={copy.runSingleTitle}
          >
            {runningIndexes.has(row.original.index) ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {copy.columns.run}
          </button>
        ),
      }),
      col.display({
        id: 'col-status',
        header: copy.columns.status,
        cell: ({ row }) => {
          const meta = statusMeta(row.original.result, copy);
          return <span className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>{meta.text}</span>;
        },
      }),
      col.display({
        id: 'col-prompt',
        header: copy.columns.testPrompt,
        cell: ({ row }) => {
          const idx = row.original.index;
          const value = promptOverrideByIndex[idx] ?? userPrompt;
          return (
            <textarea
              value={value}
              onChange={(e) => onRowPromptChange(idx, e.target.value)}
              placeholder={userPrompt || '—'}
              rows={3}
              className="w-full min-w-[220px] resize-y bg-[rgb(var(--pm-input))] border border-stone-200/15 p-1.5 font-mono text-[11px] leading-relaxed text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
          );
        },
      }),
      col.display({
        id: 'col-raw',
        header: copy.columns.rawOutput,
        cell: ({ row }) => {
          const rawBody = row.original.result ? row.original.result.error ?? row.original.result.content ?? '' : '';
          const rawOutput = row.original.resultRow?.raw_output || rawBody;
          return (
            <div className="max-h-24 min-w-[240px] overflow-auto rounded-md border border-stone-200/15 bg-black/25 px-2 py-1 font-mono text-xs text-stone-300 whitespace-pre-wrap break-words">
              {rawOutput || copy.noOutput}
            </div>
          );
        },
      }),
      col.display({
        id: 'col-rendered',
        header: copy.columns.renderedOutput,
        cell: ({ row }) => (
          <div className="max-h-24 min-w-[240px] overflow-auto rounded-md border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-xs text-stone-300 whitespace-pre-wrap break-words">
            {row.original.result?.content?.trim() || (row.original.result?.error ? copy.errorReply : copy.noOutput)}
          </div>
        ),
      }),
      col.display({
        id: 'col-eval',
        header: copy.columns.evaluation,
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
                className="w-full min-w-[120px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
              >
                <option value="pending" className="bg-stone-900">{copy.evaluationOptions.pending}</option>
                <option value="pass" className="bg-stone-900">{copy.evaluationOptions.pass}</option>
                <option value="warning" className="bg-stone-900">{copy.evaluationOptions.warning}</option>
                <option value="fail" className="bg-stone-900">{copy.evaluationOptions.fail}</option>
              </select>
              <input
                value={noteByIndex[idx] ?? ''}
                onChange={(event) => onNoteChange(idx, event.target.value)}
                placeholder={copy.evaluationNotePlaceholder}
                className="w-full min-w-[160px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
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
      col.display({
        id: 'col-http-status',
        header: 'HTTP',
        cell: ({ row }) => <span className="text-xs font-mono text-stone-400">{row.original.resultRow?.http_status ?? '—'}</span>,
      }),
      col.display({
        id: 'col-ttft',
        header: copy.columns.ttft,
        cell: () => <span className="text-xs font-mono text-stone-400">—</span>,
      }),
      col.display({
        id: 'col-e2e',
        header: copy.columns.e2e,
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
      col.display({
        id: 'col-tps',
        header: copy.columns.tokensPerSecond,
        cell: ({ row }) => {
          const result = row.original.result;
          const speed = result && result.latencyMs > 0 ? (((result.outputTokens ?? 0) * 1000) / result.latencyMs).toFixed(2) : '—';
          return <span className="text-xs font-mono text-stone-400">{speed}</span>;
        },
      }),
      col.display({
        id: 'col-token',
        header: copy.columns.token,
        cell: ({ row }) => (
          <span className="text-xs font-mono text-stone-400">
            {row.original.result ? `${row.original.result.inputTokens ?? 0}↓ ${row.original.result.outputTokens ?? 0}↑` : '—'}
          </span>
        ),
      }),
      col.display({
        id: 'col-history',
        header: copy.columns.history,
        cell: ({ row }) => (
          <button
            onClick={() => onOpenDetail(row.original.index)}
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
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onOpenDetail(row.original.index)}
              className="inline-flex items-center gap-1 rounded border border-stone-300/20 bg-stone-200/5 px-2 py-1 text-[11px] text-stone-200 hover:bg-stone-200/10"
              title={copy.viewDetailTitle}
            >
              <Eye size={13} />
              {commonCopy.view}
            </button>
            <button
              onClick={() => onRemoveModel(row.original.index)}
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
      isRunning,
      runningIndexes,
      noteByIndex,
      onEvaluationChange,
      onNoteChange,
      onOpenDetail,
      onRemoveModel,
      onRunSingleRow,
      onRowPromptChange,
      onToggleEnabled,
      onUpdateModel,
      promptOverrideByIndex,
      providers,
      userPrompt,
    ],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 shadow-xl backdrop-blur-sm rounded-sm flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3 bg-white/[0.02]">
        <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{copy.tableTitle}</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="h-8 w-60 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">{copy.allPlanes}</option>
            <option value="vendor_saas" className="bg-stone-900">{copy.executionPlane.vendorSaas}</option>
            <option value="on_prem" className="bg-stone-900">{copy.executionPlane.onPrem}</option>
            <option value="unknown" className="bg-stone-900">{copy.executionPlane.unknown}</option>
          </select>
          <button onClick={onClearAll} className="text-[11px] text-stone-400 hover:text-stone-200 uppercase tracking-widest px-2">
            {copy.clearResults}
          </button>
          <button
            onClick={onAddModel}
            disabled={selectedModels.length >= 10}
            className="flex items-center gap-1 border border-stone-200/22 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors disabled:opacity-50"
          >
            <Plus size={12} /> {copy.addModel}
          </button>
          <button
            onClick={onRunSelectedRows}
            disabled={isRunning || !userPrompt.trim() || selectedModels.length === 0}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {copy.runAll}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[2300px] w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-stone-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-stone-200/10 hover:bg-white/[0.03]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-sm text-stone-300">
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
