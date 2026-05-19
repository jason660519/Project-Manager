'use client';

import { useEffect, useMemo, useState } from 'react';
import { TableCore } from '../../components/table/TableCore';
import { TaskDispatchModal } from '../../components/table/TaskDispatchModal';
import {
  ActiveRun,
  AnyAdapterConfig,
  CompletedRun,
  Feature,
  FeaturePhase,
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

const PHASE_TABS: Array<{ label: string; value: FeaturePhase }> = [
  { label: 'Development', value: 'development' },
  { label: 'E2E Testing', value: 'e2e_testing' },
  { label: 'Deployment', value: 'deployment' },
  { label: 'Operations', value: 'operations' },
];

const DEFAULT_PHASE: FeaturePhase = 'development';
const PHASE_QUERY_PARAM = 'phase';
const DISPATCH_QUERY_PARAM = 'dispatch';
const PHASE_STORAGE_PREFIX = 'projectManager.personal.dashboard.phaseFilter';

function isFeaturePhase(value: string | null): value is FeaturePhase {
  return PHASE_TABS.some((tab) => tab.value === value);
}

function normalizePhase(phase?: Feature['phase']): FeaturePhase {
  const candidate = phase ?? null;
  return isFeaturePhase(candidate) ? candidate : DEFAULT_PHASE;
}

function phaseStorageKey(projectRoot: string) {
  return `${PHASE_STORAGE_PREFIX}:${encodeURIComponent(projectRoot || 'default')}`;
}

function readStoredPhase(projectRoot: string): FeaturePhase | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(phaseStorageKey(projectRoot));
    return isFeaturePhase(raw) ? raw : null;
  } catch {
    /* localStorage disabled */
  }
  return null;
}

function readUrlPhase(): FeaturePhase | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get(PHASE_QUERY_PARAM);
  return isFeaturePhase(raw) ? raw : null;
}

function resolveInitialPhase(projectRoot: string): FeaturePhase {
  return readUrlPhase() ?? readStoredPhase(projectRoot) ?? DEFAULT_PHASE;
}

function replaceSearchParam(name: string, value: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value === null) {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
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
  const [activePhase, setActivePhase] = useState<FeaturePhase>(() =>
    resolveInitialPhase(project.root),
  );
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [dispatchFeatureId, setDispatchFeatureId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(phaseStorageKey(project.root), activePhase);
    } catch {
      /* quota or disabled */
    }
  }, [activePhase, project.root]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(PHASE_QUERY_PARAM) !== activePhase) {
      replaceSearchParam(PHASE_QUERY_PARAM, activePhase);
    }
  }, [activePhase]);

  useEffect(() => {
    setIsTabTransitioning(true);
    const timer = window.setTimeout(() => setIsTabTransitioning(false), 20);
    return () => window.clearTimeout(timer);
  }, [activePhase]);

  // Sync dispatch param from URL on mount and browser back/forward
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const phase = params.get(PHASE_QUERY_PARAM);
      setDispatchFeatureId(params.get(DISPATCH_QUERY_PARAM));
      setActivePhase(isFeaturePhase(phase) ? phase : DEFAULT_PHASE);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const dispatchingFeature = dispatchFeatureId
    ? (features.find((f) => f.id === dispatchFeatureId) ?? null)
    : null;

  const handleDispatch = (feature: Feature) => {
    const id = feature.id;
    replaceSearchParam(DISPATCH_QUERY_PARAM, id);
    setDispatchFeatureId(id);
  };

  const handleDispatchClose = () => {
    replaceSearchParam(DISPATCH_QUERY_PARAM, null);
    setDispatchFeatureId(null);
  };

  const phaseCounts = useMemo(
    () =>
      PHASE_TABS.reduce(
        (counts, tab) => ({
          ...counts,
          [tab.value]: features.filter((feature) => normalizePhase(feature.phase) === tab.value)
            .length,
        }),
        {} as Record<FeaturePhase, number>,
      ),
    [features],
  );

  const filtered = features.filter((feature) => normalizePhase(feature.phase) === activePhase);

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
        <div
          role="tablist"
          aria-label="Feature phase"
          className="flex w-fit border border-stone-200/18"
        >
          {PHASE_TABS.map((opt) => {
            const count = phaseCounts[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={activePhase === opt.value}
                onClick={() => setActivePhase(opt.value)}
                className={`inline-flex items-center gap-2 border-r border-stone-200/18 px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors last:border-r-0 ${
                  activePhase === opt.value
                    ? 'bg-stone-100 font-medium text-[rgb(var(--pm-panel))]'
                    : 'text-stone-400 hover:bg-white/5 hover:text-stone-100'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  aria-label={`${count} ${opt.label} features`}
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                    activePhase === opt.value
                      ? 'bg-[rgb(var(--pm-panel))]/15 text-[rgb(var(--pm-panel))]'
                      : 'bg-stone-200/12 text-stone-200'
                  }`}
                >
                  {count}
                </span>
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
          <div className="min-w-0 border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
            <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-50">
                  Feature Matrix
                </h2>
                <p className="mt-1 text-xs text-stone-400">
                  {filtered.length} feature{filtered.length !== 1 ? 's' : ''}
                  {' · '}
                  {PHASE_TABS.find((tab) => tab.value === activePhase)?.label ?? 'Development'}
                  {' · '}click row to inspect
                </p>
              </div>
            </div>
            <div
              data-testid="feature-phase-transition"
              className={`transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
                isTabTransitioning ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
              }`}
            >
              <TableCore
                data={filtered}
                onRowClick={handleRowClick}
                onDispatch={handleDispatch}
              />
            </div>
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
