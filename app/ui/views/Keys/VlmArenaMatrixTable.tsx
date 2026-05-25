'use client';

import React from 'react';
import { Loader2, Play, Plus } from 'lucide-react';
import type { ArenaModelSpec, ArenaResult } from './useArenaChat';
import { type ProviderLike, type RowScore, type RunHistoryEntry, type ScenarioId, type VlmArenaCopy } from './VlmArenaTypes';
import { VlmArenaModelCell } from './VlmArenaModelCell';
import { VlmArenaExecutionCell } from './VlmArenaExecutionCell';
import { VlmArenaReviewCell } from './VlmArenaReviewCell';
import { VlmArenaPromptCell } from './VlmArenaPromptCell';

interface VlmArenaMatrixTableProps {
  copy: VlmArenaCopy;
  selectedModels: ArenaModelSpec[];
  providers: readonly ProviderLike[];
  results: Record<string, ArenaResult>;
  isRunning: boolean;
  imageDataUrl: string | null;
  canRunAll: boolean;
  enabledByIndex: Record<number, boolean>;
  scenarioByIndex: Record<number, ScenarioId>;
  rowSystemPromptByIndex: Record<number, string>;
  rowUserPromptByIndex: Record<number, string>;
  scoreByIndex: Record<number, RowScore>;
  noteByIndex: Record<number, string>;
  historyByResultKey: Record<string, RunHistoryEntry[]>;
  onClearAll: () => void;
  onAddModel: () => void;
  onAddTopModels: () => void;
  onRunSelectedRows: () => void;
  onRunSingleRow: (index: number) => void;
  onRemoveModel: (index: number) => void;
  onUpdateModel: (index: number, providerId: string, modelId: string) => void;
  onToggleEnabled: (index: number, enabled: boolean) => void;
  onScenarioChange: (index: number, scenarioId: ScenarioId) => void;
  onRowSystemPromptChange: (index: number, prompt: string) => void;
  onRowUserPromptChange: (index: number, prompt: string) => void;
  onScoreChange: (index: number, score: RowScore) => void;
  onNoteChange: (index: number, note: string) => void;
  onOpenDetail: (index: number) => void;
}

export function VlmArenaMatrixTable({
  copy,
  selectedModels,
  providers,
  results,
  isRunning,
  imageDataUrl,
  canRunAll,
  enabledByIndex,
  scenarioByIndex,
  rowSystemPromptByIndex,
  rowUserPromptByIndex,
  scoreByIndex,
  noteByIndex,
  historyByResultKey,
  onClearAll,
  onAddModel,
  onAddTopModels,
  onRunSelectedRows,
  onRunSingleRow,
  onRemoveModel,
  onUpdateModel,
  onToggleEnabled,
  onScenarioChange,
  onRowSystemPromptChange,
  onRowUserPromptChange,
  onScoreChange,
  onNoteChange,
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
            disabled={selectedModels.length >= 8}
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
            disabled={isRunning || !imageDataUrl || !canRunAll || selectedModels.length === 0}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {copy.runAll}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[2200px] w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-stone-900">
            <tr>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">#</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.test}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.provider}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.model}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.scenario}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.systemPrompt}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.userPromptBase}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.run}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.status}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.latency}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.token}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.modelScore}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.note}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.outputSummary}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.history}</th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">{copy.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {selectedModels.map((spec, index) => {
              const resultKey = `${spec.provider}-${spec.model}`;
              const result = results[resultKey];
              const rowHistory = historyByResultKey[resultKey] ?? [];

              return (
                <tr key={`${index}-${resultKey}`} className="border-b border-stone-200/10 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-xs font-mono text-stone-300">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={enabledByIndex[index] !== false}
                      onChange={(event) => onToggleEnabled(index, event.target.checked)}
                    />
                  </td>
                  <VlmArenaModelCell
                    spec={spec}
                    providers={providers}
                    onUpdateModel={(providerId, modelId) => onUpdateModel(index, providerId, modelId)}
                  />
                  <VlmArenaExecutionCell
                    result={result}
                    isRunning={isRunning}
                    imageDataUrl={imageDataUrl}
                    hasUserPrompt={!!rowUserPromptByIndex[index]?.trim()}
                    scenario={scenarioByIndex[index] ?? 'space_read'}
                    copy={copy}
                    onScenarioChange={(scenarioId) => onScenarioChange(index, scenarioId)}
                    onRunSingle={() => onRunSingleRow(index)}
                  />
                  <VlmArenaPromptCell
                    systemPrompt={rowSystemPromptByIndex[index] ?? ''}
                    userPrompt={rowUserPromptByIndex[index] ?? ''}
                    copy={copy}
                    onSystemPromptChange={(prompt) => onRowSystemPromptChange(index, prompt)}
                    onUserPromptChange={(prompt) => onRowUserPromptChange(index, prompt)}
                  />
                  <VlmArenaReviewCell
                    result={result}
                    score={scoreByIndex[index] ?? 'unrated'}
                    note={noteByIndex[index] ?? ''}
                    historyCount={rowHistory.length}
                    copy={copy}
                    onScoreChange={(score) => onScoreChange(index, score)}
                    onNoteChange={(note) => onNoteChange(index, note)}
                    onOpenDetail={() => onOpenDetail(index)}
                    onRemove={() => onRemoveModel(index)}
                  />
                </tr>
              );
            })}
            {selectedModels.length === 0 && (
              <tr>
                <td colSpan={16} className="px-4 py-8 text-center text-xs text-stone-500">
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
