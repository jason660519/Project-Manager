'use client';

import React from 'react';
import { Gauge, Loader2, Play } from 'lucide-react';
import type { ArenaResult } from './useArenaChat';
import { VLM_SCENARIOS, type ScenarioId } from './VlmArenaTypes';

interface VlmArenaExecutionCellProps {
  result?: ArenaResult;
  isRunning: boolean;
  imageDataUrl: string | null;
  hasUserPrompt: boolean;
  scenario: ScenarioId;
  onScenarioChange: (scenarioId: ScenarioId) => void;
  onRunSingle: () => void;
}

export function VlmArenaExecutionCell({
  result,
  isRunning,
  imageDataUrl,
  hasUserPrompt,
  scenario,
  onScenarioChange,
  onRunSingle,
}: VlmArenaExecutionCellProps) {
  const status = result?.error ? '失敗' : result ? '完成' : '待測';
  const statusClass = result?.error
    ? 'bg-red-500/15 text-red-400'
    : result
      ? 'bg-emerald-500/15 text-emerald-400'
      : 'bg-stone-500/15 text-stone-400';

  return (
    <>
      <td className="px-3 py-2">
        <select
          value={scenario}
          onChange={(event) => onScenarioChange(event.target.value as ScenarioId)}
          className="w-full min-w-[120px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
        >
          {VLM_SCENARIOS.map((item) => (
            <option key={item.id} value={item.id} className="bg-stone-900">
              {item.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={onRunSingle}
          disabled={isRunning || !imageDataUrl || !hasUserPrompt}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-stone-200/20 bg-black/20 text-emerald-300 hover:bg-black/35 disabled:opacity-40"
          title="執行單列評測"
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        </button>
      </td>
      <td className="px-3 py-2">
        <span className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{status}</span>
      </td>
      <td className="px-3 py-2 text-xs font-mono text-stone-400">
        {result ? (
          <span className="inline-flex items-center gap-1">
            <Gauge size={11} />
            {result.latencyMs}ms
          </span>
        ) : '—'}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-stone-400">
        {result ? `${result.inputTokens ?? 0}↓ ${result.outputTokens ?? 0}↑` : '—'}
      </td>
    </>
  );
}
