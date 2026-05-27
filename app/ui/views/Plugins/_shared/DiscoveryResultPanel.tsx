'use client';

import { RefreshCw, X } from 'lucide-react';
import type { DiscoveryRunSummary } from '../../../../../lib/integrations/discovery/summarize';
import { DiscoveryRunSummaryView } from './DiscoveryRunSummaryView';

export interface DiscoveryResultPanelProps {
  summary: DiscoveryRunSummary | null;
  warnings: string[];
  running: boolean;
  onClose: () => void;
  onRunAgain?: () => void;
}

/** Persistent floating summary — only closes when the user clicks Done or X. */
export function DiscoveryResultPanel({
  summary,
  warnings,
  running,
  onClose,
  onRunAgain,
}: DiscoveryResultPanelProps) {
  const title = running ? 'Discovering…' : 'Discovery complete';

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[85vh] w-[480px] max-w-[95vw] flex-col border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-stone-200/12 px-4 py-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className={`text-emerald-300 ${running ? 'animate-spin' : ''}`} />
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-100">{title}</h3>
          {!running && summary && (
            <span className="font-mono text-[10px] text-stone-500">{summary.durationMs}ms</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={running}
          className="text-stone-500 hover:text-stone-200 disabled:opacity-40"
          aria-label="Close discovery result"
          title={running ? 'Wait for scan to finish' : 'Close'}
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <DiscoveryRunSummaryView summary={summary} warnings={warnings} running={running} />
      </div>

      {!running && (
        <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200/10 px-4 py-3">
          {onRunAgain && (
            <button
              type="button"
              onClick={onRunAgain}
              className="border border-stone-200/20 px-3 py-1.5 text-xs text-stone-300"
            >
              Configure again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="border border-emerald-400/30 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
