'use client';

import { useState } from 'react';
import { Activity, CheckCircle2, Clock, Terminal, XCircle } from 'lucide-react';
import { ActiveRun, CompletedRun } from '../../../lib/types';
import { useI18n } from '../../../lib/i18n';

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
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function RunsView({ activeRuns, runHistory, onKillRun }: RunsViewProps) {
  const { t } = useI18n();
  const [expandedPid, setExpandedPid] = useState<number | null>(null);
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null);
  const [killConfirmPid, setKillConfirmPid] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Runs</h1>
        <p className="mt-1 text-xs text-stone-400">
          {activeRuns.length > 0
            ? `${t.runs.runsSummary.replace('{count}', String(activeRuns.length))} · `
            : ''}
          {runHistory.length} {t.runs.history.toLowerCase()}.
        </p>
      </div>

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">{t.runs.active}</h2>
          <div className="space-y-3">
            {activeRuns.map((run) => {
              const isPending = run.phase === 'pending';
              return (
              <div key={run.pid} className="border border-emerald-200/25 bg-[rgb(var(--pm-panel))]/72">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Activity
                    size={15}
                    className={`shrink-0 animate-pulse ${isPending ? 'text-amber-300' : 'text-emerald-400'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-100">{run.featureName}</span>
                      <span className="font-mono text-xs text-stone-500">PID {run.pid}</span>
                      {isPending && (
                        <span className="text-xs text-amber-300">{t.runs.preparing}</span>
                      )}
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
                      {expandedPid === run.pid ? t.runs.hideLog : t.runs.viewLog}
                    </button>
                    {killConfirmPid === run.pid ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-white">{t.runs.killConfirmTitle}</span>
                        <button
                          onClick={() => {
                            onKillRun(run.pid);
                            setKillConfirmPid(null);
                          }}
                          className="border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                        >
                          {t.runs.killConfirm}
                        </button>
                        <button
                          onClick={() => setKillConfirmPid(null)}
                          className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                        >
                          {t.runs.killCancel}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setKillConfirmPid(run.pid)}
                        className="border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                      >
                        {t.runs.kill}
                      </button>
                    )}
                  </div>
                </div>
                {expandedPid === run.pid && !isPending && (
                  <div className="border-t border-stone-200/12 bg-[rgb(var(--pm-input))] p-3">
                    <div className="max-h-48 overflow-auto font-mono text-xs leading-5 text-stone-300">
                      {run.logs.length === 0 ? (
                        <span className="animate-pulse text-stone-500">{t.runs.waitingOutput}</span>
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
              );
            })}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">{t.runs.history}</h2>
        {runHistory.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-stone-200/18 text-center">
            <Terminal className="mb-2 text-stone-500" size={24} />
            <p className="text-sm text-stone-400">{t.runs.noRuns}</p>
            <p className="mt-1 text-xs text-stone-500">{t.runs.noRunsHint}</p>
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
                        {t.runs.exit} {run.exitCode}
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
