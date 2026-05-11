'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import sampleConfig1 from '../../config/samples/dev-pilot.sample.json';
import sampleConfig2 from '../../config/samples/dev-pilot-devpilot.sample.json';
import { listAdapters } from '../../lib/adapters/registry';
import {
  ActiveRun,
  CompletedRun,
  DevPilotConfig,
  Feature,
  FeatureStatus,
  ProjectEntry,
  ViewId,
} from '../../lib/types';
import { AppShell } from './AppShell';
import { DashboardClient } from './DashboardClient';
import { FeaturesView } from './views/FeaturesView';
import { ProjectFilesView } from './views/ProjectFilesView';
import { ProjectsView } from './views/ProjectsView';
import { SettingsView } from './views/SettingsView';

const INITIAL_PROJECTS: ProjectEntry[] = [
  {
    id: 'owner-property',
    config: sampleConfig1 as DevPilotConfig,
    configPath:
      '/Volumes/KLEVV-4T-1/Real Estate Management Projects/Owner-Property-Management-AI-SPA/.dev-pilot.json',
  },
  {
    id: 'devpilot',
    config: sampleConfig2 as DevPilotConfig,
    configPath: '/Volumes/KLEVV-4T-1/Dev-Pilot/.dev-pilot.json',
  },
];

interface MainClientProps {
  currentView: ViewId;
  initialProjectId?: string;
}

const PROJECTS_STORAGE_KEY = 'devpilot-projects';
const SELECTED_PROJECT_STORAGE_KEY = 'devpilot-selected-project-id';
const DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY = 'devpilot-dashboard-selected-project-ids';

function loadProjectsFromStorage(): ProjectEntry[] {
  if (typeof window === 'undefined') return INITIAL_PROJECTS;
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return INITIAL_PROJECTS;
    const parsed = JSON.parse(raw) as ProjectEntry[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PROJECTS;
  } catch {
    return INITIAL_PROJECTS;
  }
}

function pickInitialProjectId(projects: ProjectEntry[], preferredId?: string): string {
  if (preferredId && projects.some((p) => p.id === preferredId)) return preferredId;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
    if (stored && projects.some((p) => p.id === stored)) return stored;
  }
  return projects[0]?.id ?? '';
}

function loadDashboardSelectedProjectIds(projects: ProjectEntry[]): string[] {
  if (typeof window === 'undefined') return projects[0] ? [projects[0].id] : [];
  try {
    const raw = window.localStorage.getItem(DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY);
    if (!raw) return projects[0] ? [projects[0].id] : [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return projects[0] ? [projects[0].id] : [];
    const valid = parsed.filter((id) => projects.some((p) => p.id === id));
    return valid.length > 0 ? valid : projects[0] ? [projects[0].id] : [];
  } catch {
    return projects[0] ? [projects[0].id] : [];
  }
}

export function MainClient({ currentView, initialProjectId }: MainClientProps) {
  const [projects, setProjects] = useState<ProjectEntry[]>(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId ?? INITIAL_PROJECTS[0]?.id ?? '',
  );
  const [selectedDashboardProjectIds, setSelectedDashboardProjectIds] = useState<string[]>(
    INITIAL_PROJECTS[0] ? [INITIAL_PROJECTS[0].id] : [],
  );
  const [storageInitialized, setStorageInitialized] = useState(false);
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [runHistory, setRunHistory] = useState<CompletedRun[]>([]);

  useEffect(() => {
    const loaded = loadProjectsFromStorage();
    const safeProjects = loaded.length > 0 ? loaded : INITIAL_PROJECTS;
    setProjects(safeProjects);
    setSelectedProjectId(pickInitialProjectId(safeProjects, initialProjectId));
    setSelectedDashboardProjectIds(loadDashboardSelectedProjectIds(safeProjects));
    setStorageInitialized(true);
  }, [initialProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const adapters = listAdapters(selectedProject.config);
  const selectedDashboardProjects = projects.filter((p) => selectedDashboardProjectIds.includes(p.id));
  const effectiveDashboardProjects =
    selectedDashboardProjects.length > 0 ? selectedDashboardProjects : [selectedProject];
  const dashboardFeatures: Feature[] = effectiveDashboardProjects.flatMap((project) =>
    project.config.features.map((feature) => ({
      ...feature,
      id: `${project.id}::${feature.id}`,
      metadata: {
        ...(feature.metadata ?? {}),
        sourceProjectId: project.id,
        sourceProjectName: project.config.project.name,
        sourceProjectRoot: project.config.project.root,
        sourceFeatureId: feature.id,
      },
    })),
  );

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const bridgeStatus = (isTauri ? 'live' : 'dry-run') as 'live' | 'dry-run';

  // Track which config paths are already being watched so we don't double-register.
  const watchedPaths = useRef<Set<string>>(new Set());

  // Start a Rust poll-watcher for each local project config that hasn't been watched yet.
  useEffect(() => {
    if (!isTauri) return;
    (async () => {
      const { watchConfig } = await import('../../lib/bridge');
      for (const p of projects) {
        if (p.configPath && !watchedPaths.current.has(p.configPath)) {
          watchedPaths.current.add(p.configPath);
          watchConfig(p.configPath).catch(() => {});
        }
      }
    })();
  }, [isTauri, projects]);

  // Listen for config-changed events and hot-reload the matching project.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { onConfigChanged } = await import('../../lib/bridge');
      unlisten = await onConfigChanged(({ path, config }) => {
        setProjects((prev) => prev.map((p) => (p.configPath === path ? { ...p, config } : p)));
      });
    })();
    return () => unlisten?.();
  }, [isTauri]);

  // Persist projects and selected project across route changes/reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!storageInitialized) return;
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }, [projects, storageInitialized]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!storageInitialized) return;
    if (!selectedProjectId) return;
    window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
  }, [selectedProjectId, storageInitialized]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!storageInitialized) return;
    window.localStorage.setItem(
      DASHBOARD_SELECTED_PROJECTS_STORAGE_KEY,
      JSON.stringify(selectedDashboardProjectIds),
    );
  }, [selectedDashboardProjectIds, storageInitialized]);

  // Keep selection valid when projects mutate.
  useEffect(() => {
    if (projects.length === 0) return;
    if (!projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Keep dashboard project multi-selection valid when projects mutate.
  useEffect(() => {
    if (projects.length === 0) {
      setSelectedDashboardProjectIds([]);
      return;
    }

    setSelectedDashboardProjectIds((prev) => {
      const valid = prev.filter((id) => projects.some((p) => p.id === id));
      return valid.length > 0 ? valid : [projects[0].id];
    });
  }, [projects]);

  // Respect route-provided project ID when opening /projects/[projectId].
  useEffect(() => {
    if (!initialProjectId) return;
    if (projects.some((p) => p.id === initialProjectId)) {
      setSelectedProjectId(initialProjectId);
      setSelectedDashboardProjectIds((prev) =>
        prev.includes(initialProjectId) ? prev : [...prev, initialProjectId],
      );
    }
  }, [initialProjectId, projects]);

  // Track which GitHub URLs already have a background poll running.
  const polledGithubUrls = useRef<Set<string>>(new Set());

  // Start a Rust poll loop for any GitHub-sourced project that isn't already polled.
  useEffect(() => {
    if (!isTauri) return;
    const githubProjects = projects.filter((p) => p.configPath.startsWith('https://github.com/'));
    if (githubProjects.length === 0) return;

    (async () => {
      const { startGithubPoll } = await import('../../lib/bridge');
      const token =
        typeof window !== 'undefined' ? (localStorage.getItem('devpilot-github-token') ?? '') : '';
      for (const p of githubProjects) {
        if (!polledGithubUrls.current.has(p.configPath)) {
          polledGithubUrls.current.add(p.configPath);
          startGithubPoll(token, p.configPath, 300).catch(() => {});
        }
      }
    })();
  }, [isTauri, projects]);

  // Subscribe to github-updated events and refresh matching project features.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { onGithubUpdated } = await import('../../lib/bridge');
      unlisten = await onGithubUpdated(({ repoUrl, features: ghFeatures }) => {
        const refreshedFeatures: Feature[] = ghFeatures.map((f) => ({
          id: f.id,
          name: f.name,
          category: f.category,
          status: f.status as FeatureStatus,
          progress: f.progress,
          notes: f.notes,
          paths: { spec: '', tdd: '', implementation: '' },
        }));
        setProjects((prev) =>
          prev.map((p) => {
            if (p.configPath !== repoUrl) return p;
            return { ...p, config: { ...p.config, features: refreshedFeatures } };
          }),
        );
      });
    })();
    return () => unlisten?.();
  }, [isTauri]);

  const handleRunStart = useCallback(
    (pid: number, featureId: string, featureName: string, command: string, args: string[]) => {
      setActiveRuns((prev) => [
        ...prev,
        {
          pid,
          featureId,
          featureName,
          command,
          args,
          startedAt: Date.now(),
          logs: [],
          phase: 'running',
        },
      ]);
    },
    [],
  );

  const handleRunLog = useCallback((pid: number, line: string) => {
    setActiveRuns((prev) => prev.map((r) => (r.pid === pid ? { ...r, logs: [...r.logs, line] } : r)));
  }, []);

  const handleRunEnd = useCallback((pid: number, exitCode: number) => {
    setActiveRuns((prev) => {
      const run = prev.find((r) => r.pid === pid);
      if (run) {
        const completed: CompletedRun = {
          ...run,
          completedAt: Date.now(),
          exitCode,
          success: exitCode === 0,
        };
        setRunHistory((h) => [completed, ...h].slice(0, 50));
      }
      return prev.filter((r) => r.pid !== pid);
    });
  }, []);

  const handleKillRun = useCallback(
    async (pid: number) => {
      const { killProcess } = await import('../../lib/bridge');
      await killProcess(pid);
      handleRunEnd(pid, -1);
    },
    [handleRunEnd],
  );

  const handleAddProject = useCallback((entry: ProjectEntry) => {
    setProjects((prev) => [...prev, entry]);
    setSelectedProjectId(entry.id);
    setSelectedDashboardProjectIds((prev) => (prev.includes(entry.id) ? prev : [...prev, entry.id]));
  }, []);

  const handleToggleDashboardProject = useCallback((id: string, selected: boolean) => {
    setSelectedDashboardProjectIds((prev) => {
      if (selected) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      const next = prev.filter((projectId) => projectId !== id);
      return next.length > 0 ? next : [id];
    });
  }, []);

  const handleImportFeatures = useCallback(
    (newFeatures: Feature[]) => {
      setProjects((prev) => {
        const next = prev.map((p) => {
          if (p.id !== selectedProjectId) return p;
          const updatedConfig = {
            ...p.config,
            features: [...p.config.features, ...newFeatures],
          };
          if (isTauri && p.configPath) {
            import('../../lib/bridge').then(({ writeConfig }) =>
              writeConfig(p.configPath, updatedConfig).catch(() => {}),
            );
          }
          return { ...p, config: updatedConfig };
        });
        return next;
      });
    },
    [isTauri, selectedProjectId],
  );

  return (
    <AppShell
      currentView={currentView}
      projectName={selectedProject.config.project.name}
      projectRoot={selectedProject.config.project.root}
      bridgeStatus={bridgeStatus}
      activeRunCount={activeRuns.length}
    >
      {currentView === 'dashboard' && (
        <DashboardClient
          project={selectedProject.config.project}
          features={dashboardFeatures}
          adapters={adapters}
          activeRuns={activeRuns}
          runHistory={runHistory}
          dashboardProjectNames={effectiveDashboardProjects.map((p) => p.config.project.name)}
          onRunStart={handleRunStart}
          onRunLog={handleRunLog}
          onRunEnd={handleRunEnd}
        />
      )}
      {currentView === 'features' && (
        <FeaturesView
          features={selectedProject.config.features}
          adapters={adapters}
          projectRoot={selectedProject.config.project.root}
          activeRuns={activeRuns}
          runHistory={runHistory}
          onRunStart={handleRunStart}
          onRunLog={handleRunLog}
          onRunEnd={handleRunEnd}
        />
      )}
      {currentView === 'projects' && (
        <ProjectsView
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedDashboardProjectIds={selectedDashboardProjectIds}
          onSelectProject={setSelectedProjectId}
          onToggleDashboardProject={handleToggleDashboardProject}
          onAddProject={handleAddProject}
          runHistory={runHistory}
        />
      )}
      {currentView === 'settings' && <SettingsView />}
      {currentView === 'project-files' && (
        <ProjectFilesView
          projects={projects}
          selectedDashboardProjectIds={selectedDashboardProjectIds}
        />
      )}
    </AppShell>
  );
}
