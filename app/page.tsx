'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import sampleConfig1 from '../config/samples/dev-pilot.sample.json';
import sampleConfig2 from '../config/samples/dev-pilot-devpilot.sample.json';
import { listAdapters } from '../lib/adapters/registry';
import {
  ActiveRun,
  CompletedRun,
  DevPilotConfig,
  Feature,
  FeatureStatus,
  ProjectEntry,
  ViewId,
} from '../lib/types';
import { AppShell } from './ui/AppShell';
import { DashboardClient } from './ui/DashboardClient';
import { FeaturesView } from './ui/views/FeaturesView';
import { IngestionView } from './ui/views/IngestionView';
import { ProjectsView } from './ui/views/ProjectsView';
import { RunsView } from './ui/views/RunsView';
import { SettingsView } from './ui/views/SettingsView';

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

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [projects, setProjects] = useState<ProjectEntry[]>(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(INITIAL_PROJECTS[0].id);
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [runHistory, setRunHistory] = useState<CompletedRun[]>([]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const adapters = listAdapters(selectedProject.config);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const bridgeStatus = (isTauri ? 'live' : 'dry-run') as 'live' | 'dry-run';

  // Track which config paths are already being watched so we don't double-register.
  const watchedPaths = useRef<Set<string>>(new Set());

  // Start a Rust poll-watcher for each local project config that hasn't been watched yet.
  useEffect(() => {
    if (!isTauri) return;
    (async () => {
      const { watchConfig } = await import('../lib/bridge');
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
      const { onConfigChanged } = await import('../lib/bridge');
      unlisten = await onConfigChanged(({ path, config }) => {
        setProjects((prev) =>
          prev.map((p) => (p.configPath === path ? { ...p, config } : p)),
        );
      });
    })();
    return () => unlisten?.();
  }, [isTauri]);

  // Track which GitHub URLs already have a background poll running.
  const polledGithubUrls = useRef<Set<string>>(new Set());

  // Start a Rust poll loop for any GitHub-sourced project that isn't already polled.
  useEffect(() => {
    if (!isTauri) return;
    const githubProjects = projects.filter((p) =>
      p.configPath.startsWith('https://github.com/'),
    );
    if (githubProjects.length === 0) return;

    (async () => {
      const { startGithubPoll } = await import('../lib/bridge');
      const token =
        typeof window !== 'undefined'
          ? (localStorage.getItem('devpilot-github-token') ?? '')
          : '';
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
      const { onGithubUpdated } = await import('../lib/bridge');
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
        { pid, featureId, featureName, command, args, startedAt: Date.now(), logs: [], phase: 'running' },
      ]);
    },
    [],
  );

  const handleRunLog = useCallback((pid: number, line: string) => {
    setActiveRuns((prev) =>
      prev.map((r) => (r.pid === pid ? { ...r, logs: [...r.logs, line] } : r)),
    );
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
      const { killProcess } = await import('../lib/bridge');
      await killProcess(pid);
      handleRunEnd(pid, -1);
    },
    [handleRunEnd],
  );

  const handleAddProject = useCallback((entry: ProjectEntry) => {
    setProjects((prev) => [...prev, entry]);
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
            import('../lib/bridge').then(({ writeConfig }) =>
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
      onNavigate={setCurrentView}
      projects={projects}
      selectedProjectId={selectedProjectId}
      onSelectProject={setSelectedProjectId}
      projectName={selectedProject.config.project.name}
      projectRoot={selectedProject.config.project.root}
      bridgeStatus={bridgeStatus}
      activeRunCount={activeRuns.length}
    >
      {currentView === 'dashboard' && (
        <DashboardClient
          project={selectedProject.config.project}
          features={selectedProject.config.features}
          adapters={adapters}
          activeRuns={activeRuns}
          runHistory={runHistory}
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
      {currentView === 'runs' && (
        <RunsView
          activeRuns={activeRuns}
          runHistory={runHistory}
          onKillRun={handleKillRun}
        />
      )}
      {currentView === 'projects' && (
        <ProjectsView
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onAddProject={handleAddProject}
          runHistory={runHistory}
        />
      )}
      {currentView === 'ingestion' && (
        <IngestionView
          project={selectedProject.config.project}
          onImportFeatures={handleImportFeatures}
        />
      )}
      {currentView === 'settings' && <SettingsView />}
    </AppShell>
  );
}
