'use client';

import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Terminal, TerminalSquare } from 'lucide-react';
import { TableCore } from '../../components/table/TableCore';
import { TaskDispatchModal } from '../../components/table/TaskDispatchModal';
import {
  ActiveRun,
  AnyAdapterConfig,
  CompletedRun,
  Feature,
  FeatureStatus,
  ProjectConfig,
} from '../../lib/types';
import { FeatureDetailPanel } from './FeatureDetailPanel';
import { MetricItem, MetricStrip } from './MetricStrip';

interface DashboardClientProps {
  project: ProjectConfig;
  features: Feature[];
  adapters: AnyAdapterConfig[];
  activeRuns: ActiveRun[];
  runHistory: CompletedRun[];
  onRunStart: (
    pid: number,
    featureId: string,
    featureName: string,
    command: string,
    args: string[],
  ) => void;
  onRunLog: (pid: number, line: string) => void;
  onRunEnd: (pid: number, exitCode: number) => void;
}

const FILTER_OPTIONS: Array<{ label: string; value: FeatureStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Blocked', value: 'on_hold' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'To Do', value: 'todo' },
  { label: 'Done', value: 'done' },
];

export function DashboardClient({
  project,
  features,
  adapters,
  activeRuns,
  runHistory,
  onRunStart,
  onRunLog,
  onRunEnd,
}: DashboardClientProps) {
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>('all');
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [dispatchingFeature, setDispatchingFeature] = useState<Feature | null>(null);

  const blocked = features.filter((f) => f.status === 'on_hold').length;
  const inProgress = features.filter((f) => f.status === 'in_progress').length;
  const ready = features.filter((f) => f.status === 'todo').length;
  const done = features.filter((f) => f.status === 'done').length;

  const filtered =
    statusFilter === 'all' ? features : features.filter((f) => f.status === statusFilter);

  const metrics: MetricItem[] = [
    {
      label: 'Blocked',
      value: blocked.toString(),
      caption: blocked === 0 ? 'no blockers today' : `${blocked} need attention`,
      icon: <AlertTriangle size={18} />,
    },
    {
      label: 'In Progress',
      value: inProgress.toString(),
      caption: `${ready} ready to start`,
      icon: <Activity size={18} />,
    },
    {
      label: 'Done',
      value: done.toString(),
      caption: `of ${features.length} total features`,
      icon: <CheckCircle2 size={18} />,
    },
    {
      label: 'Active Runs',
      value: activeRuns.length.toString(),
      caption: activeRuns.length === 0 ? 'idle' : `${activeRuns.length} agent${activeRuns.length > 1 ? 's' : ''} running`,
      icon: <Terminal size={18} />,
    },
  ];

  const selectedActiveRun = selectedFeature
    ? activeRuns.find((r) => r.featureId === selectedFeature.id)
    : undefined;
  const selectedHistory = selectedFeature
    ? runHistory.filter((r) => r.featureId === selectedFeature.id)
    : [];

  const handleRowClick = (feature: Feature) => {
    setSelectedFeature(feature === selectedFeature ? null : feature);
  };

  return (
    <div className="space-y-5">
      <MetricStrip items={metrics} />

      <section className="space-y-3">
        {/* Filter tabs */}
        <div className="flex w-fit border border-stone-200/18">
          {FILTER_OPTIONS.map((opt) => {
            const count =
              opt.value === 'all'
                ? features.length
                : features.filter((f) => f.status === opt.value).length;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`border-r border-stone-200/18 px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors last:border-r-0 ${
                  statusFilter === opt.value
                    ? 'bg-stone-100 font-medium text-[#071d1a]'
                    : 'text-stone-400 hover:bg-white/5 hover:text-stone-100'
                }`}
              >
                {opt.label}
                <span className="ml-1.5 font-mono opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Feature Matrix */}
          <div className="min-w-0 border border-stone-200/18 bg-[#071d1a]/72">
            <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-50">
                  Feature Matrix
                </h2>
                <p className="mt-1 text-xs text-stone-400">
                  {filtered.length} feature{filtered.length !== 1 ? 's' : ''}
                  {statusFilter !== 'all'
                    ? ` · ${statusFilter === 'on_hold' ? 'blocked' : statusFilter.replace('_', ' ')}`
                    : ''}
                  {' · '}click row to inspect
                </p>
              </div>
            </div>
            <TableCore
              data={filtered}
              onRowClick={handleRowClick}
              onDispatch={setDispatchingFeature}
            />
          </div>

          {/* Right Panel: Feature Detail or Run Inspector */}
          {selectedFeature ? (
            <FeatureDetailPanel
              feature={selectedFeature}
              runHistory={selectedHistory}
              activeRun={selectedActiveRun}
              onDispatch={() => setDispatchingFeature(selectedFeature)}
              onClose={() => setSelectedFeature(null)}
            />
          ) : (
            <aside className="border border-stone-200/18 bg-[#071d1a]/72">
              <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-50">
                  Run Inspector
                </h2>
                {activeRuns.length > 0 && (
                  <span className="border border-emerald-200/30 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-200">
                    {activeRuns.length} active
                  </span>
                )}
              </div>
              <div className="space-y-4 p-4">
                {activeRuns.length > 0 ? (
                  activeRuns.slice(0, 3).map((run) => (
                    <div key={run.pid} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-emerald-100">
                        <Activity size={14} className="animate-pulse" />
                        <span className="truncate">{run.featureName}</span>
                        <span className="ml-auto shrink-0 font-mono text-xs text-stone-500">
                          PID {run.pid}
                        </span>
                      </div>
                      <div className="max-h-20 overflow-auto border border-stone-200/12 bg-[#03100f] p-2">
                        <div className="font-mono text-xs leading-4 text-stone-300">
                          {run.logs.length === 0 ? (
                            <span className="animate-pulse text-stone-500">Waiting…</span>
                          ) : (
                            run.logs.slice(-6).map((line, i) => (
                              <div key={i} className="whitespace-pre-wrap break-all">
                                {line}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-stone-200/18 px-6 text-center">
                    <TerminalSquare className="mb-3 text-stone-500" size={28} />
                    <p className="text-sm uppercase tracking-[0.13em] text-stone-300">
                      No dispatch yet
                    </p>
                    <p className="mt-2 text-xs leading-5 text-stone-500">
                      Click a row to inspect its detail, or Dispatch to run an agent.
                    </p>
                  </div>
                )}

                {runHistory.length > 0 && (
                  <div className="border-t border-stone-200/12 pt-4">
                    <h3 className="mb-3 text-xs uppercase tracking-[0.16em] text-stone-400">
                      Session Runs
                    </h3>
                    <div className="space-y-2">
                      {runHistory.slice(0, 5).map((run, i) => (
                        <div
                          key={i}
                          className="border border-stone-200/12 bg-white/[0.03] px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate font-mono text-stone-300">
                              {run.featureName}
                            </span>
                            <span
                              className={`shrink-0 uppercase ${run.success ? 'text-emerald-300' : 'text-red-300'}`}
                            >
                              {run.success ? 'ok' : 'err'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </section>

      {dispatchingFeature && (
        <TaskDispatchModal
          feature={dispatchingFeature}
          adapters={adapters}
          projectRoot={project.root}
          onClose={() => setDispatchingFeature(null)}
          onExecuted={() => {}}
          onRunStart={onRunStart}
          onRunLog={onRunLog}
          onRunEnd={onRunEnd}
        />
      )}
    </div>
  );
}
