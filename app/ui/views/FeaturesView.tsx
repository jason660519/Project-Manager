'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { ActiveRun, AnyAdapterConfig, CompletedRun, Feature, FeatureStatus } from '../../../lib/types';
import { TableCore } from '../../../components/table/TableCore';
import { TaskDispatchModal } from '../../../components/table/TaskDispatchModal';
import { FeatureDetailPanel } from '../FeatureDetailPanel';

interface FeaturesViewProps {
  features: Feature[];
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  activeRuns: ActiveRun[];
  runHistory: CompletedRun[];
  onRunStart: (pid: number, featureId: string, featureName: string, command: string, args: string[]) => void;
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

export function FeaturesView({
  features,
  adapters,
  projectRoot,
  activeRuns,
  runHistory,
  onRunStart,
  onRunLog,
  onRunEnd,
}: FeaturesViewProps) {
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [dispatchingFeature, setDispatchingFeature] = useState<Feature | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Features</h1>
        <p className="mt-1 text-xs text-stone-400">
          {features.length} total · {filtered.length} shown
        </p>
      </div>

      {/* Filters + Search */}
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
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-48 border border-stone-200/18 bg-[#071d1a]/50 py-1.5 pl-8 pr-3 text-xs text-stone-200 outline-none placeholder:text-stone-500 focus:ring-1 focus:ring-emerald-300/35"
          />
        </div>
      </div>

      {/* Table + Detail Panel */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 border border-stone-200/18 bg-[#071d1a]/72">
          <TableCore
            data={filtered}
            onRowClick={(f) => setSelectedFeature(f === selectedFeature ? null : f)}
            onDispatch={setDispatchingFeature}
          />
        </div>
        {selectedFeature && (
          <FeatureDetailPanel
            feature={selectedFeature}
            runHistory={runHistory.filter((r) => r.featureId === selectedFeature.id)}
            activeRun={activeRuns.find((r) => r.featureId === selectedFeature.id)}
            onDispatch={() => setDispatchingFeature(selectedFeature)}
            onClose={() => setSelectedFeature(null)}
          />
        )}
      </div>

      {dispatchingFeature && (
        <TaskDispatchModal
          feature={dispatchingFeature}
          adapters={adapters}
          projectRoot={projectRoot}
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
