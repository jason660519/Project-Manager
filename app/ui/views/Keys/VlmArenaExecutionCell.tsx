'use client';

import React from 'react';
import { Gauge, Loader2, Play } from 'lucide-react';
import type { ArenaResult } from './useArenaChat';
import { getVlmScenarioItems, vlmStatusMeta, type ScenarioId, type VlmArenaCopy } from './VlmArenaTypes';

interface VlmArenaExecutionCellProps {
  result?: ArenaResult;
  isRunning: boolean;
  imageDataUrl: string | null;
  hasUserPrompt: boolean;
  scenario: ScenarioId;
  copy: VlmArenaCopy;
  onScenarioChange: (scenarioId: ScenarioId) => void;
  onRunSingle: () => void;
}

export function VlmArenaExecutionCell({
  result,
  isRunning,
  imageDataUrl,
  hasUserPrompt,
  scenario,
  copy,
  onScenarioChange,
  onRunSingle,
}: VlmArenaExecutionCellProps) {
  const status = vlmStatusMeta(result, copy);
  const scenarios = getVlmScenarioItems(copy);

  return (
    <>
      <td className="px-3 py-2">
        <select
          value={scenario}
          onChange={(event) => onScenarioChange(event.target.value as ScenarioId)}
          className="w-full min-w-[120px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
        >
          {scenarios.map((item) => (
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
          className="inline-flex h-7 items-center gap-1 rounded border border-emerald-200/25 bg-emerald-100/10 px-2 text-[11px] font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:opacity-40"
          title={copy.runSingleTitle}
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {copy.columns.run}
        </button>
      </td>
      <td className="px-3 py-2">
        <span className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.text}</span>
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
