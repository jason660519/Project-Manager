'use client';

import { useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  FolderGit2,
  GitPullRequestDraft,
  TerminalSquare,
} from 'lucide-react';
import { TableCore } from '../../components/table/TableCore';
import { TaskDispatchModal } from '../../components/table/TaskDispatchModal';
import {
  AnyAdapterConfig,
  ExecutionResult,
  Feature,
  ProjectConfig,
} from '../../lib/types';
import { AppShell } from './AppShell';
import { MetricItem, MetricStrip } from './MetricStrip';

interface DashboardClientProps {
  project: ProjectConfig;
  features: Feature[];
  adapters: AnyAdapterConfig[];
}

export function DashboardClient({ project, features, adapters }: DashboardClientProps) {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [runHistory, setRunHistory] = useState<ExecutionResult[]>([]);

  const completed = features.filter((feature) => feature.status === 'done').length;
  const active = features.filter((feature) => feature.status === 'in_progress').length;
  const avgProgress = Math.round(
    features.reduce((sum, feature) => sum + feature.progress, 0) / Math.max(features.length, 1),
  );
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const bridgeStatus = (isTauri ? 'live' : 'dry-run') as 'live' | 'dry-run';

  const metrics: MetricItem[] = [
    {
      label: 'Total Features',
      value: features.length.toString(),
      caption: `${active} active / ${completed} complete`,
      icon: <FolderGit2 size={18} />,
    },
    {
      label: 'Avg Progress',
      value: `${avgProgress}%`,
      caption: 'across loaded roadmap',
      icon: <Activity size={18} />,
    },
    {
      label: 'Agent Runs',
      value: runHistory.length.toString(),
      caption: 'local session history',
      icon: <Bot size={18} />,
    },
    {
      label: 'Bridge Mode',
      value: isTauri ? 'LIVE' : 'DRY',
      caption: isTauri ? 'Tauri Rust bridge active' : 'browser dev mode',
      icon: <TerminalSquare size={18} />,
    },
  ];

  return (
    <AppShell projectName={project.name} projectRoot={project.root} bridgeStatus={bridgeStatus}>
      <div className="space-y-5">
        <MetricStrip items={metrics} />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 border border-stone-200/18 bg-[#071d1a]/72">
            <div className="flex flex-col justify-between gap-3 border-b border-stone-200/12 px-4 py-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-50">
                  Feature Matrix
                </h2>
                <p className="mt-1 text-xs text-stone-400">
                  Progress-as-code roadmap loaded from the local project config.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-stone-400">
                <GitPullRequestDraft size={15} />
                {features.length} rows
              </div>
            </div>
            <TableCore
              data={features}
              onDispatch={setSelectedFeature}
              onOpenFile={(feature) => {
                setSelectedFeature(feature);
              }}
            />
          </div>

          <aside className="border border-stone-200/18 bg-[#071d1a]/72">
            <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
              <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-50">
                Run Inspector
              </h2>
              <span className="border border-amber-200/25 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-100/80">
                guarded
              </span>
            </div>
            <div className="space-y-4 p-4">
              {lastResult ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-100">
                    <CheckCircle2 size={16} />
                    {lastResult.message}
                  </div>
                  <pre className="max-h-[360px] overflow-auto border border-stone-200/12 bg-[#03100f] p-3 text-xs leading-5 text-stone-200">
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                </>
              ) : (
                <div className="flex min-h-52 flex-col items-center justify-center border border-dashed border-stone-200/18 px-6 text-center">
                  <TerminalSquare className="mb-3 text-stone-500" size={28} />
                  <p className="text-sm uppercase tracking-[0.13em] text-stone-300">No dispatch yet</p>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    Select a feature and confirm dispatch to inspect the bridge execution plan.
                  </p>
                </div>
              )}

              <div className="border-t border-stone-200/12 pt-4">
                <h3 className="mb-3 text-xs uppercase tracking-[0.16em] text-stone-400">Session Runs</h3>
                <div className="space-y-2">
                  {runHistory.length === 0 ? (
                    <p className="text-xs text-stone-500">No local run history in this browser session.</p>
                  ) : (
                    runHistory.map((run, index) => (
                      <div
                        key={`${run.command ?? 'run'}-${index}`}
                        className="border border-stone-200/12 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-mono text-stone-200">{run.command}</span>
                          <span className="shrink-0 uppercase text-amber-100">
                            {run.dryRun ? 'dry-run' : 'exec'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {selectedFeature && (
        <TaskDispatchModal
          feature={selectedFeature}
          adapters={adapters}
          projectRoot={project.root}
          onClose={() => setSelectedFeature(null)}
          onExecuted={(result) => {
            setLastResult(result);
            setRunHistory((current) => [result, ...current].slice(0, 8));
          }}
        />
      )}
    </AppShell>
  );
}
