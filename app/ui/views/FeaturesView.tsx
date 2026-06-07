'use client';

import { useEffect, useState } from 'react';
import { Bot, Search } from 'lucide-react';
import { useI18n } from '../../../lib/i18n';
import { ActiveRun, AnyAdapterConfig, CompletedRun, EngineerRole, Feature, FeatureStatus } from '../../../lib/types';
import { TableCore } from '../../../components/table/TableCore';
import { TaskDispatchModal } from '../../../components/table/TaskDispatchModal';
import { BatchDispatchModal } from '../../../components/table/BatchDispatchModal';
import { FeatureDetailPanel } from '../FeatureDetailPanel';

interface FeaturesViewProps {
  features: Feature[];
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  activeRuns: ActiveRun[];
  runHistory: CompletedRun[];
  engineerRoles?: EngineerRole[];
  onRunStart: (pid: number, featureId: string, featureName: string, command: string, args: string[]) => void;
  onRunLog: (pid: number, line: string) => void;
  onRunEnd: (pid: number, exitCode: number) => void;
  onFeatureUpdate?: (featureId: string, update: Partial<Feature>) => void;
}

const FILTER_OPTIONS: Array<{ label: string; value: FeatureStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Blocked', value: 'on_hold' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'To Do', value: 'todo' },
  { label: 'Done', value: 'done' },
];

export function FeaturesView({
  features,
  adapters,
  projectRoot,
  activeRuns,
  runHistory,
  engineerRoles = [],
  onRunStart,
  onRunLog,
  onRunEnd,
  onFeatureUpdate,
}: FeaturesViewProps) {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [dispatchFeatureId, setDispatchFeatureId] = useState<string | null>(null);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);

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
    window.history.pushState(null, '', `?dispatch=${encodeURIComponent(feature.id)}`);
    setDispatchFeatureId(feature.id);
  };

  const handleDispatchClose = () => {
    window.history.pushState(null, '', window.location.pathname);
    setDispatchFeatureId(null);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const filtered = features.filter((f) => {
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === '' ||
      f.name.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const selectedFeatures = features.filter((f) => selectedIds.has(f.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Features</h1>
        <p className="mt-1 text-xs text-stone-400">
          {features.length} total · {filtered.length} shown
          {selectedIds.size > 0 && (
            <span className="ml-2 text-emerald-400">{selectedIds.size} selected</span>
          )}
        </p>
      </div>

      {/* Filters + Search + Batch button */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border border-stone-200/18">
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
                    ? 'bg-stone-100 font-medium text-[rgb(var(--pm-panel))]'
                    : 'text-stone-400 hover:bg-white/5 hover:text-stone-100'
                }`}
              >
                {opt.label}
                <span className="ml-1.5 font-mono opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Batch dispatch area */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchOpen(true)}
              className="inline-flex items-center gap-1.5 border border-emerald-200/40 bg-emerald-100/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-100/25"
            >
              <Bot size={13} />
              {t.features.batchDispatch} ({selectedIds.size})
            </button>
            <button
              onClick={handleClearSelection}
              className="text-xs text-stone-500 hover:text-stone-300"
            >
              {t.common.deselectSelection}
            </button>
          </div>
        )}

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-48 border border-stone-200/18 bg-[rgb(var(--pm-panel))]/50 py-1.5 pl-8 pr-3 text-xs text-stone-200 outline-none placeholder:text-stone-500 focus:ring-1 focus:ring-emerald-300/35"
          />
        </div>
      </div>

      {/* Table + Detail Panel */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
          <TableCore
            data={filtered}
            onRowClick={(f) => setSelectedFeature(f === selectedFeature ? null : f)}
            onDispatch={handleDispatch}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
        {selectedFeature && (
          <FeatureDetailPanel
            feature={selectedFeature}
            runHistory={runHistory.filter((r) => r.featureId === selectedFeature.id)}
            activeRun={activeRuns.find((r) => r.featureId === selectedFeature.id)}
            onDispatch={() => handleDispatch(selectedFeature)}
            onClose={() => setSelectedFeature(null)}
          />
        )}
      </div>

      {/* Single feature dispatch modal */}
      {dispatchingFeature && (
        <TaskDispatchModal
          feature={dispatchingFeature}
          adapters={adapters}
          projectRoot={projectRoot}
          engineerRoles={engineerRoles}
          onClose={handleDispatchClose}
          onExecuted={() => {}}
          onRunStart={onRunStart}
          onRunLog={onRunLog}
          onRunEnd={onRunEnd}
          onFeatureUpdate={onFeatureUpdate}
        />
      )}

      {/* Batch dispatch modal */}
      {batchOpen && selectedFeatures.length > 0 && (
        <BatchDispatchModal
          features={selectedFeatures}
          adapters={adapters}
          projectRoot={projectRoot}
          engineerRoles={engineerRoles}
          onClose={() => setBatchOpen(false)}
          onRunStart={onRunStart}
          onRunLog={onRunLog}
          onRunEnd={onRunEnd}
          onFeatureUpdate={onFeatureUpdate}
        />
      )}
    </div>
  );
}
