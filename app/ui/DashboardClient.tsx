'use client';

import { useEffect, useState } from 'react';
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

interface DashboardClientProps {
  project: ProjectConfig;
  features: Feature[];
  adapters: AnyAdapterConfig[];
  activeRuns: ActiveRun[];
  runHistory: CompletedRun[];
  dashboardProjectNames?: string[];
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

const FILTER_STORAGE_KEY = 'projectManager.personal.dashboard.statusFilter';

function readStoredFilter(): FeatureStatus | 'all' {
  if (typeof window === 'undefined') return 'all';
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw && FILTER_OPTIONS.some((o) => o.value === raw)) {
      return raw as FeatureStatus | 'all';
    }
  } catch {
    /* localStorage disabled */
  }
  return 'all';
}

export function DashboardClient({
  project,
  features,
  adapters,
  activeRuns,
  runHistory,
  dashboardProjectNames = [],
  onRunStart,
  onRunLog,
  onRunEnd,
}: DashboardClientProps) {
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>(readStoredFilter);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [dispatchFeatureId, setDispatchFeatureId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, statusFilter);
    } catch {
      /* quota or disabled */
    }
  }, [statusFilter]);

  // Sync dispatch param from URL on mount and browser back/forward
  useEffect(() => {
    const sync = () =>
      setDispatchFeatureId(new URLSearchParams(window.location.search).get('dispatch'));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const dispatchingFeature = dispatchFeatureId
    ? (features.find((f) => f.id === dispatchFeatureId) ?? null)
    : null;

  const handleDispatch = (feature: Feature) => {
    const id = feature.id;
    window.history.pushState(null, '', `?dispatch=${encodeURIComponent(id)}`);
    setDispatchFeatureId(id);
  };

  const handleDispatchClose = () => {
    window.history.pushState(null, '', window.location.pathname);
    setDispatchFeatureId(null);
  };

  const filtered =
    statusFilter === 'all' ? features : features.filter((f) => f.status === statusFilter);

  const selectedFeature = selectedFeatureId
    ? features.find((feature) => feature.id === selectedFeatureId) ?? null
    : null;

  const selectedActiveRun = selectedFeature
    ? activeRuns.find((r) => r.featureId === selectedFeature.id)
    : undefined;
  const selectedHistory = selectedFeature
    ? runHistory.filter((r) => r.featureId === selectedFeature.id)
    : [];

  const handleRowClick = (feature: Feature) => {
    setSelectedFeatureId((prev) => (prev === feature.id ? null : feature.id));
  };

  const dispatchProjectRoot =
    (dispatchingFeature?.metadata?.sourceProjectRoot as string | undefined) ?? project.root;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        {dashboardProjectNames.length > 0 && (
          <p className="text-xs text-cyan-200/85">
            Dashboard showing {dashboardProjectNames.length} selected project
            {dashboardProjectNames.length > 1 ? 's' : ''}: {dashboardProjectNames.join(', ')}
          </p>
        )}

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

        <div
          className={`grid gap-5 ${
            selectedFeature ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''
          }`}
        >
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
              onDispatch={handleDispatch}
            />
          </div>

          {/* Right Panel: Feature Detail */}
          {selectedFeature && (
            <FeatureDetailPanel
              feature={selectedFeature}
              runHistory={selectedHistory}
              activeRun={selectedActiveRun}
              onDispatch={() => handleDispatch(selectedFeature)}
              onClose={() => setSelectedFeatureId(null)}
            />
          )}
        </div>
      </section>

      {dispatchingFeature && (
        <TaskDispatchModal
          feature={dispatchingFeature}
          adapters={adapters}
          projectRoot={dispatchProjectRoot}
          onClose={handleDispatchClose}
          onExecuted={() => {}}
          onRunStart={onRunStart}
          onRunLog={onRunLog}
          onRunEnd={onRunEnd}
        />
      )}
    </div>
  );
}
