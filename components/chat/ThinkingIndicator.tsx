'use client';

import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface ThinkingIndicatorProps {
  /** Whether the AI is currently thinking */
  active: boolean;
  /** Accumulated thinking text */
  text?: string;
  /** Called when thinking starts */
  onStart?: () => void;
}

// ── Random thinking messages ────────────────────────────────────────────────

const THINKING_MESSAGES = [
  '分析專案結構中...',
  '思考最佳方案中...',
  '讀取相關檔案...',
  '搜尋程式碼...',
  '比對功能規格...',
  '檢查測試覆蓋率...',
  '評估技術方案...',
  '整理思緒中...',
  '回憶先前對話...',
  '查閱專案文件...',
];

// ── Component ───────────────────────────────────────────────────────────────

export function ThinkingIndicator({ active, text, onStart }: ThinkingIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState(THINKING_MESSAGES[0]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active && onStart) onStart();
    
    if (active) {
      let idx = 0;
      intervalRef.current = setInterval(() => {
        idx = (idx + 1) % THINKING_MESSAGES.length;
        setMessage(THINKING_MESSAGES[idx]);
      }, 2000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, onStart]);

  if (!active && !text) return null;

  return (
    <div className="mr-4 mb-2">
      <button
        type="button"
        onClick={() => text && setExpanded(!expanded)}
        className={[
          'flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-[10px] transition-all',
          active
            ? 'border-amber-200/15 bg-amber-950/15 text-amber-200/70'
            : 'border-stone-200/10 bg-stone-950/40 text-stone-400',
        ].join(' ')}
      >
        <Brain size={12} className={active ? 'text-amber-300/60 animate-pulse' : 'text-stone-500'} />
        <span className="flex-1 text-left">
          {active ? (
            <span className="flex items-center gap-1.5">
              <span>{message}</span>
              <span className="flex gap-0.5">
                <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: '0ms' }} />
                <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: '150ms' }} />
                <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: '300ms' }} />
              </span>
            </span>
          ) : (
            '思考過程'
          )}
        </span>
        {text && (
          <span className="shrink-0 text-stone-500">
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        )}
      </button>

      {/* Expanded thinking text */}
      {expanded && text && (
        <div className="mt-1 rounded border border-stone-200/10 bg-stone-950/50 px-2.5 py-1.5 font-mono text-[9px] leading-relaxed text-stone-400/80 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
}
