'use client';

import React from 'react';
import { History, XCircle } from 'lucide-react';
import type { ArenaModelSpec, ArenaResult } from './useArenaChat';
import type { RunHistoryEntry, ScenarioId } from './VlmArenaTypes';

interface VlmArenaDetailSheetProps {
  selectedDetailIndex: number | null;
  selectedModel?: ArenaModelSpec;
  result?: ArenaResult;
  history: RunHistoryEntry[];
  scenarioByIndex: Record<number, ScenarioId>;
  scenarioMap: Record<string, { id: ScenarioId; label: string; instruction: string }>;
  buildRowPrompt: (index: number) => string;
  onClose: () => void;
}

export function VlmArenaDetailSheet({
  selectedDetailIndex,
  selectedModel,
  result,
  history,
  scenarioByIndex,
  scenarioMap,
  buildRowPrompt,
  onClose,
}: VlmArenaDetailSheetProps) {
  if (selectedDetailIndex === null || !selectedModel) return null;

  const scenario = scenarioMap[scenarioByIndex[selectedDetailIndex] ?? 'space_read'];

  return (
    <section className="fixed inset-y-0 right-0 z-40 w-[460px] border-l border-stone-200/12 bg-[rgb(var(--pm-bg))] shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-stone-400">VLM Evaluation Detail</p>
            <p className="text-sm text-stone-100">{selectedModel.provider} / {selectedModel.model}</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200">
            <XCircle size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">Current Scenario</p>
            <p className="text-xs text-stone-200">{scenario?.label}</p>
            <p className="mt-1 text-xs text-stone-400">{scenario?.instruction}</p>
          </div>
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">Composed Prompt</p>
            <pre className="whitespace-pre-wrap text-xs text-stone-300 font-mono">{buildRowPrompt(selectedDetailIndex)}</pre>
          </div>
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">Latest Output</p>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-stone-300 font-mono">
              {result ? result.error || result.content || '無輸出' : '尚未執行'}
            </pre>
          </div>
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-2 flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">
              <History size={12} />
              Run History
            </p>
            <div className="space-y-2">
              {history.length === 0 && <p className="text-xs text-stone-500">尚無歷史紀錄</p>}
              {history.map((item) => (
                <div key={item.timestamp} className="border border-stone-200/10 p-2">
                  <p className="text-[11px] text-stone-300">{new Date(item.timestamp).toLocaleString()}</p>
                  <p className="text-[11px] text-stone-400">情境：{scenarioMap[item.scenario]?.label ?? item.scenario}</p>
                  <p className="mt-1 text-[11px] text-stone-200 line-clamp-3 whitespace-pre-wrap">{item.result.error || item.result.content || '無輸出'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
