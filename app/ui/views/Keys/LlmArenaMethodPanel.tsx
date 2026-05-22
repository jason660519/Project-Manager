'use client';

import React from 'react';
import { openPath } from '../../../../lib/bridge';

interface LlmArenaMethodPanelProps {
  systemPrompt: string;
  userPrompt: string;
  onSystemPromptChange: (next: string) => void;
  onUserPromptChange: (next: string) => void;
  onAutoAddTopModels: () => void;
  autoAddHint?: string;
}

export function LlmArenaMethodPanel({
  systemPrompt,
  userPrompt,
  onSystemPromptChange,
  onUserPromptChange,
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
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">LLM 能力評測設定</h2>
          <a
            href={methodDocHref}
            target="_blank"
            rel="noreferrer"
            onClick={handleOpenMethodDoc}
            className="shrink-0 cursor-pointer text-[11px] text-emerald-300 hover:text-emerald-200"
          >
            查看評測方法文件 ↗
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
    </section>
  );
}
