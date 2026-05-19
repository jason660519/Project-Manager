'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Loader2, Play, Timer, Settings2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { CronJob } from '../../../lib/types';

interface CronControlPanelProps {
  cronJobs: CronJob[];
  onCronJobsChange: (jobs: CronJob[]) => void;
  /** Optional callback for triggering an immediate run. */
  onRunJob?: (job: CronJob) => Promise<void>;
}

const INTERVAL_PRESETS: Array<{ label: string; value: number; unit: 'minutes' | 'hours' }> = [
  { label: '1m',  value: 1,  unit: 'minutes' },
  { label: '5m',  value: 5,  unit: 'minutes' },
  { label: '15m', value: 15, unit: 'minutes' },
  { label: '30m', value: 30, unit: 'minutes' },
  { label: '1h',  value: 1,  unit: 'hours' },
];

function formatTime(iso?: string) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function CronControlPanel({ cronJobs, onCronJobsChange, onRunJob }: CronControlPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const enabledCount = cronJobs.filter((j) => j.enabled).length;

  const toggleEnabled = useCallback((id: string) => {
    onCronJobsChange(cronJobs.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j)));
  }, [cronJobs, onCronJobsChange]);

  const setInterval = useCallback((id: string, value: number, unit: 'minutes' | 'hours') => {
    onCronJobsChange(cronJobs.map((j) => (
      j.id === id ? { ...j, schedule: { type: 'every', value, unit } } : j
    )));
  }, [cronJobs, onCronJobsChange]);

  const run = useCallback(async (job: CronJob) => {
    if (!onRunJob) return;
    setRunningId(job.id);
    try { await onRunJob(job); } finally { setRunningId(null); }
  }, [onRunJob]);

  return (
    <div className="rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-cyan-300" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-100">
            Cron ({enabledCount}/{cronJobs.length} enabled)
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>
      {expanded && (
        <div className="border-t border-stone-200/15 p-2">
          {cronJobs.length === 0 ? (
            <div className="flex items-center justify-between px-1 py-1">
              <p className="text-[11px] text-stone-500">No cron jobs configured.</p>
              <Link href="/cron-jobs" className="text-[11px] text-emerald-300 hover:text-emerald-200">Open Cron Jobs →</Link>
            </div>
          ) : (
            <div className="grid gap-1.5">
              {cronJobs.map((job) => {
                const isRunning = runningId === job.id;
                return (
                  <div key={job.id} className="rounded border border-stone-200/10 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-stone-100">{job.name}</p>
                        <p className="text-[10px] text-stone-400">
                          last run {formatTime(job.lastRun)}
                          {job.lastStatus && (
                            <span className={clsx(
                              'ml-1',
                              job.lastStatus === 'ok' ? 'text-emerald-300' : 'text-red-300',
                            )}>· {job.lastStatus}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleEnabled(job.id)}
                          className={clsx(
                            'h-5 rounded border px-1.5 text-[10px] font-medium',
                            job.enabled
                              ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-200'
                              : 'border-stone-200/15 text-stone-400',
                          )}
                        >{job.enabled ? 'enabled' : 'disabled'}</button>
                        {onRunJob && (
                          <button
                            onClick={() => run(job)}
                            disabled={isRunning}
                            className="flex h-5 w-5 items-center justify-center rounded border border-stone-200/15 text-stone-300 hover:text-stone-100 hover:bg-white/10 disabled:opacity-40"
                            title="Run now"
                          >
                            {isRunning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                          </button>
                        )}
                        <Link
                          href="/cron-jobs"
                          className="flex h-5 w-5 items-center justify-center rounded border border-stone-200/15 text-stone-300 hover:text-stone-100"
                          title="Edit"
                        >
                          <Settings2 size={11} />
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[10px] text-stone-400">interval</span>
                      {INTERVAL_PRESETS.map((p) => {
                        const active = job.schedule.value === p.value && job.schedule.unit === p.unit;
                        return (
                          <button
                            key={p.label}
                            onClick={() => setInterval(job.id, p.value, p.unit)}
                            className={clsx(
                              'h-5 rounded border px-1.5 text-[10px]',
                              active
                                ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                                : 'border-stone-200/15 text-stone-400 hover:text-stone-100',
                            )}
                          >{p.label}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
