'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Upload } from 'lucide-react';
import type {
  ActiveRun, AnyAdapterConfig, CompletedRun, CronJob, EngineerRole,
  Feature, FeaturePhase, FeaturePromptConfig, ProjectConfig,
} from '../../lib/types';
import { PHASE_IDS } from './types';
import type { CustomProjectProgressRow } from './types';
import { usePhasePreferences } from './_lib/usePhasePreferences';
import { computePhaseCounts, type PhaseRow } from './_lib/phaseRows';
import { SheetTabs } from './_components/SheetTabs';
import { SharedStatsCards } from './_components/SharedStatsCards';
import { AgentOpsPanel } from './_components/AgentOpsPanel';
import { CronControlPanel } from './_components/CronControlPanel';
import { ExportProgressDialog } from './_components/ExportProgressDialog';
import { PhaseTabContent } from './_components/PhaseTabContent';
import { TaskDispatchModal } from '../../components/table/TaskDispatchModal';

interface ProjectProgressClientProps {
  project: ProjectConfig;
  /** Project root path used when dispatching agents from a row. */
  projectRoot: string;
  features: Feature[];
  adapters: AnyAdapterConfig[];
  /** Project-level engineer roles, used to populate the per-row Engineer dropdown. */
  engineerRoles: EngineerRole[];
  cronJobs: CronJob[];
  activeRuns: ActiveRun[];
  runHistory?: CompletedRun[];
  dashboardProjectNames: string[];
  onCronJobsChange: (jobs: CronJob[]) => void;
  onFeaturePatch: (namespacedFeatureId: string, patch: Partial<Feature>) => void;
  onFeaturePromptSave: (featureId: string, config: FeaturePromptConfig) => void;
  onRunCronJob?: (job: CronJob) => Promise<void>;
  onRunStart?: (
    pid: number,
    featureId: string,
    featureName: string,
    command: string,
    args: string[],
  ) => void;
  onRunLog?: (pid: number, line: string) => void;
  onRunEnd?: (pid: number, exitCode: number) => void;
}

/** Legacy URL hash from before the testing tab was renamed to E2E. */
const LEGACY_PHASE_HASH: Record<string, FeaturePhase> = {
  testing: 'e2e_testing',
};

function resolvePhaseHash(hash: string): FeaturePhase | null {
  const lowered = hash.toLowerCase();
  const resolved = LEGACY_PHASE_HASH[lowered] ?? lowered;
  if ((PHASE_IDS as string[]).includes(resolved)) return resolved as FeaturePhase;
  return null;
}

function readInitialPhase(): FeaturePhase {
  if (typeof window === 'undefined') return 'development';
  const hash = window.location.hash.slice(1);
  const phase = resolvePhaseHash(hash);
  if (phase && typeof window !== 'undefined' && hash.toLowerCase() === 'testing') {
    window.location.replace(`#${phase}`);
  }
  return phase ?? 'development';
}

export function ProjectProgressClient({
  project, projectRoot, features, adapters, engineerRoles, cronJobs, activeRuns,
  dashboardProjectNames, onCronJobsChange, onFeaturePatch, onFeaturePromptSave, onRunCronJob,
  onRunStart, onRunLog, onRunEnd,
}: ProjectProgressClientProps) {
  const [activePhase, setActivePhase] = useState<FeaturePhase>(() => readInitialPhase());
  const [exportOpen, setExportOpen] = useState(false);
  const [dispatchRow, setDispatchRow] = useState<PhaseRow | null>(null);

  // Sync URL hash both ways.
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      const phase = resolvePhaseHash(hash);
      if (phase) {
        setActivePhase(phase);
        if (hash.toLowerCase() === 'testing') window.location.replace(`#${phase}`);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Per-phase preferences (custom rows, widths, etc).
  const dev = usePhasePreferences('development');
  const test = usePhasePreferences('e2e_testing');
  const dep = usePhasePreferences('deployment');
  const ops = usePhasePreferences('operations');

  const prefsByPhase = useMemo(() => ({
    development: dev, e2e_testing: test, deployment: dep, operations: ops,
  }), [dev, test, dep, ops]);

  const customRowsByPhase: Record<FeaturePhase, CustomProjectProgressRow[]> = useMemo(() => ({
    development: dev.prefs.customRows,
    e2e_testing: test.prefs.customRows,
    deployment: dep.prefs.customRows,
    operations: ops.prefs.customRows,
  }), [dev.prefs.customRows, test.prefs.customRows, dep.prefs.customRows, ops.prefs.customRows]);

  const phaseCounts = useMemo(
    () => computePhaseCounts(features, customRowsByPhase),
    [features, customRowsByPhase],
  );

  const phaseFeatures = useMemo(() => {
    return features.filter((f) => (f.phase ?? 'development') === activePhase);
  }, [features, activePhase]);

  const activePhasePrefs = prefsByPhase[activePhase];

  // Header summary uses features (for development, weighted by SP) of the current phase.
  const headerFeatures = activePhase === 'development' ? features : phaseFeatures;

  const onChangePhase = useCallback((p: FeaturePhase) => {
    setActivePhase(p);
    if (typeof window !== 'undefined') window.location.hash = p;
  }, []);

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-50">
            <Activity className="h-5 w-5 text-emerald-300" />
            Project Progress Dashboard
          </h1>
          {dashboardProjectNames.length > 0 && (
            <p className="mt-1 text-xs text-cyan-200/85">
              Showing {dashboardProjectNames.length} selected project{dashboardProjectNames.length > 1 ? 's' : ''}:{' '}
              {dashboardProjectNames.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded bg-emerald-500/30 px-3 text-xs font-medium text-emerald-100 hover:bg-emerald-500/40"
            title="Export progress JSON"
          >
            <Upload size={14} /> Export
          </button>
          <SharedStatsCards phase={activePhase} features={headerFeatures} compact />
        </div>
      </div>

      {/* Paperclip-style ops panels on development phase */}
      {activePhase === 'development' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AgentOpsPanel adapters={adapters} activeRuns={activeRuns} />
          <CronControlPanel
            cronJobs={cronJobs}
            onCronJobsChange={onCronJobsChange}
            onRunJob={onRunCronJob}
          />
        </div>
      )}

      {/* Active phase table area */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <PhaseTabContent
            phase={activePhase}
            projectName={project.name}
            projectNames={dashboardProjectNames}
            projectRoot={projectRoot}
            features={phaseFeatures}
            prefs={activePhasePrefs.prefs}
            patch={activePhasePrefs.patch}
            reset={activePhasePrefs.reset}
            onFeaturePromptSave={onFeaturePromptSave}
            onFeaturePatch={onFeaturePatch}
            onDispatchRow={(row) => row.source === 'feature' && setDispatchRow(row)}
          />
        </div>
        <SheetTabs activePhase={activePhase} onPhaseChange={onChangePhase} phaseCounts={phaseCounts} />
      </div>

      <ExportProgressDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        project={project}
        features={features}
        customRowsByPhase={customRowsByPhase}
      />

      {dispatchRow?.feature && (
        <TaskDispatchModal
          feature={dispatchRow.feature}
          adapters={adapters}
          projectRoot={(dispatchRow.feature.metadata?.sourceProjectRoot as string | undefined) ?? projectRoot}
          engineerRoles={engineerRoles}
          defaultIDE={project.defaultIDE}
          onClose={() => setDispatchRow(null)}
          onExecuted={() => {}}
          onFeatureUpdate={(featureId, update) => onFeaturePatch(featureId, update)}
          onRunStart={onRunStart}
          onRunLog={onRunLog}
          onRunEnd={onRunEnd}
        />
      )}
    </div>
  );
}
