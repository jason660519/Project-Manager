'use client';

import { Activity, Bot, CheckCircle2, FileCode, FileText, FlaskConical, X, XCircle } from 'lucide-react';
import { ActiveRun, CompletedRun, Feature } from '../../lib/types';

interface FeatureDetailPanelProps {
  feature: Feature;
  runHistory: CompletedRun[];
  activeRun?: ActiveRun;
  onDispatch: () => void;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  on_hold: 'Blocked',
};

const STATUS_STYLES: Record<string, string> = {
  todo: 'border-stone-300/20 bg-stone-200/10 text-stone-200',
  in_progress: 'border-cyan-200/20 bg-cyan-100/10 text-cyan-100',
  done: 'border-emerald-200/20 bg-emerald-100/10 text-emerald-100',
  on_hold: 'border-amber-200/20 bg-amber-100/10 text-amber-100',
};

function PathRow({
  label,
  path,
  icon: Icon,
}: {
  label: string;
  path?: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
}) {
  if (!path) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon size={13} className="mt-0.5 shrink-0 text-stone-500" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-stone-500">{label}</div>
        <div className="mt-0.5 truncate font-mono text-xs text-stone-300">{path}</div>
      </div>
    </div>
  );
}

export function FeatureDetailPanel({
  feature,
  runHistory,
  activeRun,
  onDispatch,
  onClose,
}: FeatureDetailPanelProps) {
  const hasPaths = Object.values(feature.paths).some(Boolean);

  return (
    <aside className="flex flex-col border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-stone-200/12 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-stone-500">{feature.id}</span>
            <span
              className={`border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${STATUS_STYLES[feature.status]}`}
            >
              {STATUS_LABELS[feature.status]}
            </span>
          </div>
          <h2 className="mt-1 text-sm font-semibold text-stone-100">{feature.name}</h2>
          <p className="mt-0.5 text-[11px] text-stone-500">{feature.category}</p>
        </div>
        <button onClick={onClose} className="ml-3 text-stone-400 hover:text-stone-100">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Progress */}
        <div className="border-b border-stone-200/10 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Progress</span>
            <span className="font-mono text-xs text-stone-300">{feature.progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-stone-200/15">
            <div
              className="h-1.5 bg-emerald-400 transition-all"
              style={{ width: `${Math.min(100, feature.progress)}%` }}
            />
          </div>
        </div>

        {/* Notes */}
        {feature.notes && (
          <div className="border-b border-stone-200/10 px-4 py-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-500">Notes</div>
            <p className="text-xs leading-5 text-stone-300">{feature.notes}</p>
          </div>
        )}

        {/* Active Run */}
        {activeRun && (
          <div className="border-b border-stone-200/10 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <Activity size={12} className="animate-pulse text-emerald-400" />
              <span className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Running</span>
              <span className="ml-auto font-mono text-xs text-stone-500">PID {activeRun.pid}</span>
            </div>
            <div className="max-h-24 overflow-auto border border-stone-200/12 bg-[rgb(var(--pm-input))] p-2">
              <div className="font-mono text-xs leading-4 text-stone-300">
                {activeRun.logs.length === 0 ? (
                  <span className="animate-pulse text-stone-500">Waiting…</span>
                ) : (
                  activeRun.logs.slice(-10).map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Paths */}
        {hasPaths && (
          <div className="border-b border-stone-200/10 px-4 py-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-stone-500">Paths</div>
            <div className="divide-y divide-stone-200/8">
              <PathRow label="Spec" path={feature.paths.spec} icon={FileText} />
              <PathRow label="TDD" path={feature.paths.tdd} icon={FlaskConical} />
              <PathRow label="Implementation" path={feature.paths.implementation} icon={FileCode} />
            </div>
          </div>
        )}

        {/* Run History */}
        <div className="px-4 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-stone-500">
            Run History ({runHistory.length})
          </div>
          {runHistory.length === 0 ? (
            <p className="text-xs text-stone-500">No runs yet for this feature.</p>
          ) : (
            <div className="space-y-1.5">
              {runHistory.slice(0, 5).map((run, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {run.success ? (
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size={12} className="shrink-0 text-red-400" />
                  )}
                  <span className="truncate font-mono text-stone-400">{run.command}</span>
                  <span className="ml-auto shrink-0 text-stone-500">
                    {new Date(run.completedAt).toLocaleTimeString('zh-TW', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-stone-200/12 p-4">
        <button
          onClick={onDispatch}
          disabled={!!activeRun}
          className="inline-flex w-full items-center justify-center gap-2 border border-emerald-200/25 bg-emerald-100/10 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Bot size={15} />
          {activeRun ? 'Agent Running…' : 'Dispatch to Agent'}
        </button>
      </div>
    </aside>
  );
}
