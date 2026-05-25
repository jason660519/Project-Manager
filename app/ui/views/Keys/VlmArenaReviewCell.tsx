'use client';

import React from 'react';
import { Eye, History, Trash2 } from 'lucide-react';
import type { ArenaResult } from './useArenaChat';
import { ROW_SCORE_IDS, scoreLabel, type RowScore, type VlmArenaCopy } from './VlmArenaTypes';

interface VlmArenaReviewCellProps {
  result?: ArenaResult;
  score: RowScore;
  note: string;
  historyCount: number;
  copy: VlmArenaCopy;
  onScoreChange: (score: RowScore) => void;
  onNoteChange: (note: string) => void;
  onOpenDetail: () => void;
  onRemove: () => void;
}

export function VlmArenaReviewCell({
  result,
  score,
  note,
  historyCount,
  copy,
  onScoreChange,
  onNoteChange,
  onOpenDetail,
  onRemove,
}: VlmArenaReviewCellProps) {
  return (
    <>
      <td className="px-3 py-2">
        <select
          value={score}
          onChange={(event) => onScoreChange(event.target.value as RowScore)}
          className="w-full min-w-[120px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
        >
          {ROW_SCORE_IDS.map((item) => (
            <option key={item} value={item} className="bg-stone-900">
              {scoreLabel(item, copy)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={copy.notePlaceholder}
          className="w-full min-w-[180px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
        />
      </td>
      <td className="px-3 py-2 text-xs text-stone-300 max-w-[360px]">
        <p className="line-clamp-3 whitespace-pre-wrap break-words">
          {result ? (result.error || result.content || copy.noResponseContent) : copy.notRun}
        </p>
      </td>
      <td className="px-3 py-2 text-xs text-stone-300">
        <button
          onClick={onOpenDetail}
          className="inline-flex items-center gap-1 rounded border border-stone-300/20 bg-stone-200/5 px-2 py-1 text-[11px] text-stone-200 hover:bg-stone-200/10"
        >
          <History size={12} />
          {historyCount}
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenDetail}
            className="inline-flex items-center gap-1 rounded border border-stone-300/20 bg-stone-200/5 px-2 py-1 text-[11px] text-stone-200 hover:bg-stone-200/10"
            title={copy.viewDetailTitle}
          >
            <Eye size={13} />
            View
          </button>
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
            title={copy.deleteRowTitle}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </td>
    </>
  );
}
