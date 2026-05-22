'use client';

import React from 'react';

interface VlmArenaPromptCellProps {
  systemPrompt: string;
  userPrompt: string;
  onSystemPromptChange: (next: string) => void;
  onUserPromptChange: (next: string) => void;
}

export function VlmArenaPromptCell({
  systemPrompt,
  userPrompt,
  onSystemPromptChange,
  onUserPromptChange,
}: VlmArenaPromptCellProps) {
  return (
    <>
      <td className="px-3 py-2">
        <textarea
          value={systemPrompt}
          onChange={(event) => onSystemPromptChange(event.target.value)}
          placeholder="每列專屬 System Prompt"
          className="h-20 w-full min-w-[260px] resize-none bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs p-2 font-mono outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <textarea
          value={userPrompt}
          onChange={(event) => onUserPromptChange(event.target.value)}
          placeholder="每列專屬 User Prompt Base"
          className="h-20 w-full min-w-[320px] resize-none bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs p-2 font-mono outline-none"
        />
      </td>
    </>
  );
}
