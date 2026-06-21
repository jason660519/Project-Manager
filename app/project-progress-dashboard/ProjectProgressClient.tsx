'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Upload } from 'lucide-react';
import type {
  ActiveRun, AnyAdapterConfig, CompletedRun, CronJob, EngineerRole,
  Feature, FeaturePhase, FeaturePromptConfig, ProgressSheetConfig, ProjectConfig, ProjectEntry,
  ProjectProgressSheetRef,
} from '../../lib/types';
import { PHASE_IDS, SHEET_IDS, type TabId } from './types';
import type { CustomProjectProgressRow } from './types';
import { buildFeatureDependencyGraph, dispatchReadinessForFeature } from './_lib/dependencies';
import { usePhasePreferences, useProgressSheetPreferences } from './_lib/usePhasePreferences';
import { computePhaseCounts, type PhaseRow } from './_lib/phaseRows';
import { columnsForProgressSheet, progressSheetRowsToPhaseRows } from './_lib/progressSheetColumns';
import { developmentColumnsFromTemplatePrefs } from './_lib/developmentTemplateColumns';
import { useTemplateFieldPreferences } from '../ui/views/ProgressTemplates/useTemplateFieldPreferences';
import {
  applyTemplateFieldColumns,
  DEVELOPMENT_TEMPLATE_ID,
  hasStoredTemplateFieldColumns,
  isBuiltInProgressSheet,
  isFeatureBackedProgressSheet,
  resolveProgressSheetTemplateId,
} from '../../lib/progress-sheets/templateFieldPreferences';
import { SheetTabs } from './_components/SheetTabs';
import { SharedStatsCards } from './_components/SharedStatsCards';
import { ExportProgressDialog } from './_components/ExportProgressDialog';
import { PhaseTabContent } from './_components/PhaseTabContent';
import { IssuesTab } from './_components/IssuesTab';
import { TaskDispatchModal } from '../../components/table/TaskDispatchModal';
import { WorkstationFrame } from '../../components/layout/WorkstationFrame';
import { ProjectsView } from '../ui/views/ProjectsView';

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
  projects: ProjectEntry[];
  selectedProjectId: string;
  selectedDashboardProjectIds: string[];
  dashboardProjectNames: string[];
  dashboardProjects: Array<{
    id: string;
    name: string;
    repoUrl?: string;
  }>;
  dashboardProjectConfigs?: Array<{
    id: string;
    root: string;
    configPath?: string;
    progressSheets?: ProjectProgressSheetRef[];
  }>;
  onSelectProject: (id: string) => void;
  onToggleDashboardProject: (id: string, selected: boolean) => void;
  onAddProject: (entry: ProjectEntry) => void;
  onUpdateProject: (entry: ProjectEntry) => void;
  onRemoveProject: (id: string, deleteConfigFile: boolean) => Promise<void> | void;
  onInitializeProject?: (
    id: string,
    mode: 'create' | 'merge' | 'overwrite',
    progressSheetTemplateIds: string[],
  ) => Promise<void> | void;
  onSyncFromDesktop?: () => Promise<void>;
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

const PHASE_IDS_ARRAY: FeaturePhase[] = [...PHASE_IDS];
const TAB_IDS_ARRAY: TabId[] = [...SHEET_IDS];

/** Legacy URL hash from before the testing tab was renamed to E2E. */
const LEGACY_PHASE_HASH: Record<string, FeaturePhase> = {
  testing: 'e2e_testing',
};

interface ActiveProgressSheetDescriptor {
  projectId: string;
  projectRoot: string;
  configPath?: string;
  ref: ProjectProgressSheetRef;
}

function resolveHashToTab(hash: string): TabId | null {
  const lowered = hash.toLowerCase();
  const resolved = LEGACY_PHASE_HASH[lowered] ?? lowered;
  if ((TAB_IDS_ARRAY as string[]).includes(resolved)) {
    return resolved as TabId;
  }
  return null;
}

function isFeaturePhaseTab(tab: TabId): tab is FeaturePhase {
  return (PHASE_IDS_ARRAY as string[]).includes(tab);
}

function readHashTab(): TabId | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  const tab = resolveHashToTab(hash);
  if (tab && hash.toLowerCase() === 'testing') {
    window.location.replace(`#${tab}`);
  }
  return tab;
}

function resolveProgressSheetConfigPath(
  projectRoot: string,
  sheetConfigPath: string,
  sheetId: string,
): string {
  if (sheetConfigPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(sheetConfigPath)) {
    throw new Error('Progress sheet configPath must be project-relative');
  }
  if (!projectRoot.trim()) {
    throw new Error('Project root is required to resolve progress sheet configPath');
  }
  if (sheetConfigPath.includes('\\')) {
    throw new Error('Progress sheet configPath must use forward slashes');
  }
  const normalized = sheetConfigPath.replace(/^\.\//, '');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..' || segment === '')) {
    throw new Error('Progress sheet configPath must not contain empty or parent segments');
  }
  const expected = `.project-manager/progress-sheets/${sheetId}/config.json`;
  if (normalized !== expected) {
    throw new Error(`Progress sheet configPath must be ${expected}`);
  }
  const root = projectRoot.replace(/\/+$/, '');
  return `${root}/${normalized}`;
}

function pickActiveProgressSheet(
  configs: ProjectProgressClientProps['dashboardProjectConfigs'],
): ActiveProgressSheetDescriptor | null {
  for (const config of configs ?? []) {
    const refs = config.progressSheets ?? [];
    const ref =
      refs.find((candidate) => candidate.active) ??
      refs.find((candidate) => candidate.id === 'software-desktop-app') ??
      refs[0];
    if (ref) {
      return {
        projectId: config.id,
        projectRoot: config.root,
        configPath: config.configPath,
        ref,
      };
    }
  }
  return null;
}

export function ProjectProgressClient({
  project, projectRoot, features, adapters, engineerRoles, activeRuns,
  runHistory = [], projects, selectedProjectId, selectedDashboardProjectIds,
  dashboardProjectNames, dashboardProjects, dashboardProjectConfigs, onSelectProject, onToggleDashboardProject,
  onAddProject, onUpdateProject, onRemoveProject, onInitializeProject, onSyncFromDesktop,
  onFeaturePatch, onFeaturePromptSave,
  onRunStart, onRunLog, onRunEnd,
}: ProjectProgressClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('projects');
  const [exportOpen, setExportOpen] = useState(false);
  const [dispatchRow, setDispatchRow] = useState<PhaseRow | null>(null);
  const [dispatchIssue, setDispatchIssue] = useState<{ title: string } | null>(null);
  const activeProgressSheetDescriptor = useMemo(
    () => pickActiveProgressSheet(dashboardProjectConfigs),
    [dashboardProjectConfigs],
  );
  const activeProgressSheetRef = activeProgressSheetDescriptor?.ref;
  const [progressSheetConfig, setProgressSheetConfig] = useState<ProgressSheetConfig | null>(null);
  const [progressSheetError, setProgressSheetError] = useState<string | null>(null);
  const dependencyGraph = useMemo(() => buildFeatureDependencyGraph(features), [features]);

  const isPhaseTab = isFeaturePhaseTab(activeTab);
  const activePhase = isPhaseTab ? activeTab : 'development';

  // Sync URL hash after mount so the server and first client render match.
  useEffect(() => {
    const syncHashTab = () => {
      const tab = readHashTab();
      if (tab) {
        setActiveTab(tab);
      }
    };
    syncHashTab();
    window.addEventListener('hashchange', syncHashTab);
    return () => window.removeEventListener('hashchange', syncHashTab);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProgressSheetConfig(null);
    setProgressSheetError(null);
    if (!activeProgressSheetDescriptor) return () => {
      cancelled = true;
    };

    void (async () => {
      try {
        const { readJsonFile } = await import('../../lib/bridge');
        const path = resolveProgressSheetConfigPath(
          activeProgressSheetDescriptor.projectRoot,
          activeProgressSheetDescriptor.ref.configPath,
          activeProgressSheetDescriptor.ref.id,
        );
        const config = await readJsonFile<ProgressSheetConfig>(path);
        if (!cancelled) {
          setProgressSheetConfig(config);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) {
          setProgressSheetError(`Could not load progress sheet config: ${message}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeProgressSheetDescriptor?.projectRoot,
    activeProgressSheetDescriptor?.ref.configPath,
    activeProgressSheetDescriptor?.ref.id,
  ]);

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
  const templateIdForPrefs = useMemo(() => {
    if (progressSheetConfig && isBuiltInProgressSheet(progressSheetConfig)) {
      return resolveProgressSheetTemplateId(progressSheetConfig) ?? DEVELOPMENT_TEMPLATE_ID;
    }
    return DEVELOPMENT_TEMPLATE_ID;
  }, [progressSheetConfig]);
  const { columns: templateFieldColumns } = useTemplateFieldPreferences(templateIdForPrefs);
  const effectiveProgressSheetConfig = useMemo(() => {
    if (!progressSheetConfig || !isBuiltInProgressSheet(progressSheetConfig)) {
      return progressSheetConfig;
    }
    const templateId = resolveProgressSheetTemplateId(progressSheetConfig);
    if (!templateId || !hasStoredTemplateFieldColumns(templateId)) {
      return progressSheetConfig;
    }
    return applyTemplateFieldColumns(progressSheetConfig, templateFieldColumns);
  }, [progressSheetConfig, templateFieldColumns]);
  const progressSheetColumns = useMemo(
    () => (effectiveProgressSheetConfig ? columnsForProgressSheet(effectiveProgressSheetConfig) : []),
    [effectiveProgressSheetConfig],
  );
  const progressSheetPrefs = useProgressSheetPreferences(
    effectiveProgressSheetConfig?.id ?? activeProgressSheetRef?.id,
    progressSheetColumns.length || 1,
  );
  const progressSheetRows = useMemo(
    () => (
      effectiveProgressSheetConfig
        ? progressSheetRowsToPhaseRows(effectiveProgressSheetConfig, dashboardProjectNames[0] ?? project.name)
        : []
    ),
    [dashboardProjectNames, effectiveProgressSheetConfig, project.name],
  );

  const activeSheetTemplateId = useMemo(() => {
    if (progressSheetConfig) {
      return resolveProgressSheetTemplateId(progressSheetConfig);
    }
    return activeProgressSheetRef?.templateId ?? null;
  }, [activeProgressSheetRef?.templateId, progressSheetConfig]);

  const featureBackedDevelopmentSheet = isFeatureBackedProgressSheet(activeSheetTemplateId);

  const showDynamicProgressSheet = Boolean(
    isPhaseTab
    && activePhase === 'development'
    && effectiveProgressSheetConfig
    && !featureBackedDevelopmentSheet,
  );

  const showProgressSheetLoading = Boolean(
    isPhaseTab
    && activePhase === 'development'
    && activeProgressSheetRef
    && !progressSheetError
    && !effectiveProgressSheetConfig
    && !featureBackedDevelopmentSheet,
  );

  const showProgressSheetError = Boolean(
    isPhaseTab
    && activePhase === 'development'
    && progressSheetError
    && activeProgressSheetRef
    && !featureBackedDevelopmentSheet,
  );

  const developmentColumnsOverride = useMemo(() => {
    if (activePhase !== 'development' || !featureBackedDevelopmentSheet) return undefined;
    return developmentColumnsFromTemplatePrefs(templateFieldColumns);
  }, [activePhase, featureBackedDevelopmentSheet, templateFieldColumns]);

  // Header summary uses features (for development, weighted by SP) of the current phase.
  const headerFeatures = activePhase === 'development' ? features : phaseFeatures;

  const onChangeTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') window.location.hash = tab;
  }, []);

  return (
    <>
      <WorkstationFrame
        className="w-full"
        header={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-50">
                <Activity className="h-5 w-5 text-emerald-300" />
                Projects Dashboard
              </h1>
              {activeProgressSheetRef && (
                <p className="mt-1 text-sm font-medium text-stone-100">
                  {progressSheetConfig?.sheetTitle ?? activeProgressSheetRef.label}
                </p>
              )}
              {progressSheetError && !featureBackedDevelopmentSheet && (
                <p className="mt-1 text-xs text-amber-100/85">
                  {progressSheetError}
                </p>
              )}
              {selectedDashboardProjectIds.length > 0 && dashboardProjectNames.length > 0 && (
                <p className="mt-1 text-xs text-cyan-200/85">
                  Showing {dashboardProjectNames.length} selected project{dashboardProjectNames.length > 1 ? 's' : ''}:{' '}
                  {dashboardProjectNames.join(', ')}
                </p>
              )}
              {selectedDashboardProjectIds.length === 0 && dashboardProjectNames.length > 0 && (
                <p className="mt-1 text-xs text-amber-100/85">
                  No dashboard projects selected; showing current project: {dashboardProjectNames.join(', ')}
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
              {isPhaseTab && <SharedStatsCards phase={activePhase} features={headerFeatures} compact />}
            </div>
          </div>
        }
        panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
        scrollChildren={false}
        bottomTabs={
          <SheetTabs
            activeTab={activeTab}
            onTabChange={onChangeTab}
            phaseCounts={phaseCounts}
            projectCount={projects.length}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
          <div className="min-h-0 flex-1">
            {activeTab === 'projects' ? (
              <ProjectsView
                projects={projects}
                selectedProjectId={selectedProjectId}
                selectedDashboardProjectIds={selectedDashboardProjectIds}
                onSelectProject={onSelectProject}
                onToggleDashboardProject={onToggleDashboardProject}
                onAddProject={onAddProject}
                onUpdateProject={onUpdateProject}
                onRemoveProject={onRemoveProject}
                onInitializeProject={onInitializeProject}
                onSyncFromDesktop={onSyncFromDesktop}
                runHistory={runHistory}
              />
            ) : isPhaseTab ? (
              showDynamicProgressSheet ? (
                <PhaseTabContent
                  phase={activePhase}
                  projectName={project.name}
                  projectNames={dashboardProjectNames}
                  projectRoot={projectRoot}
                  features={[]}
                  dependencyFeatures={[]}
                  engineerRoles={engineerRoles}
                  prefs={progressSheetPrefs.prefs}
                  patch={progressSheetPrefs.patch}
                  reset={progressSheetPrefs.reset}
                  onFeaturePromptSave={onFeaturePromptSave}
                  onFeaturePatch={onFeaturePatch}
                  activeRuns={activeRuns}
                  onDispatchRow={undefined}
                  overrideColumns={progressSheetColumns}
                  overrideRows={progressSheetRows}
                  readOnly
                />
              ) : showProgressSheetLoading ? (
                <div className="border border-stone-200/15 bg-[rgb(var(--pm-card))]/45 px-4 py-3 text-sm text-stone-200">
                  <p className="font-medium">{activeProgressSheetRef!.label}</p>
                  <p className="mt-1 text-xs text-stone-400">Loading progress sheet config...</p>
                </div>
              ) : showProgressSheetError ? (
                <div className="border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <p className="font-medium">{activeProgressSheetRef!.label}</p>
                  <p className="mt-1 text-xs text-amber-100/80">{progressSheetError}</p>
                </div>
              ) : (
                <PhaseTabContent
                  phase={activePhase}
                  projectName={project.name}
                  projectNames={dashboardProjectNames}
                  projectRoot={projectRoot}
                  features={activePhase === 'development' ? features : phaseFeatures}
                  dependencyFeatures={features}
                  engineerRoles={engineerRoles}
                  prefs={activePhasePrefs.prefs}
                  patch={activePhasePrefs.patch}
                  reset={activePhasePrefs.reset}
                  onFeaturePromptSave={onFeaturePromptSave}
                  onFeaturePatch={onFeaturePatch}
                  activeRuns={activeRuns}
                  onDispatchRow={(row) => row.source === 'feature' && setDispatchRow(row)}
                  overrideColumns={developmentColumnsOverride}
                />
              )
            ) : activeTab === 'issues' ? (
              <IssuesTab
                projectName={project.name}
                selectedProjectNames={dashboardProjectNames}
                selectedProjects={dashboardProjects}
                repoUrl={project.githubUrl}
                projectRoot={projectRoot}
                storyPoints={features.reduce((s, f) => s + (f.points ?? 1), 0)}
                adapters={adapters}
                engineerRoles={engineerRoles}
                defaultIDE={project.defaultIDE}
                onDispatchIssue={(issue) => setDispatchIssue(issue)}
              />
            ) : null}
          </div>
        </div>
      </WorkstationFrame>

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
          dispatchReadiness={dispatchReadinessForFeature(dispatchRow.feature, dependencyGraph, activeRuns)}
          onRunStart={onRunStart}
          onRunLog={onRunLog}
          onRunEnd={onRunEnd}
        />
      )}

      {dispatchIssue && adapters.length > 0 && (
        <TaskDispatchModal
          feature={{
            id: 'github-issue',
            name: dispatchIssue.title,
            category: 'GitHub Issues',
            status: 'todo',
            progress: 0,
            paths: {},
          }}
          adapters={adapters}
          projectRoot={projectRoot}
          engineerRoles={engineerRoles}
          defaultIDE={project.defaultIDE}
          onClose={() => setDispatchIssue(null)}
          onExecuted={() => {}}
          onFeatureUpdate={() => {}}
          onRunStart={onRunStart}
          onRunLog={onRunLog}
          onRunEnd={onRunEnd}
        />
      )}
    </>
  );
}
