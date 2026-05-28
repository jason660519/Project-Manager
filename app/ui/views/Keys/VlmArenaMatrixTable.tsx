'use client';

import React, { useEffect, useState } from 'react';
import { Eye, Loader2, Play, Plus } from 'lucide-react';
import type { ArenaModelSpec } from './useArenaChat';
import { type ProviderLike, type RunHistoryEntry, type VlmArenaCopy } from './VlmArenaTypes';
import { VlmArenaModelCell } from './VlmArenaModelCell';
import {
  imageToImageModelDisplayName,
  VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS,
  VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS,
  type VlmImageToImageOutputMode,
  type VlmImageToImageRow,
  type VlmImageToImageStyle,
} from './VlmImageToImageEvaluation';

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

function renderImagePreview(url: string, label: string, emptyText: string) {
  if (!url) return <p className="line-clamp-3 text-xs text-stone-500">{emptyText}</p>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block min-w-[180px]">
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
  return (
    <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 shadow-xl backdrop-blur-sm rounded-sm flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3 bg-white/[0.02]">
        <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{copy.tableTitle}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearAll}
            className="text-[11px] text-stone-400 hover:text-stone-200 uppercase tracking-widest px-2"
          >
            {copy.clearResults}
          </button>
          <button
            onClick={onAddModel}
            disabled={rows.length >= 8}
            className="flex items-center gap-1 border border-stone-200/22 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors disabled:opacity-50"
          >
            <Plus size={12} /> {copy.addModel}
          </button>
          <button
            onClick={onAddTopModels}
            className="flex items-center gap-1 border border-emerald-300/30 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-400/10 transition-colors"
          >
            {copy.importTopModels}
          </button>
          <button
            onClick={onRunSelectedRows}
            disabled={isRunning || !imageDataUrl || !canRunAll || rows.length === 0}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {copy.runAll}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[3600px] w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-stone-900">
            <tr>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">#</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.test}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.provider}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.model}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">Style</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">Output</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">Test prompt</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.run}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">Req / Eff</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">Raw</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">2D Rendered</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">3D Rendered</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.status}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">TTFT (ms)</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">E2E (ms)</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">tok/s</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">HTTP</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.history}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const spec: ArenaModelSpec = { provider: row.provider, model: row.model };
              const resultKey = `${row.provider}-${row.model}`;
              const rowHistory = historyByResultKey[resultKey] ?? [];

              return (
                <tr key={`${index}-${resultKey}`} className="border-b border-stone-200/10 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-xs font-mono text-stone-300">{row.no}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.shouldTest}
                      onChange={(event) => onToggleEnabled(index, event.target.checked)}
                    />
                  </td>
                  <VlmArenaModelCell
                    spec={spec}
                    providers={providers}
                    onUpdateModel={(providerId, modelId) => onUpdateModel(index, providerId, modelId)}
                  />
                  <td className="px-3 py-2">
                    <select
                      value={row.style}
                      onChange={(event) => onStyleChange(index, event.target.value as VlmImageToImageStyle)}
                      className="w-full min-w-[140px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
                    >
                      {VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id} className="bg-stone-900">{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.outputMode}
                      onChange={(event) => onOutputModeChange(index, event.target.value as VlmImageToImageOutputMode)}
                      className="w-full min-w-[170px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
                    >
                      {VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id} className="bg-stone-900">{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={row.prompt}
                      onChange={(event) => onPromptChange(index, event.target.value)}
                      className="h-24 w-full min-w-[360px] resize-none bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs p-2 font-mono outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onRunSingleRow(index)}
                      disabled={row.runStatus === 'running' || !imageDataUrl || !row.prompt.trim()}
                      className="inline-flex h-7 items-center gap-1 rounded border border-emerald-200/25 bg-emerald-100/10 px-2 text-[11px] font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:opacity-40"
                      title={copy.runSingleTitle}
                    >
                      {row.runStatus === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                      {copy.columns.run}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-300">
                    <p className="font-mono">{row.model}</p>
                    <p className="text-[10px] text-stone-500">{imageToImageModelDisplayName(row.provider, row.model)}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-300 max-w-[360px]">
                    <p className="line-clamp-3 whitespace-pre-wrap break-words">
                      {row.resultText || row.message || copy.notRun}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {renderImagePreview(row.resultImage2dUrl || row.resultImageUrl, '2D', row.outputMode === '3d' ? '未要求 2D 圖。' : '尚無 2D 圖。')}
                  </td>
                  <td className="px-3 py-2">
                    {renderImagePreview(row.resultImage3dUrl, '3D', row.outputMode === '2d' ? '未要求 3D 圖。' : '尚無 3D 圖。')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="min-w-[84px]">
                      <span className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold ${statusClassName(row)}`}>
                        {statusLabel(row, copy)}
                      </span>
                      {row.runStatus === 'running' ? <RunningElapsedLabel startedAtMs={row.runStartedAtMs} /> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-stone-400">—</td>
                  <td className="px-3 py-2 text-xs font-mono text-stone-400">{row.e2eMs == null ? '—' : Math.round(row.e2eMs)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-stone-400">—</td>
                  <td className="px-3 py-2 text-xs font-mono text-stone-400">{row.httpStatus ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-stone-300">
                    <button
                      onClick={() => onOpenDetail(index)}
                      className="inline-flex items-center gap-1 rounded border border-stone-300/20 bg-stone-200/5 px-2 py-1 text-[11px] text-stone-200 hover:bg-stone-200/10"
                    >
                      <Eye size={12} />
                      {rowHistory.length}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenDetail(index)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-stone-300/20 bg-stone-200/5 text-stone-200 hover:bg-stone-200/10"
                        title={copy.viewDetailTitle}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => onRemoveModel(index)}
                        className="inline-flex rounded border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
                        title={copy.deleteRowTitle}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={19} className="px-4 py-8 text-center text-xs text-stone-500">
                  {copy.emptyNoModels}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
