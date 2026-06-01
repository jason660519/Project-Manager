'use client';

// @table-classification: basic
// @table-reason: Operational VLM image-to-image evaluation matrix (many columns, horizontal
//   overflow, repeated runs). Uses useArenaTablePrefs + the shared numeric Freeze cols control.
// @table-waivers: shell-not-migrated — keeps bespoke eval/run/preview cells; thead/tbody render
//   retained inline (full DataTableShell migration tracked as follow-up). All mandatory controls
//   present: search, provider/status/output filters, numeric Freeze cols, resize+persist, hidden
//   cols, sort arrows, reset.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Import,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import type { ArenaModelSpec } from './useArenaChat';
import { type ProviderLike, type RunHistoryEntry, type VlmArenaCopy } from './VlmArenaTypes';
import {
  buildCsv,
  downloadTextFile,
  parseModelRowsFromText,
  useArenaTablePrefs,
  validateImportedModels,
  type ArenaTablePreset,
} from './ArenaTableViewControls';
import {
  applyFreezeColumnCount,
  FreezeColsControl,
  getFrozenColumnLayout,
  useLiveRef,
} from '../../../../components/table/datasheet';
import {
  imageToImageModelDisplayName,
  VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS,
  VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS,
  type VlmImageToImageOutputMode,
  type VlmImageToImageRow,
  type VlmImageToImageStyle,
} from './VlmImageToImageEvaluation';

interface VlmArenaTableRow {
  index: number;
  row: VlmImageToImageRow;
  resultKey: string;
  historyCount: number;
}

interface VlmArenaMatrixTableProps {
  copy: VlmArenaCopy;
  providers: readonly ProviderLike[];
  rows: VlmImageToImageRow[];
  isRunning: boolean;
  imageDataUrl: string | null;
  canRunAll: boolean;
  historyByResultKey: Record<string, RunHistoryEntry[]>;
  onClearAll: () => void;
  onAddModel: () => void;
  onAddTopModels: () => void;
  onImportModels: (models: ArenaModelSpec[]) => void;
  onMoveModel: (fromIndex: number, toIndex: number) => void;
  onRunSelectedRows: () => void;
  onRunSingleRow: (index: number) => void;
  onRemoveModel: (index: number) => void;
  onUpdateModel: (index: number, providerId: string, modelId: string) => void;
  onToggleEnabled: (index: number, enabled: boolean) => void;
  onStyleChange: (index: number, style: VlmImageToImageStyle) => void;
  onOutputModeChange: (index: number, outputMode: VlmImageToImageOutputMode) => void;
  onPromptChange: (index: number, prompt: string) => void;
  onOpenDetail: (index: number) => void;
}

const col = createColumnHelper<VlmArenaTableRow>();
const VLM_STORAGE_KEY = 'projectManager.keys.vlmArena.tablePrefs.v1';
const VLM_COLUMN_IDS = [
  'col-no',
  'col-test',
  'col-provider',
  'col-model',
  'col-style',
  'col-output',
  'col-prompt',
  'col-run',
  'col-effective-model',
  'col-raw',
  'col-rendered-2d',
  'col-rendered-3d',
  'col-status',
  'col-ttft',
  'col-e2e',
  'col-tps',
  'col-http-status',
  'col-history',
  'col-actions',
];

const VLM_DEFAULT_SIZING: Record<string, number> = {
  'col-no': 72,
  'col-test': 72,
  'col-provider': 160,
  'col-model': 270,
  'col-style': 150,
  'col-output': 180,
  'col-prompt': 380,
  'col-run': 112,
  'col-effective-model': 240,
  'col-raw': 320,
  'col-rendered-2d': 220,
  'col-rendered-3d': 220,
  'col-status': 130,
  'col-ttft': 92,
  'col-e2e': 104,
  'col-tps': 96,
  'col-http-status': 88,
  'col-history': 96,
  'col-actions': 180,
};

const VLM_PRESETS: ArenaTablePreset[] = [
  {
    id: 'full',
    label: 'Full',
    frozenColumnIds: ['col-no', 'col-test', 'col-provider', 'col-model'],
  },
  {
    id: 'render-review',
    label: 'Render review',
    frozenColumnIds: ['col-no', 'col-provider', 'col-model'],
    columnVisibility: Object.fromEntries(VLM_COLUMN_IDS.map((id) => [id, !['col-ttft', 'col-tps'].includes(id)])),
  },
  {
    id: 'compact',
    label: 'Compact',
    frozenColumnIds: ['col-no', 'col-provider'],
    columnVisibility: Object.fromEntries(
      VLM_COLUMN_IDS.map((id) => [
        id,
        !['col-prompt', 'col-raw', 'col-rendered-2d', 'col-rendered-3d', 'col-ttft', 'col-tps'].includes(id),
      ]),
    ),
  },
];

function statusLabel(row: VlmImageToImageRow, copy: VlmArenaCopy): string {
  if (row.runStatus === 'done') return copy.statuses.completed;
  if (row.runStatus === 'failed') return copy.statuses.failed;
  if (row.runStatus === 'running') return '模型測試中';
  return copy.statuses.queued;
}

function statusClassName(row: VlmImageToImageRow): string {
  if (row.runStatus === 'done') return 'bg-emerald-500/15 text-emerald-300';
  if (row.runStatus === 'failed') return 'bg-red-500/15 text-red-300';
  if (row.runStatus === 'running') return 'bg-sky-500/15 text-sky-200';
  return 'bg-stone-500/15 text-stone-400';
}

function RunningElapsedLabel({ startedAtMs }: { startedAtMs: number | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAtMs) return undefined;
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAtMs]);

  if (!startedAtMs) return null;
  const seconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  return <span className="mt-1 block text-[10px] font-mono text-sky-200/80">運行中 {seconds}s</span>;
}

function SortMarker({ value }: { value: false | 'asc' | 'desc' }) {
  if (value === 'asc') return <span className="text-emerald-200">↑</span>;
  if (value === 'desc') return <span className="text-emerald-200">↓</span>;
  return null;
}

function renderImagePreview(url: string, label: string, emptyText: string) {
  if (!url) return <p className="line-clamp-3 text-xs text-stone-500">{emptyText}</p>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`${label} image-to-image output`} className="h-28 w-44 rounded-sm border border-emerald-300/30 object-contain" />
      <span className="mt-1 inline-flex rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">{label} 已生成</span>
    </a>
  );
}

export function VlmArenaMatrixTable({
  copy,
  providers,
  rows,
  isRunning,
  imageDataUrl,
  canRunAll,
  historyByResultKey,
  onClearAll,
  onAddModel,
  onAddTopModels,
  onImportModels,
  onMoveModel,
  onRunSelectedRows,
  onRunSingleRow,
  onRemoveModel,
  onUpdateModel,
  onToggleEnabled,
  onStyleChange,
  onOutputModeChange,
  onPromptChange,
  onOpenDetail,
}: VlmArenaMatrixTableProps) {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VlmImageToImageRow['runStatus']>('all');
  const [outputFilter, setOutputFilter] = useState<'all' | VlmImageToImageOutputMode>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const columnOptions = useMemo(
    () => [
      { id: 'col-no', label: 'No', freezable: true },
      { id: 'col-test', label: copy.columns.test, freezable: true },
      { id: 'col-provider', label: copy.columns.provider, freezable: true },
      { id: 'col-model', label: copy.columns.model, freezable: true },
      { id: 'col-style', label: 'Style', hideable: true },
      { id: 'col-output', label: 'Output', hideable: true },
      { id: 'col-prompt', label: 'Test prompt', hideable: true },
      { id: 'col-run', label: copy.columns.run, freezable: true },
      { id: 'col-effective-model', label: 'Req / Eff', hideable: true },
      { id: 'col-raw', label: 'Raw', hideable: true },
      { id: 'col-rendered-2d', label: '2D Rendered', hideable: true },
      { id: 'col-rendered-3d', label: '3D Rendered', hideable: true },
      { id: 'col-status', label: copy.columns.status, hideable: true },
      { id: 'col-ttft', label: 'TTFT (ms)', hideable: true },
      { id: 'col-e2e', label: 'E2E (ms)', hideable: true },
      { id: 'col-tps', label: 'tok/s', hideable: true },
      { id: 'col-http-status', label: 'HTTP', hideable: true },
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
    storageKey: VLM_STORAGE_KEY,
    columnIds: VLM_COLUMN_IDS,
    defaultSizing: VLM_DEFAULT_SIZING,
    defaultFrozenColumnIds: ['col-no', 'col-test', 'col-provider', 'col-model'],
  });

  const tableRows = useMemo<VlmArenaTableRow[]>(
    () => rows.map((row, index) => {
      const resultKey = `${row.provider}-${row.model}`;
      return {
        index,
        row,
        resultKey,
        historyCount: (historyByResultKey[resultKey] ?? []).length,
      };
    }),
    [rows, historyByResultKey],
  );

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return tableRows.filter((item) => {
      if (statusFilter !== 'all' && item.row.runStatus !== statusFilter) return false;
      if (outputFilter !== 'all' && item.row.outputMode !== outputFilter) return false;
      if (providerFilter !== 'all' && item.row.provider !== providerFilter) return false;
      if (!keyword) return true;
      return [
        item.row.provider,
        item.row.model,
        imageToImageModelDisplayName(item.row.provider, item.row.model),
        item.row.prompt,
        item.row.resultText,
        item.row.message,
        item.row.style,
        item.row.outputMode,
      ].join('\n').toLowerCase().includes(keyword);
    });
  }, [tableRows, searchText, statusFilter, outputFilter, providerFilter]);

  // Volatile handlers + image flag read via a ref so `columns` need not depend
  // on them — see useLiveRef docs. Keeps the prompt <textarea> from remounting
  // (and losing focus) on every keystroke.
  const liveRef = useLiveRef({
    onToggleEnabled,
    onUpdateModel,
    onStyleChange,
    onOutputModeChange,
    onPromptChange,
    onRunSingleRow,
    onOpenDetail,
    onMoveModel,
    onRemoveModel,
    imageDataUrl,
  });

  const columns = useMemo(
    () => [
      col.accessor((item) => item.row.no, {
        id: 'col-no',
        header: '#',
        size: VLM_DEFAULT_SIZING['col-no'],
        cell: ({ row }) => <span className="font-mono text-xs text-stone-300">{row.original.row.no}</span>,
      }),
      col.accessor((item) => item.row.shouldTest, {
        id: 'col-test',
        header: copy.columns.test,
        size: VLM_DEFAULT_SIZING['col-test'],
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.original.row.shouldTest}
            onChange={(event) => liveRef.current.onToggleEnabled(row.original.index, event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            className="h-3.5 w-3.5 accent-emerald-400"
          />
        ),
      }),
      col.accessor((item) => item.row.provider, {
        id: 'col-provider',
        header: copy.columns.provider,
        size: VLM_DEFAULT_SIZING['col-provider'],
        cell: ({ row }) => (
          <select
            value={row.original.row.provider}
            onChange={(event) => {
              const nextProvider = providers.find((p) => p.id === event.target.value);
              liveRef.current.onUpdateModel(row.original.index, event.target.value, nextProvider?.availableModels[0] || '');
            }}
            disabled={row.original.row.runStatus === 'running'}
            onClick={(event) => event.stopPropagation()}
            className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id} className="bg-stone-900">
                {provider.label}
              </option>
            ))}
          </select>
        ),
      }),
      col.accessor((item) => item.row.model, {
        id: 'col-model',
        header: copy.columns.model,
        size: VLM_DEFAULT_SIZING['col-model'],
        cell: ({ row }) => {
          const provider = providers.find((p) => p.id === row.original.row.provider);
          return (
            <select
              value={row.original.row.model}
              onChange={(event) => liveRef.current.onUpdateModel(row.original.index, row.original.row.provider, event.target.value)}
              disabled={row.original.row.runStatus === 'running'}
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
      col.accessor((item) => item.row.style, {
        id: 'col-style',
        header: 'Style',
        size: VLM_DEFAULT_SIZING['col-style'],
        cell: ({ row }) => (
          <select
            value={row.original.row.style}
            onChange={(event) => liveRef.current.onStyleChange(row.original.index, event.target.value as VlmImageToImageStyle)}
            onClick={(event) => event.stopPropagation()}
            className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
          >
            {VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id} className="bg-stone-900">{option.label}</option>
            ))}
          </select>
        ),
      }),
      col.accessor((item) => item.row.outputMode, {
        id: 'col-output',
        header: 'Output',
        size: VLM_DEFAULT_SIZING['col-output'],
        cell: ({ row }) => (
          <select
            value={row.original.row.outputMode}
            onChange={(event) => liveRef.current.onOutputModeChange(row.original.index, event.target.value as VlmImageToImageOutputMode)}
            onClick={(event) => event.stopPropagation()}
            className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
          >
            {VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id} className="bg-stone-900">{option.label}</option>
            ))}
          </select>
        ),
      }),
      col.accessor((item) => item.row.prompt, {
        id: 'col-prompt',
        header: 'Test prompt',
        size: VLM_DEFAULT_SIZING['col-prompt'],
        cell: ({ row }) => (
          <textarea
            value={row.original.row.prompt}
            onChange={(event) => liveRef.current.onPromptChange(row.original.index, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            className="h-24 w-full resize-none bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs p-2 font-mono outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        ),
      }),
      col.display({
        id: 'col-run',
        header: copy.columns.run,
        size: VLM_DEFAULT_SIZING['col-run'],
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={(event) => {
              event.stopPropagation();
              liveRef.current.onRunSingleRow(row.original.index);
            }}
            disabled={row.original.row.runStatus === 'running' || !liveRef.current.imageDataUrl || !row.original.row.prompt.trim()}
            className="inline-flex h-7 items-center gap-1 rounded border border-emerald-200/25 bg-emerald-100/10 px-2 text-[11px] font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:opacity-40"
            title={copy.runSingleTitle}
          >
            {row.original.row.runStatus === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {copy.columns.run}
          </button>
        ),
      }),
      col.accessor((item) => imageToImageModelDisplayName(item.row.provider, item.row.model), {
        id: 'col-effective-model',
        header: 'Req / Eff',
        size: VLM_DEFAULT_SIZING['col-effective-model'],
        cell: ({ row }) => (
          <div className="text-xs text-stone-300">
            <p className="truncate font-mono" title={row.original.row.model}>{row.original.row.model}</p>
            <p className="truncate text-[10px] text-stone-500" title={imageToImageModelDisplayName(row.original.row.provider, row.original.row.model)}>
              {imageToImageModelDisplayName(row.original.row.provider, row.original.row.model)}
            </p>
          </div>
        ),
      }),
      col.accessor((item) => item.row.resultText || item.row.message, {
        id: 'col-raw',
        header: 'Raw',
        size: VLM_DEFAULT_SIZING['col-raw'],
        cell: ({ row }) => (
          <div className="max-h-24 overflow-auto rounded-md border border-stone-200/15 bg-black/25 px-2 py-1 text-xs text-stone-300 whitespace-pre-wrap break-words">
            {row.original.row.resultText || row.original.row.message || copy.notRun}
          </div>
        ),
      }),
      col.display({
        id: 'col-rendered-2d',
        header: '2D Rendered',
        size: VLM_DEFAULT_SIZING['col-rendered-2d'],
        cell: ({ row }) => renderImagePreview(
          row.original.row.resultImage2dUrl || row.original.row.resultImageUrl,
          '2D',
          row.original.row.outputMode === '3d' ? '未要求 2D 圖。' : '尚無 2D 圖。',
        ),
      }),
      col.display({
        id: 'col-rendered-3d',
        header: '3D Rendered',
        size: VLM_DEFAULT_SIZING['col-rendered-3d'],
        cell: ({ row }) => renderImagePreview(
          row.original.row.resultImage3dUrl,
          '3D',
          row.original.row.outputMode === '2d' ? '未要求 3D 圖。' : '尚無 3D 圖。',
        ),
      }),
      col.accessor((item) => item.row.runStatus, {
        id: 'col-status',
        header: copy.columns.status,
        size: VLM_DEFAULT_SIZING['col-status'],
        cell: ({ row }) => (
          <div>
            <span className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold ${statusClassName(row.original.row)}`}>
              {statusLabel(row.original.row, copy)}
            </span>
            {row.original.row.runStatus === 'running' ? <RunningElapsedLabel startedAtMs={row.original.row.runStartedAtMs} /> : null}
          </div>
        ),
      }),
      col.accessor(() => null, {
        id: 'col-ttft',
        header: 'TTFT (ms)',
        size: VLM_DEFAULT_SIZING['col-ttft'],
        cell: () => <span className="text-xs font-mono text-stone-400">—</span>,
      }),
      col.accessor((item) => item.row.e2eMs ?? null, {
        id: 'col-e2e',
        header: 'E2E (ms)',
        size: VLM_DEFAULT_SIZING['col-e2e'],
        cell: ({ row }) => <span className="text-xs font-mono text-stone-400">{row.original.row.e2eMs == null ? '—' : Math.round(row.original.row.e2eMs)}</span>,
      }),
      col.accessor(() => null, {
        id: 'col-tps',
        header: 'tok/s',
        size: VLM_DEFAULT_SIZING['col-tps'],
        cell: () => <span className="text-xs font-mono text-stone-400">—</span>,
      }),
      col.accessor((item) => item.row.httpStatus ?? null, {
        id: 'col-http-status',
        header: 'HTTP',
        size: VLM_DEFAULT_SIZING['col-http-status'],
        cell: ({ row }) => <span className="text-xs font-mono text-stone-400">{row.original.row.httpStatus ?? '—'}</span>,
      }),
      col.accessor((item) => item.historyCount, {
        id: 'col-history',
        header: copy.columns.history,
        size: VLM_DEFAULT_SIZING['col-history'],
        cell: ({ row }) => (
          <button
            onClick={(event) => {
              event.stopPropagation();
              liveRef.current.onOpenDetail(row.original.index);
            }}
            className="inline-flex items-center gap-1 rounded border border-stone-300/20 bg-stone-200/5 px-2 py-1 text-[11px] text-stone-200 hover:bg-stone-200/10"
          >
            <Eye size={12} />
            {row.original.historyCount}
          </button>
        ),
      }),
      col.display({
        id: 'col-actions',
        header: copy.columns.actions,
        size: VLM_DEFAULT_SIZING['col-actions'],
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(event) => {
                event.stopPropagation();
                liveRef.current.onMoveModel(row.original.index, row.original.index - 1);
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
                liveRef.current.onMoveModel(row.original.index, row.original.index + 1);
              }}
              disabled={row.original.index >= rows.length - 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10 disabled:opacity-35"
              title="Move row down"
            >
              <ArrowDown size={13} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                liveRef.current.onOpenDetail(row.original.index);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10"
              title={copy.viewDetailTitle}
            >
              <Eye size={13} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                liveRef.current.onRemoveModel(row.original.index);
              }}
              className="inline-flex rounded border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
              title={copy.deleteRowTitle}
            >
              Delete
            </button>
          </div>
        ),
      }),
    ],
    // Volatile handlers + imageDataUrl are read via liveRef inside cells, so they
    // are intentionally NOT deps — this keeps `columns` stable across keystrokes
    // so the prompt <textarea> never remounts mid-typing.
    [copy, providers, rows.length],
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

  const { cellStyle, frozenClass, freezeCandidateIds, frozenColumnCount } = getFrozenColumnLayout(
    table,
    frozenColumnIds,
  );
  const hiddenCount = columnOptions.filter((option) => option.hideable && table.getColumn(option.id)?.getIsVisible() === false).length;
  const providerOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.provider))), [rows]);

  const handleExport = () => {
    const exportRows = table.getRowModel().rows.map(({ original }) => ({
      no: original.row.no,
      provider: original.row.provider,
      model: original.row.model,
      style: original.row.style,
      output: original.row.outputMode,
      status: original.row.runStatus,
      http_status: original.row.httpStatus ?? '',
      e2e_ms: original.row.e2eMs == null ? '' : Math.round(original.row.e2eMs),
      history: original.historyCount,
    }));
    downloadTextFile(
      'vlm-arena-rows.csv',
      buildCsv(exportRows, [
        { key: 'no', label: 'No' },
        { key: 'provider', label: 'Provider' },
        { key: 'model', label: 'Model' },
        { key: 'style', label: 'Style' },
        { key: 'output', label: 'Output' },
        { key: 'status', label: 'Status' },
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
    const models = validateImportedModels(parseModelRowsFromText(text), providers, 8);
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
            placeholder="Search provider, model, prompt, output"
            className="h-8 w-64 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">All providers</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider} className="bg-stone-900">{provider}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">All status</option>
            <option value="idle" className="bg-stone-900">{copy.statuses.queued}</option>
            <option value="running" className="bg-stone-900">模型測試中</option>
            <option value="done" className="bg-stone-900">{copy.statuses.completed}</option>
            <option value="failed" className="bg-stone-900">{copy.statuses.failed}</option>
          </select>
          <select
            value={outputFilter}
            onChange={(event) => setOutputFilter(event.target.value as typeof outputFilter)}
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="all" className="bg-stone-900">All outputs</option>
            {VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id} className="bg-stone-900">{option.label}</option>
            ))}
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
          <FreezeColsControl
            id="vlm-arena-freeze-cols"
            count={frozenColumnCount}
            max={freezeCandidateIds.length}
            label="Freeze cols"
            onChangeCount={(value) => applyFreezeColumnCount(setFrozenColumnIds, freezeCandidateIds, value)}
          />
          <select
            aria-label="View preset"
            onChange={(event) => {
              const preset = VLM_PRESETS.find((item) => item.id === event.target.value);
              if (preset) applyPreset(preset);
              event.currentTarget.value = '';
            }}
            defaultValue=""
            className="h-8 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-200 outline-none"
          >
            <option value="" disabled className="bg-stone-900">Preset</option>
            {VLM_PRESETS.map((preset) => (
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
            disabled={rows.length >= 8}
            className="flex h-8 items-center gap-1 border border-stone-200/22 px-3 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors disabled:opacity-50"
          >
            <Plus size={12} /> Add Row
          </button>
          <button
            onClick={onAddTopModels}
            className="flex h-8 items-center gap-1 border border-emerald-300/30 px-3 text-[11px] uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-400/10 transition-colors"
          >
            {copy.importTopModels}
          </button>
          <button
            onClick={onRunSelectedRows}
            disabled={isRunning || !imageDataUrl || !canRunAll || rows.length === 0}
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
              <tr key={row.original.row.id} className="border-b border-stone-200/10 hover:bg-white/[0.03]">
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
                  {rows.length === 0 ? copy.emptyNoModels : 'No VLM Arena rows match the current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
