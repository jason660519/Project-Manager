'use client';

import React from 'react';
import { openPath } from '../../../../lib/bridge';
import type { LlmArenaCopy } from './LlmArenaTypes';
import { LLM_ARENA_EVALUATION_CONFIG, type LlmArenaScoringProfile } from './LlmArenaEvaluation';

interface LlmArenaMethodPanelProps {
  copy: LlmArenaCopy;
  systemPrompt: string;
  userPrompt: string;
  onSystemPromptChange: (next: string) => void;
  onUserPromptChange: (next: string) => void;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  sampleCount: number;
  scoringProfile: LlmArenaScoringProfile;
  onTemperatureChange: (next: number) => void;
  onMaxTokensChange: (next: number) => void;
  onTimeoutMsChange: (next: number) => void;
  onSampleCountChange: (next: number) => void;
  onScoringProfileChange: (next: LlmArenaScoringProfile) => void;
  onAutoAddTopModels: () => void;
  autoAddHint?: string;
}

export function LlmArenaMethodPanel({
  copy,
  systemPrompt,
  userPrompt,
  onSystemPromptChange,
  onUserPromptChange,
  temperature,
  maxTokens,
  timeoutMs,
  sampleCount,
  scoringProfile,
  onTemperatureChange,
  onMaxTokensChange,
  onTimeoutMsChange,
  onSampleCountChange,
  onScoringProfileChange,
  onAutoAddTopModels,
  autoAddHint,
}: LlmArenaMethodPanelProps) {
  const methodDocAbsolutePath = '/Volumes/KLEVV-4T-1/Project-Manager/docs/engineering/llm-vlm-arena-evaluation-spec-v1.md';
  const methodDocHref = '/docs/engineering/llm-vlm-arena-evaluation-spec-v1.md';

  const handleOpenMethodDoc = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    void openPath(methodDocAbsolutePath)
      .then(() => {})
      .catch(() => {
        window.open(methodDocHref, '_blank', 'noopener,noreferrer');
      });
  };

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 p-4 shadow-xl backdrop-blur-sm rounded-sm lg:col-span-12">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{copy.methodTitle}</h2>
          <a
            href={methodDocHref}
            target="_blank"
            rel="noreferrer"
            onClick={handleOpenMethodDoc}
            className="shrink-0 cursor-pointer text-[11px] text-emerald-300 hover:text-emerald-200"
          >
            {copy.methodDocLink}
          </a>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">System Prompt</p>
              <textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                className="h-24 w-full resize-none border border-stone-200/15 bg-[rgb(var(--pm-input))] p-2 font-mono text-[11px] leading-relaxed text-stone-100 outline-none focus:ring-1 focus:ring-emerald-400/50"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">User Prompt</p>
              <textarea
                value={userPrompt}
                onChange={(e) => onUserPromptChange(e.target.value)}
                className="h-28 w-full resize-none border border-stone-200/15 bg-[rgb(var(--pm-input))] p-2 font-mono text-[11px] leading-relaxed text-stone-100 outline-none focus:ring-1 focus:ring-emerald-400/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <label className="space-y-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">
              Temperature
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => onTemperatureChange(Number(e.target.value))}
                className="h-8 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 font-mono text-xs text-stone-100 outline-none"
              />
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">
              Max Tokens
              <input
                type="number"
                min={LLM_ARENA_EVALUATION_CONFIG.minMaxTokens}
                max={LLM_ARENA_EVALUATION_CONFIG.maxMaxTokens}
                step={64}
                value={maxTokens}
                onChange={(e) => onMaxTokensChange(Number(e.target.value))}
                className="h-8 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 font-mono text-xs text-stone-100 outline-none"
              />
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">
              Timeout ms
              <input
                type="number"
                min={LLM_ARENA_EVALUATION_CONFIG.minTimeoutMs}
                max={LLM_ARENA_EVALUATION_CONFIG.maxTimeoutMs}
                step={5000}
                value={timeoutMs}
                onChange={(e) => onTimeoutMsChange(Number(e.target.value))}
                className="h-8 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 font-mono text-xs text-stone-100 outline-none"
              />
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">
              Samples
              <input
                type="number"
                min={LLM_ARENA_EVALUATION_CONFIG.minSampleCount}
                max={LLM_ARENA_EVALUATION_CONFIG.maxSampleCount}
                step={1}
                value={sampleCount}
                onChange={(e) => onSampleCountChange(Number(e.target.value))}
                className="h-8 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 font-mono text-xs text-stone-100 outline-none"
              />
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">
              Profile
              <select
                value={scoringProfile}
                onChange={(e) => onScoringProfileChange(e.target.value as LlmArenaScoringProfile)}
                className="h-8 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-100 outline-none"
              >
                <option className="bg-stone-900" value="balanced_default">balanced_default</option>
                <option className="bg-stone-900" value="quality_first">quality_first</option>
                <option className="bg-stone-900" value="cost_latency_first">cost_latency_first</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAutoAddTopModels}
              className="inline-flex items-center rounded border border-emerald-200/25 bg-emerald-100/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18"
            >
              {copy.autoAddTopModels}
            </button>
            {autoAddHint ? <span className="text-[11px] text-stone-400">{autoAddHint}</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
