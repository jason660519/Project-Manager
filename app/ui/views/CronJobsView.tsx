'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Pencil, Play, Plus, Timer, Trash2, XCircle } from 'lucide-react';
import type { CronJob, CronRun } from '../../../lib/types';

interface CronJobsViewProps {
  cronJobs: CronJob[];
  cronHistory: CronRun[];
  onCronJobsChange: (jobs: CronJob[]) => void;
}

const BLANK_FORM: Omit<CronJob, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  enabled: true,
  schedule: { type: 'every', value: 30, unit: 'minutes' },
  action: { type: 'run-command', command: '', args: [], workingDir: '' },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function scheduleLabel(job: CronJob): string {
  return `Every ${job.schedule.value} ${job.schedule.unit}`;
}

function nextRunLabel(job: CronJob, nextRunMs: number | undefined): string {
  if (!job.enabled) return '—';
  if (!nextRunMs) return 'pending';
  const diff = nextRunMs - Date.now();
  if (diff <= 0) return 'now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  return `in ${Math.floor(m / 60)}h ${m % 60}m`;
}

export function CronJobsView({ cronJobs, cronHistory, onCronJobsChange }: CronJobsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [argsRaw, setArgsRaw] = useState('');
  const [nextRunMap, setNextRunMap] = useState<Record<string, number>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh "next run" display every 10s
  useEffect(() => {
    tickRef.current = setInterval(() => setNextRunMap((m) => ({ ...m })), 10_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const enabledCount = cronJobs.filter((j) => j.enabled).length;
  const nextRuns = cronJobs
    .filter((j) => j.enabled)
    .map((j) => nextRunMap[j.id])
    .filter(Boolean) as number[];
  const soonestNext = nextRuns.length ? Math.min(...nextRuns) : undefined;

  function openNew() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setArgsRaw('');
    setShowForm(true);
  }

  function openEdit(job: CronJob) {
    setEditingId(job.id);
    setForm({
      name: job.name,
      description: job.description ?? '',
      enabled: job.enabled,
      schedule: { ...job.schedule },
      action: { ...job.action },
    });
    setArgsRaw(job.action.args.join(' '));
    setShowForm(true);
  }

  function handleSave() {
    const args = argsRaw
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const action = { ...form.action, args };

    if (!form.name.trim() || !form.action.command.trim()) return;

    if (editingId) {
      onCronJobsChange(
        cronJobs.map((j) =>
          j.id === editingId ? { ...j, ...form, action } : j,
        ),
      );
    } else {
      const newJob: CronJob = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...form,
        action,
      };
      onCronJobsChange([...cronJobs, newJob]);
    }
    setShowForm(false);
  }

  function handleDelete(id: string) {
    onCronJobsChange(cronJobs.filter((j) => j.id !== id));
  }

  function handleToggle(id: string) {
    onCronJobsChange(
      cronJobs.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j)),
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
            Cron Jobs
          </h1>
          <p className="mt-1 text-xs text-stone-400">
            Scheduled commands that run while the app is open.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 border border-emerald-400/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/40"
        >
          <Plus size={13} />
          New Job
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Enabled', value: `${enabledCount} / ${cronJobs.length}` },
          { label: 'History', value: `${cronHistory.length} runs` },
          {
            label: 'Next Wake',
            value: soonestNext
              ? nextRunLabel({ enabled: true } as CronJob, soonestNext)
              : '—',
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/60 px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-stone-100">{value}</p>
          </div>
        ))}
      </div>

      {/* Jobs table */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">Jobs</h2>

        {cronJobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border border-dashed border-stone-200/15 py-12 text-center">
            <Timer size={24} className="text-stone-600" />
            <p className="text-xs text-stone-500">No jobs yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-200/10 border border-stone-200/12">
            {cronJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02]"
              >
                {/* Enabled toggle */}
                <button
                  onClick={() => handleToggle(job.id)}
                  className={[
                    'h-4 w-4 shrink-0 border transition-colors',
                    job.enabled
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-400'
                      : 'border-stone-200/20 bg-transparent text-stone-600',
                  ].join(' ')}
                  title={job.enabled ? 'Disable' : 'Enable'}
                >
                  {job.enabled && (
                    <svg viewBox="0 0 12 12" fill="none" className="h-full w-full p-[1px]">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-100">{job.name}</span>
                    {!job.enabled && (
                      <span className="text-[10px] uppercase tracking-[0.12em] text-stone-600">
                        disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-stone-500">
                    {job.action.command} {job.action.args.join(' ')}
                  </p>
                </div>

                {/* Schedule */}
                <div className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-stone-400">
                  <Clock size={12} className="shrink-0" />
                  {scheduleLabel(job)}
                </div>

                {/* Next run */}
                <div className="w-20 shrink-0 text-right text-xs text-stone-500">
                  {nextRunLabel(job, nextRunMap[job.id])}
                </div>

                {/* Last run */}
                <div className="flex w-28 shrink-0 items-center justify-end gap-1.5 text-xs">
                  {job.lastStatus === 'ok' && (
                    <CheckCircle2 size={12} className="text-emerald-400" />
                  )}
                  {job.lastStatus === 'error' && (
                    <XCircle size={12} className="text-red-400" />
                  )}
                  <span className="text-stone-500">
                    {job.lastRun ? formatRelative(job.lastRun) : '—'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(job)}
                    className="border border-transparent p-1.5 text-stone-400 hover:border-stone-200/20 hover:text-stone-200"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="border border-transparent p-1.5 text-stone-500 hover:border-red-500/30 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Run history */}
      {cronHistory.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">
            Recent Runs
          </h2>
          <div className="divide-y divide-stone-200/10 border border-stone-200/12">
            {[...cronHistory].reverse().slice(0, 20).map((run, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                {run.status === 'ok' ? (
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                ) : (
                  <XCircle size={13} className="shrink-0 text-red-400" />
                )}
                <span className="flex-1 text-xs text-stone-300">{run.jobName}</span>
                {run.pid && (
                  <span className="font-mono text-xs text-stone-600">PID {run.pid}</span>
                )}
                <span className="text-xs text-stone-500">{formatRelative(run.firedAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create / Edit form panel */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40">
          <div className="flex h-full w-[420px] flex-col border-l border-stone-200/15 bg-[rgb(var(--pm-rail))]">
            <div className="flex items-center justify-between border-b border-stone-200/15 px-5 py-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-100">
                {editingId ? 'Edit Job' : 'New Job'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-stone-500 hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Basics */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] uppercase tracking-[0.16em] text-stone-500">
                  Basics
                </legend>

                <div>
                  <label className="mb-1 block text-[11px] text-stone-400">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    className="w-full border border-stone-200/15 bg-transparent px-3 py-2 text-xs text-stone-100 placeholder-stone-600 focus:border-stone-200/40 focus:outline-none"
                    placeholder="e.g. Daily Build"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-stone-400">Description</label>
                  <input
                    className="w-full border border-stone-200/15 bg-transparent px-3 py-2 text-xs text-stone-100 placeholder-stone-600 focus:border-stone-200/40 focus:outline-none"
                    placeholder="Optional description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                    className={[
                      'h-4 w-4 shrink-0 border transition-colors',
                      form.enabled
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-400'
                        : 'border-stone-200/20 bg-transparent',
                    ].join(' ')}
                  >
                    {form.enabled && (
                      <svg viewBox="0 0 12 12" fill="none" className="h-full w-full p-[1px]">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="text-xs text-stone-300">Enabled</span>
                </div>
              </fieldset>

              {/* Schedule */}
              <fieldset className="space-y-3 border-t border-stone-200/10 pt-4">
                <legend className="text-[10px] uppercase tracking-[0.16em] text-stone-500">
                  Schedule
                </legend>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] text-stone-400">
                      Every <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border border-stone-200/15 bg-transparent px-3 py-2 text-xs text-stone-100 focus:border-stone-200/40 focus:outline-none"
                      value={form.schedule.value}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          schedule: { ...f.schedule, value: Number(e.target.value) || 1 },
                        }))
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] text-stone-400">Unit</label>
                    <select
                      className="w-full border border-stone-200/15 bg-[rgb(var(--pm-rail))] px-3 py-2 text-xs text-stone-100 focus:border-stone-200/40 focus:outline-none"
                      value={form.schedule.unit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          schedule: {
                            ...f.schedule,
                            unit: e.target.value as 'minutes' | 'hours',
                          },
                        }))
                      }
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Action */}
              <fieldset className="space-y-3 border-t border-stone-200/10 pt-4">
                <legend className="text-[10px] uppercase tracking-[0.16em] text-stone-500">
                  Command
                </legend>

                <div>
                  <label className="mb-1 block text-[11px] text-stone-400">
                    Command <span className="text-red-400">*</span>
                  </label>
                  <input
                    className="w-full border border-stone-200/15 bg-transparent px-3 py-2 font-mono text-xs text-stone-100 placeholder-stone-600 focus:border-stone-200/40 focus:outline-none"
                    placeholder="e.g. npm"
                    value={form.action.command}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        action: { ...f.action, command: e.target.value },
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-stone-400">
                    Args{' '}
                    <span className="text-stone-600">(space-separated)</span>
                  </label>
                  <input
                    className="w-full border border-stone-200/15 bg-transparent px-3 py-2 font-mono text-xs text-stone-100 placeholder-stone-600 focus:border-stone-200/40 focus:outline-none"
                    placeholder="e.g. run build"
                    value={argsRaw}
                    onChange={(e) => setArgsRaw(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-stone-400">Working Dir</label>
                  <input
                    className="w-full border border-stone-200/15 bg-transparent px-3 py-2 font-mono text-xs text-stone-100 placeholder-stone-600 focus:border-stone-200/40 focus:outline-none"
                    placeholder="/absolute/path/to/project"
                    value={form.action.workingDir}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        action: { ...f.action, workingDir: e.target.value },
                      }))
                    }
                  />
                </div>
              </fieldset>
            </div>

            <div className="flex gap-2 border-t border-stone-200/15 px-5 py-4">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.action.command.trim()}
                className="flex flex-1 items-center justify-center gap-1.5 border border-emerald-400/40 py-2 text-xs text-emerald-300 hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:border-stone-200/15 disabled:text-stone-600"
              >
                <Play size={12} />
                {editingId ? 'Save Changes' : 'Add Job'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="border border-stone-200/20 px-4 py-2 text-xs text-stone-400 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
