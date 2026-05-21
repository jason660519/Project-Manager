'use client';

import React from 'react';
import { LLM_METHOD_ROWS } from './LlmArenaTypes';

interface LlmArenaMethodPanelProps {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  onSystemPromptChange: (next: string) => void;
  onUserPromptChange: (next: string) => void;
  onTemperatureChange: (next: number) => void;
  onAutoAddTopModels: () => void;
  autoAddHint?: string;
}

export function LlmArenaMethodPanel({
  systemPrompt,
  userPrompt,
  temperature,
  onSystemPromptChange,
  onUserPromptChange,
  onTemperatureChange,
  onAutoAddTopModels,
  autoAddHint,
}: LlmArenaMethodPanelProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 p-4 shadow-xl backdrop-blur-sm rounded-sm lg:col-span-5">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">LLM 能力評測設定</h2>
        <div className="space-y-3">
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
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
              Temperature
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => onTemperatureChange(Number(e.target.value))}
                className="mt-1 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-100 outline-none"
              />
            </label>
            <div className="rounded-sm border border-stone-200/12 bg-black/20 px-2 py-1.5 text-[11px] text-stone-300">
              <p className="text-[10px] uppercase tracking-[0.14em] text-stone-400">評測說明</p>
              <p className="mt-1">同一組 Prompt 同步比對多模型，觀察品質、延遲、token 與可用性。</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAutoAddTopModels}
              className="inline-flex items-center rounded border border-emerald-200/25 bg-emerald-100/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18"
            >
              一鍵新增頂尖模型（依已存金鑰）
            </button>
            {autoAddHint ? <span className="text-[11px] text-stone-400">{autoAddHint}</span> : null}
          </div>
        </div>
      </div>

      <div className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 p-4 shadow-xl backdrop-blur-sm rounded-sm lg:col-span-7">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">LLM 能力評測方法</h2>
        <div className="overflow-x-auto border border-stone-200/12 bg-black/10">
          <table className="min-w-full border-collapse text-left">
            <thead className="border-b border-stone-200/15 bg-white/[0.035]">
              <tr>
                <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">評測維度</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">觀測方式</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">通過標準</th>
              </tr>
            </thead>
            <tbody>
              {LLM_METHOD_ROWS.map((row) => (
                <tr key={row.dimension} className="border-b border-stone-200/10 last:border-b-0">
                  <td className="px-3 py-2 text-xs text-stone-200">{row.dimension}</td>
                  <td className="px-3 py-2 text-xs text-stone-300">{row.observe}</td>
                  <td className="px-3 py-2 text-xs text-stone-300">{row.passRule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
