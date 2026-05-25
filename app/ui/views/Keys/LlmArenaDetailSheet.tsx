'use client';

import React from 'react';
import type { ArenaModelSpec, ArenaResult } from './useArenaChat';
import { buildHistoryMarkdown, type LlmArenaCopy, type RunHistoryEntry } from './LlmArenaTypes';

interface LlmArenaDetailSheetProps {
  copy: LlmArenaCopy;
  selectedIndex: number | null;
  selectedSpec?: ArenaModelSpec;
  selectedResult?: ArenaResult;
  selectedHistory: RunHistoryEntry[];
  onClose: () => void;
}

export function LlmArenaDetailSheet({
  copy,
  selectedIndex,
  selectedSpec,
  selectedResult,
  selectedHistory,
  onClose,
}: LlmArenaDetailSheetProps) {
  if (selectedIndex === null || !selectedSpec) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-4" onClick={onClose}>
      <div
        className="ml-auto h-full w-full max-w-2xl overflow-auto border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-stone-200/12 px-4 py-3">
          <h3 className="text-sm font-semibold text-stone-100">{copy.detailTitle}</h3>
          <p className="mt-1 text-xs text-stone-400">
            {selectedSpec.provider} · <span className="font-mono">{selectedSpec.model}</span>
          </p>
        </div>
        <div className="space-y-4 px-4 py-4">
          <section>
            <h4 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">Raw Output</h4>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border border-stone-200/12 bg-black/30 p-3 text-[11px] text-stone-200">
              {selectedResult ? selectedResult.error ?? selectedResult.content ?? '—' : '—'}
            </pre>
          </section>
          <section>
            <h4 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">Rendered Output</h4>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border border-emerald-300/20 bg-emerald-500/10 p-3 text-[11px] text-stone-100">
              {selectedResult?.content?.trim() || '—'}
            </pre>
          </section>
          <section>
            <h4 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">History</h4>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const md = buildHistoryMarkdown(selectedSpec.provider, selectedSpec.model, selectedHistory, copy);
                  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `llm-arena-history-${selectedSpec.provider}-${selectedSpec.model}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded border border-stone-200/20 bg-black/20 px-2 py-1 text-[10px] text-stone-200 hover:bg-black/30"
              >
                {copy.exportMarkdown}
              </button>
            </div>
            <div className="max-h-72 overflow-auto border border-stone-200/12">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
                  <tr>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{copy.columns.time}</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{copy.columns.summary}</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{copy.columns.latency}</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{copy.columns.token}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHistory.length > 0 ? (
                    selectedHistory.map((entry) => (
                      <tr key={entry.timestamp} className="border-b border-stone-200/10 align-top hover:bg-white/[0.045]">
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-stone-400">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-xs text-stone-200">{entry.summary}</td>
                        <td className="px-3 py-3 text-xs font-mono text-stone-400">{entry.latencyMs}ms</td>
                        <td className="px-3 py-3 text-xs font-mono text-stone-400">
                          {entry.inputTokens}↓ {entry.outputTokens}↑
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-stone-500">
                        {copy.historyEmpty}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
