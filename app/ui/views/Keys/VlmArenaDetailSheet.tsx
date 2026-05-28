'use client';

import React from 'react';
import { History, Loader2, XCircle } from 'lucide-react';
import type { RunHistoryEntry, VlmArenaCopy } from './VlmArenaTypes';
import type { VlmImageToImageRow } from './VlmImageToImageEvaluation';

interface VlmArenaDetailSheetProps {
  copy: VlmArenaCopy;
  selectedDetailIndex: number | null;
  row?: VlmImageToImageRow;
  history: RunHistoryEntry[];
  onClose: () => void;
}

export function VlmArenaDetailSheet({
  copy,
  selectedDetailIndex,
  row,
  history,
  onClose,
}: VlmArenaDetailSheetProps) {
  if (selectedDetailIndex === null || !row) return null;

  return (
    <section className="fixed inset-y-0 right-0 z-40 w-[460px] border-l border-stone-200/12 bg-[rgb(var(--pm-bg))] shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-stone-400">{copy.detailTitle}</p>
            <p className="text-sm text-stone-100">{row.provider} / {row.model}</p>
            {row.runStatus === 'running' ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-stone-400">
                <Loader2 size={12} className="animate-spin" />
                評估中
              </p>
            ) : null}
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200">
            <XCircle size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">Result</p>
            <p className="text-xs text-stone-200">{row.message || row.runStatus}</p>
            <div className="mt-2 flex gap-3 text-[11px] text-stone-400">
              <span>E2E {row.e2eMs == null ? '—' : Math.round(row.e2eMs)} ms</span>
              <span>HTTP {row.httpStatus ?? '—'}</span>
            </div>
          </div>
          {(row.resultImage2dUrl || row.resultImageUrl || row.resultImage3dUrl) && (
            <div className="grid grid-cols-1 gap-3">
              {(row.resultImage2dUrl || row.resultImageUrl) && (
                <a href={row.resultImage2dUrl || row.resultImageUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm border border-emerald-300/30 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.resultImage2dUrl || row.resultImageUrl} alt="2D 圖生圖模型輸出" className="max-h-[280px] w-full object-contain" />
                </a>
              )}
              {row.resultImage3dUrl && (
                <a href={row.resultImage3dUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm border border-emerald-300/30 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.resultImage3dUrl} alt="3D 圖生圖模型輸出" className="max-h-[280px] w-full object-contain" />
                </a>
              )}
            </div>
          )}
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">{copy.composedPrompt}</p>
            <pre className="whitespace-pre-wrap text-xs text-stone-300 font-mono">{row.prompt}</pre>
          </div>
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">{copy.latestOutput}</p>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-stone-300 font-mono">
              {row.resultText || row.message || copy.notRun}
            </pre>
          </div>
          <div className="border border-stone-200/12 bg-black/20 p-3">
            <p className="mb-2 flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">
              <History size={12} />
              {copy.runHistory}
            </p>
            <div className="space-y-2">
              {history.length === 0 && <p className="text-xs text-stone-500">{copy.historyEmpty}</p>}
              {history.map((item) => (
                <div key={item.timestamp} className="border border-stone-200/10 p-2">
                  <p className="text-[11px] text-stone-300">{new Date(item.timestamp).toLocaleString()}</p>
                  <p className="text-[11px] text-stone-400">{item.message || item.result.error || '測試完成。'}</p>
                  <p className="mt-1 text-[11px] text-stone-200 line-clamp-3 whitespace-pre-wrap">{item.result.error || item.result.content || copy.noOutput}</p>
                  <p className="mt-1 font-mono text-[10px] text-stone-500">HTTP {item.httpStatus ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
