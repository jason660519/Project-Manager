'use client';

import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  MonitorUp,
  Settings2,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import { BottomSheetTabs, type SheetTabItem } from '../../../components/sheets/BottomSheetTabs';
import { openInEditor, resolveInstallPath } from '../../../lib/bridge';
import type { FeaturePaths, FeatureStatus, IDEId, ProjectEntry } from '../../../lib/types';

const PATH_TYPE_LABELS: Partial<Record<keyof FeaturePaths | 'readmePath' | 'config', string>> = {
  config: 'Project Manager config',
  readmePath: 'Feature README',
  spec: 'Feature spec',
  tdd: 'TDD spec',
  tddProgressReport: 'TDD progress report',
  unitIntegrationTest: 'Unit / integration tests',
  developmentLogSummaryFolder: 'Development log',
  test: 'Test file',
  implementation: 'Implementation file',
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  on_hold: 'Blocked',
};

const STATUS_STYLES: Record<FeatureStatus, string> = {
  done: 'bg-emerald-500/15 text-emerald-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  todo: 'bg-stone-500/15 text-stone-300',
  on_hold: 'bg-red-500/15 text-red-300',
};

const DEFAULT_IDE_TARGETS: Record<IDEId, { label: string; command: string; description: string }> = {
  Cursor: {
    label: 'Cursor',
    command: 'cursor',
    description: 'AI-first desktop IDE using the user-installed Cursor command.',
  },
  VSCode: {
    label: 'Visual Studio Code',
    command: 'code',
    description: 'Microsoft VS Code desktop app through its command-line launcher.',
  },
  Trae: {
    label: 'Trae',
    command: 'trae',
    description: 'Trae desktop IDE through the local command-line launcher.',
  },
  Antigravity: {
    label: 'Antigravity',
    command: 'antigravity',
    description: 'Antigravity desktop IDE through the local command-line launcher.',
  },
  Kiro: {
    label: 'Kiro',
    command: 'kiro',
    description: 'Kiro desktop IDE through the local command-line launcher.',
  },
};

export interface IdeBridgeTarget {
  id: string;
  label: string;
  command: string;
  description: string;
  source: 'adapter' | 'default';
  preferred: boolean;
}

export interface IdeBridgeArtifact {
  key: string;
  absPath: string;
  relativePath: string;
  label: string;
  featureId: string;
  featureName: string;
  featureStatus: FeatureStatus;
  pathType: keyof FeaturePaths | 'readmePath' | 'config';
}

export interface IdeBridgeViewProps {
  projects: ProjectEntry[];
  selectedDashboardProjectIds: string[];
  selectedProjectId?: string;
}

type InstallCheckState =
  | { state: 'idle'; message: string }
  | { state: 'checking'; message: string }
  | { state: 'unsupported'; message: string }
  | { state: 'found'; message: string; commandPath?: string | null; appBundlePath?: string | null }
  | { state: 'missing'; message: string }
  | { state: 'error'; message: string };

const IDE_ICON: ComponentType<{ size?: number; className?: string }> = Code2;

function normalizeWorkbenchPath(path: string): string {
  return path.replace(/\/+$/, '').replace(/^\/+/, '');
}

function normalizeRoot(root: string): string {
  return root.replace(/\/+$/, '');
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function hasFileExtension(path: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(basename(path));
}

function pathForFeatureEntry(
  pathType: keyof FeaturePaths | 'readmePath',
  rawPath: string | undefined,
): string | null {
  if (!rawPath?.trim()) return null;
  const normalized = normalizeWorkbenchPath(rawPath);
  if (pathType === 'featureFolder') return null;
  if (pathType === 'developmentLogSummaryFolder') {
    return hasFileExtension(normalized) ? normalized : `${normalized}/dev-log.md`;
  }
  if (pathType === 'e2eAcceptanceTestScriptFolder') return null;
  if (pathType === 'devLogSummaryHtml' || pathType === 'tddProgressReportHtml') return null;
  return hasFileExtension(normalized) ? normalized : null;
}

function labelForPath(pathType: keyof FeaturePaths | 'readmePath' | 'config', relativePath: string): string {
  return PATH_TYPE_LABELS[pathType] ?? basename(relativePath);
}

function displayedProjectsFor(
  projects: ProjectEntry[],
  selectedDashboardProjectIds: string[],
  selectedProjectId?: string,
): ProjectEntry[] {
  const selected = projects.filter((project) => selectedDashboardProjectIds.includes(project.id));
  if (selected.length > 0) return selected;
  const fallback = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  return fallback ? [fallback] : [];
}

export function buildIdeBridgeArtifacts(project: ProjectEntry): IdeBridgeArtifact[] {
  const root = normalizeRoot(project.config.project.root);
  const artifacts = new Map<string, IdeBridgeArtifact>();

  artifacts.set(project.configPath, {
    key: `config:${project.configPath}`,
    absPath: project.configPath,
    relativePath: '.project-manager/config.json',
    label: labelForPath('config', project.configPath),
    featureId: 'PROJECT',
    featureName: project.config.project.name,
    featureStatus: 'in_progress',
    pathType: 'config',
  });

  for (const feature of project.config.features) {
    const entries: Array<[keyof FeaturePaths | 'readmePath', string | undefined]> = [
      ['readmePath', feature.readmePath],
      ...(Object.entries(feature.paths ?? {}) as Array<[keyof FeaturePaths, string | undefined]>),
    ];

    for (const [pathType, rawPath] of entries) {
      const relativePath = pathForFeatureEntry(pathType, rawPath);
      if (!relativePath) continue;
      const absPath = `${root}/${relativePath}`;
      if (artifacts.has(absPath)) continue;
      artifacts.set(absPath, {
        key: `${feature.id}:${pathType}:${absPath}`,
        absPath,
        relativePath,
        label: labelForPath(pathType, relativePath),
        featureId: feature.id,
        featureName: feature.name,
        featureStatus: feature.status,
        pathType,
      });
    }
  }

  return Array.from(artifacts.values()).sort((a, b) => {
    if (a.featureId !== b.featureId) return a.featureId.localeCompare(b.featureId);
    return a.relativePath.localeCompare(b.relativePath);
  });
}

export function buildIdeBridgeTargets(project?: ProjectEntry): IdeBridgeTarget[] {
  if (!project) return [];
  const targets = new Map<string, IdeBridgeTarget>();
  const preferred = project.config.project.defaultIDE;
  const preferredDefault = DEFAULT_IDE_TARGETS[preferred];

  for (const adapter of project.config.adapters.ides) {
    const command = adapter.command.trim();
    if (!command) continue;
    targets.set(command, {
      id: adapter.id,
      label: adapter.name,
      command,
      description: `Project adapter command: ${command}`,
      source: 'adapter',
      preferred:
        adapter.id.toLowerCase() === preferred.toLowerCase() ||
        adapter.name.toLowerCase().includes(preferred.toLowerCase()) ||
        command === preferredDefault?.command,
    });
  }

  if (preferredDefault && !targets.has(preferredDefault.command)) {
    targets.set(preferredDefault.command, {
      id: preferred.toLowerCase(),
      label: preferredDefault.label,
      command: preferredDefault.command,
      description: preferredDefault.description,
      source: 'default',
      preferred: true,
    });
  }

  for (const [id, target] of Object.entries(DEFAULT_IDE_TARGETS)) {
    if (targets.has(target.command)) continue;
    targets.set(target.command, {
      id: id.toLowerCase(),
      label: target.label,
      command: target.command,
      description: target.description,
      source: 'default',
      preferred: false,
    });
  }

  return Array.from(targets.values()).sort((a, b) => {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
    if (a.source !== b.source) return a.source === 'adapter' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function installStateStyle(state: InstallCheckState['state']): string {
  if (state === 'found') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100';
  if (state === 'missing' || state === 'error') return 'border-red-400/25 bg-red-500/10 text-red-100';
  if (state === 'checking') return 'border-sky-400/25 bg-sky-500/10 text-sky-100';
  return 'border-stone-200/15 bg-black/15 text-stone-300';
}

function artifactIcon(pathType: IdeBridgeArtifact['pathType']) {
  if (pathType === 'config') return <Settings2 size={15} />;
  if (pathType === 'implementation' || pathType === 'test') return <FileCode2 size={15} />;
  return <FileText size={15} />;
}

export function IdeBridgeView({
  projects,
  selectedDashboardProjectIds,
  selectedProjectId,
}: IdeBridgeViewProps) {
  const displayedProjects = useMemo(
    () => displayedProjectsFor(projects, selectedDashboardProjectIds, selectedProjectId),
    [projects, selectedDashboardProjectIds, selectedProjectId],
  );
  const [activeProjectId, setActiveProjectId] = useState(displayedProjects[0]?.id ?? '');
  const [selectedIdeCommand, setSelectedIdeCommand] = useState('');
  const [selectedArtifactKey, setSelectedArtifactKey] = useState('');
  const [installCheck, setInstallCheck] = useState<InstallCheckState>({
    state: 'idle',
    message: 'Select an IDE to check desktop availability.',
  });
  const [bridgeMessage, setBridgeMessage] = useState('');

  useEffect(() => {
    if (displayedProjects.length === 0) {
      setActiveProjectId('');
      setSelectedArtifactKey('');
      return;
    }
    if (!displayedProjects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(displayedProjects[0].id);
      setSelectedArtifactKey('');
      setBridgeMessage('');
    }
  }, [activeProjectId, displayedProjects]);

  const activeProject =
    displayedProjects.find((project) => project.id === activeProjectId) ?? displayedProjects[0];
  const ideTargets = useMemo(() => buildIdeBridgeTargets(activeProject), [activeProject]);
  const selectedIdeTarget =
    ideTargets.find((target) => target.command === selectedIdeCommand) ?? ideTargets[0];
  const artifacts = useMemo(
    () => (activeProject ? buildIdeBridgeArtifacts(activeProject) : []),
    [activeProject],
  );
  const selectedArtifact =
    artifacts.find((artifact) => artifact.key === selectedArtifactKey) ?? artifacts[0];

  useEffect(() => {
    if (!selectedIdeTarget) {
      setSelectedIdeCommand('');
      return;
    }
    if (selectedIdeCommand !== selectedIdeTarget.command) {
      setSelectedIdeCommand(selectedIdeTarget.command);
    }
  }, [selectedIdeCommand, selectedIdeTarget]);

  useEffect(() => {
    if (!selectedArtifact) {
      setSelectedArtifactKey('');
      return;
    }
    if (selectedArtifactKey !== selectedArtifact.key) {
      setSelectedArtifactKey(selectedArtifact.key);
    }
  }, [selectedArtifact, selectedArtifactKey]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedIdeTarget) {
      setInstallCheck({ state: 'idle', message: 'No IDE target available.' });
      return;
    }
    if (!isDesktopRuntime()) {
      setInstallCheck({
        state: 'unsupported',
        message: 'Browser preview cannot inspect installed desktop IDEs. Open the Tauri app to launch.',
      });
      return;
    }

    setInstallCheck({ state: 'checking', message: `Checking ${selectedIdeTarget.command} on this machine...` });
    resolveInstallPath(selectedIdeTarget.command, selectedIdeTarget.label)
      .then((result) => {
        if (cancelled) return;
        if (result.commandPath || result.appBundlePath) {
          setInstallCheck({
            state: 'found',
            message: `${selectedIdeTarget.label} is available for launch.`,
            commandPath: result.commandPath,
            appBundlePath: result.appBundlePath,
          });
          return;
        }
        setInstallCheck({
          state: 'missing',
          message: `${selectedIdeTarget.command} was not found on PATH. Install the IDE launcher or adjust the adapter command.`,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setInstallCheck({
          state: 'error',
          message: error instanceof Error ? error.message : 'Could not check IDE installation.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIdeTarget]);

  const sheetTabs: SheetTabItem<string>[] = displayedProjects.map((project) => ({
    key: project.id,
    label: project.config.project.name,
    icon: <FolderOpen size={14} />,
    badge: project.config.features.length,
  }));

  const openWorkspace = async () => {
    if (!activeProject || !selectedIdeTarget) return;
    try {
      await openInEditor({
        editor: selectedIdeTarget.command,
        path: activeProject.config.project.root,
      });
      setBridgeMessage(`Requested ${selectedIdeTarget.label} to open workspace ${activeProject.config.project.name}.`);
    } catch (error) {
      setBridgeMessage(error instanceof Error ? error.message : 'Failed to open workspace.');
    }
  };

  const openConfig = async () => {
    if (!activeProject || !selectedIdeTarget) return;
    try {
      await openInEditor({
        editor: selectedIdeTarget.command,
        path: activeProject.configPath,
      });
      setBridgeMessage(`Requested ${selectedIdeTarget.label} to open project config.`);
    } catch (error) {
      setBridgeMessage(error instanceof Error ? error.message : 'Failed to open project config.');
    }
  };

  const openArtifact = async (artifact = selectedArtifact) => {
    if (!artifact || !selectedIdeTarget) return;
    try {
      await openInEditor({
        editor: selectedIdeTarget.command,
        path: artifact.absPath,
      });
      setBridgeMessage(`Requested ${selectedIdeTarget.label} to open ${artifact.relativePath}.`);
    } catch (error) {
      setBridgeMessage(error instanceof Error ? error.message : 'Failed to open file in IDE.');
    }
  };

  const totalFeatures = displayedProjects.reduce((sum, project) => sum + project.config.features.length, 0);
  const totalArtifacts = displayedProjects.reduce(
    (sum, project) => sum + buildIdeBridgeArtifacts(project).length,
    0,
  );

  return (
    <WorkstationFrame
      header={
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <MonitorUp size={18} className="text-sky-200/90" />
              <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
                IDE Bridge
              </h1>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Launch user-installed desktop IDEs for selected projects · {displayedProjects.length} project
              {displayedProjects.length !== 1 ? 's' : ''} · {totalFeatures} features · {totalArtifacts} open targets
            </p>
          </div>
          <div className="flex items-center gap-2 border border-stone-200/15 bg-black/15 px-3 py-2 text-xs text-stone-300">
            <ShieldCheck size={14} className="text-emerald-200" />
            No bundled or embedded third-party IDE runtime
          </div>
        </div>
      }
      panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
      scrollChildren={false}
      bottomTabs={
        displayedProjects.length > 0 ? (
          <BottomSheetTabs
            tabs={sheetTabs}
            activeKey={activeProject?.id ?? ''}
            onSelect={(projectId) => {
              setActiveProjectId(projectId);
              setSelectedArtifactKey('');
              setBridgeMessage('');
            }}
          />
        ) : undefined
      }
    >
      {displayedProjects.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 py-10 text-center text-xs text-stone-500">
          No projects loaded.
        </div>
      ) : (
        <div className="grid h-full min-h-0 grid-cols-[76px_minmax(0,1fr)] overflow-hidden">
          <nav className="flex min-h-0 flex-col items-center gap-2 border-r border-stone-200/15 bg-black/20 px-2 py-3" aria-label="IDE targets">
            {ideTargets.map((target) => {
              const Icon = IDE_ICON;
              const active = selectedIdeTarget?.command === target.command;
              return (
                <button
                  key={target.command}
                  type="button"
                  title={`${target.label} (${target.command})`}
                  aria-label={target.label}
                  onClick={() => {
                    setSelectedIdeCommand(target.command);
                    setBridgeMessage('');
                  }}
                  className={clsx(
                    'flex h-14 w-14 flex-col items-center justify-center gap-1 border text-[10px] font-semibold transition-colors',
                    active
                      ? 'border-sky-300/40 bg-sky-500/14 text-sky-50'
                      : 'border-stone-200/10 bg-black/10 text-stone-500 hover:border-stone-200/20 hover:text-stone-200',
                  )}
                >
                  <Icon size={17} />
                  <span className="max-w-full truncate px-1">{target.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>

          <section className="min-h-0 overflow-auto">
            <div className="grid min-h-full grid-cols-[minmax(0,1fr)_360px] gap-0 max-xl:grid-cols-1">
              <main className="min-w-0 px-5 py-5">
                <div className="border border-stone-200/12 bg-black/12 p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="grid h-14 w-14 place-items-center border border-sky-300/30 bg-sky-500/12 text-sky-100">
                      <Code2 size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-stone-50">{selectedIdeTarget?.label ?? 'No IDE target'}</h2>
                        {selectedIdeTarget?.preferred && (
                          <span className="rounded bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                            Preferred for this project
                          </span>
                        )}
                      </div>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-400">
                        {selectedIdeTarget?.description ?? 'Configure an IDE adapter to launch this project.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="border border-stone-200/12 bg-black/20 px-2 py-1 font-mono text-stone-300">
                          {selectedIdeTarget?.command ?? 'no-command'}
                        </span>
                        <span className={clsx('border px-2 py-1', installStateStyle(installCheck.state))}>
                          {installCheck.message}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 max-lg:grid-cols-1">
                    <button
                      type="button"
                      onClick={openWorkspace}
                      disabled={!activeProject || !selectedIdeTarget}
                      className="flex min-h-11 items-center justify-center gap-2 border border-sky-300/30 bg-sky-500/12 px-3 text-sm font-semibold text-sky-100 hover:border-sky-200/50 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-white/[0.02] disabled:text-stone-600"
                    >
                      <FolderOpen size={16} />
                      Open Workspace
                    </button>
                    <button
                      type="button"
                      onClick={openConfig}
                      disabled={!activeProject || !selectedIdeTarget}
                      className="flex min-h-11 items-center justify-center gap-2 border border-stone-200/15 px-3 text-sm font-semibold text-stone-200 hover:border-sky-300/35 hover:text-stone-50 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:text-stone-600"
                    >
                      <Settings2 size={16} />
                      Open Config
                    </button>
                    <button
                      type="button"
                      onClick={() => openArtifact()}
                      disabled={!selectedArtifact || !selectedIdeTarget}
                      className="flex min-h-11 items-center justify-center gap-2 border border-stone-200/15 px-3 text-sm font-semibold text-stone-200 hover:border-sky-300/35 hover:text-stone-50 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:text-stone-600"
                    >
                      <ExternalLink size={16} />
                      Open Selected File
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="min-w-0 border border-stone-200/12 bg-black/10">
                    <div className="flex items-center justify-between gap-3 border-b border-stone-200/10 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-semibold text-stone-100">Open targets</h3>
                        <p className="mt-1 text-xs text-stone-500">Select a project file, then open it in the chosen desktop IDE.</p>
                      </div>
                      <span className="text-xs text-stone-500">{artifacts.length} targets</span>
                    </div>
                    <div className="max-h-[460px] overflow-auto">
                      {artifacts.length === 0 ? (
                        <div className="px-4 py-10 text-sm text-stone-500">No launch targets found for this project.</div>
                      ) : (
                        <div className="divide-y divide-stone-200/10">
                          {artifacts.map((artifact) => {
                            const active = selectedArtifact?.key === artifact.key;
                            return (
                              <button
                                key={artifact.key}
                                type="button"
                                onClick={() => setSelectedArtifactKey(artifact.key)}
                                onDoubleClick={() => openArtifact(artifact)}
                                className={clsx(
                                  'grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left text-sm transition-colors',
                                  active
                                    ? 'bg-sky-500/12 text-stone-50'
                                    : 'text-stone-300 hover:bg-white/[0.04] hover:text-stone-50',
                                )}
                              >
                                <span className={active ? 'text-sky-200' : 'text-stone-500'}>{artifactIcon(artifact.pathType)}</span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{artifact.relativePath}</span>
                                  <span className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-stone-500">
                                    <span className="shrink-0">{artifact.featureId}</span>
                                    <span className="truncate">{artifact.label}</span>
                                  </span>
                                </span>
                                <span className={clsx('rounded px-2 py-1 text-[10px] font-semibold', STATUS_STYLES[artifact.featureStatus])}>
                                  {STATUS_LABELS[artifact.featureStatus]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>

                  <aside className="border border-stone-200/12 bg-black/10 p-4">
                    <h3 className="text-sm font-semibold text-stone-100">Bridge contract</h3>
                    <div className="mt-3 space-y-3 text-xs leading-5 text-stone-500">
                      <div className="flex gap-2">
                        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-200" />
                        <span>Project Manager only invokes local commands configured by the user or project.</span>
                      </div>
                      <div className="flex gap-2">
                        <TerminalSquare size={14} className="mt-0.5 shrink-0 text-sky-200" />
                        <span>The desktop bridge sends paths to the selected IDE CLI; it does not emulate the IDE UI.</span>
                      </div>
                      <div className="flex gap-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-200" />
                        <span>Each IDE license, extension, sign-in, and update remains owned by the installed IDE app.</span>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-stone-200/10 pt-4">
                      <div className="text-[11px] font-semibold uppercase text-stone-500">Selected project</div>
                      <div className="mt-2 truncate text-sm font-semibold text-stone-100">
                        {activeProject?.config.project.name ?? 'No project'}
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] leading-5 text-stone-500">
                        {activeProject?.config.project.root ?? ''}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-stone-200/10 pt-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-stone-500">
                        {installCheck.state === 'found' ? (
                          <CheckCircle2 size={13} className="text-emerald-200" />
                        ) : (
                          <AlertCircle size={13} className="text-stone-500" />
                        )}
                        Install check
                      </div>
                      <div className="mt-2 text-xs leading-5 text-stone-400">{installCheck.message}</div>
                      {'commandPath' in installCheck && installCheck.commandPath && (
                        <div className="mt-2 break-all font-mono text-[11px] text-stone-500">{installCheck.commandPath}</div>
                      )}
                      {'appBundlePath' in installCheck && installCheck.appBundlePath && (
                        <div className="mt-1 break-all font-mono text-[11px] text-stone-500">{installCheck.appBundlePath}</div>
                      )}
                    </div>

                    {bridgeMessage && (
                      <div className="mt-5 border border-stone-200/12 bg-black/20 p-3 text-xs leading-5 text-stone-300">
                        {bridgeMessage}
                      </div>
                    )}
                  </aside>
                </div>
              </main>
            </div>
          </section>
        </div>
      )}
    </WorkstationFrame>
  );
}
