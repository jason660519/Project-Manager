'use client';

import { useState } from 'react';
import { Activity, CheckCircle2, Clock, Terminal, XCircle } from 'lucide-react';
import { ActiveRun, CompletedRun } from '../../../lib/types';

interface RunsViewProps {
  activeRuns: ActiveRun[];
  runHistory: CompletedRun[];
  onKillRun: (pid: number) => void;
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function RunsView({ activeRuns, runHistory, onKillRun }: RunsViewProps) {
  const [expandedPid, setExpandedPid] = useState<number | null>(null);
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Runs</h1>
        <p className="mt-1 text-xs text-stone-400">
          {activeRuns.length > 0 ? `${activeRuns.length} active · ` : ''}
          {runHistory.length} in history.
        </p>
      </div>

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">Active</h2>
          <div className="space-y-3">
            {activeRuns.map((run) => (
              <div key={run.pid} className="border border-emerald-200/25 bg-[rgb(var(--pm-panel))]/72">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Activity size={15} className="shrink-0 animate-pulse text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-100">{run.featureName}</span>
                      <span className="font-mono text-xs text-stone-500">PID {run.pid}</span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-stone-400">
                      {run.command} {run.args.join(' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">
                      {formatDuration(Date.now() - run.startedAt)}
                    </span>
                    <button
                      onClick={() => setExpandedPid(expandedPid === run.pid ? null : run.pid)}
                      className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                    >
                      {expandedPid === run.pid ? 'Hide Log' : 'View Log'}
                    </button>
                    <button
                      onClick={() => onKillRun(run.pid)}
                      className="border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                    >
                      Kill
                    </button>
                  </div>
                </div>
                {expandedPid === run.pid && (
                  <div className="border-t border-stone-200/12 bg-[rgb(var(--pm-input))] p-3">
                    <div className="max-h-48 overflow-auto font-mono text-xs leading-5 text-stone-300">
                      {run.logs.length === 0 ? (
                        <span className="animate-pulse text-stone-500">Waiting for output…</span>
                      ) : (
                        run.logs.slice(-50).map((line, i) => (
                          <div key={i} className="whitespace-pre-wrap break-all">
                            {line}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">History</h2>
        {runHistory.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-stone-200/18 text-center">
            <Terminal className="mb-2 text-stone-500" size={24} />
            <p className="text-sm text-stone-400">No runs yet in this session.</p>
            <p className="mt-1 text-xs text-stone-500">
              Dispatch a feature from Dashboard or Features to see history here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {runHistory.map((run, i) => (
              <div key={`${run.pid}-${i}`} className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"
                  onClick={() => setExpandedHistoryIdx(expandedHistoryIdx === i ? null : i)}
                >
                  {run.success ? (
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size={15} className="shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-100">{run.featureName}</span>
                      <span
                        className={`text-xs ${run.success ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        exit {run.exitCode}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-stone-500">
                      {run.command} {run.args.slice(0, 2).join(' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-500">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatDuration(run.completedAt - run.startedAt)}
                    </span>
                    <span>{formatTime(run.completedAt)}</span>
                  </div>
                </div>
                {expandedHistoryIdx === i && run.logs.length > 0 && (
                  <div className="border-t border-stone-200/12 bg-[rgb(var(--pm-input))] p-3">
                    <div className="max-h-48 overflow-auto font-mono text-xs leading-5 text-stone-300">
                      {run.logs.slice(-50).map((line, li) => (
                        <div key={li} className="whitespace-pre-wrap break-all">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
