'use client';

import React from 'react';
import { Eye, History, Trash2 } from 'lucide-react';
import type { ArenaResult } from './useArenaChat';
import { SCORE_LABELS, type RowScore } from './VlmArenaTypes';

interface VlmArenaReviewCellProps {
  result?: ArenaResult;
  score: RowScore;
  note: string;
  historyCount: number;
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
          {(Object.keys(SCORE_LABELS) as RowScore[]).map((item) => (
            <option key={item} value={item} className="bg-stone-900">
              {SCORE_LABELS[item]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="填寫觀察重點"
          className="w-full min-w-[180px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
        />
      </td>
      <td className="px-3 py-2 text-xs text-stone-300 max-w-[360px]">
        <p className="line-clamp-3 whitespace-pre-wrap break-words">
          {result ? (result.error || result.content || '無回覆內容') : '尚未執行'}
        </p>
      </td>
      <td className="px-3 py-2 text-xs text-stone-300">
        <button
          onClick={onOpenDetail}
          className="inline-flex items-center gap-1 border border-stone-200/20 px-2 py-1 hover:bg-white/[0.04]"
        >
          <History size={12} />
          {historyCount}
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenDetail}
            className="text-stone-500 hover:text-emerald-300"
            title="查看詳情"
          >
            <Eye size={13} />
          </button>
          <button onClick={onRemove} className="text-stone-500 hover:text-red-400" title="刪除列">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </>
  );
}

