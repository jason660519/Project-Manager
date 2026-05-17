'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import sampleConfig1 from '../../config/samples/project-manager.sample.json';
import sampleConfig2 from '../../config/samples/project-manager-self.sample.json';
import { listAdapters } from '../../lib/adapters/registry';
import {
  getProjectsRepository,
  mergeFeaturesById,
  migrateConfig,
  resolveDashboardProjectIds,
  resolveInitialProjectId,
} from '../../lib/storage';
import {
  ActiveRun,
  CompletedRun,
  CronJob,
  CronRun,
  ProjectManagerConfig,
  EngineerRole,
  Feature,
  FeaturePromptConfig,
  FeatureStatus,
  ProjectEntry,
  ViewId,
} from '../../lib/types';
import { AppShell } from './AppShell';
import { ProjectProgressClient } from '../project-progress-dashboard/ProjectProgressClient';
import { FeaturesView } from './views/FeaturesView';
import { EngineersView } from './views/EngineersView';
import { PluginsView } from './views/PluginsView';
import { ProjectFilesView } from './views/ProjectFilesView';
import { ProjectsView } from './views/ProjectsView';
import { ChannelsView } from './views/ChannelsView';
import { CronJobsView } from './views/CronJobsView';
import { LogsView } from './views/LogsView';
import { SessionsView } from './views/SessionsView';
import { KeysView } from './views/KeysView';
import { KeyboardShortcutsView } from './views/KeyboardShortcutsView';
import { SettingsView } from './views/SettingsView';
import { DocumentationView } from './views/DocumentationView';

const INITIAL_PROJECTS: ProjectEntry[] = [
  {
    id: 'owner-property',
    config: sampleConfig1 as ProjectManagerConfig,
    configPath:
      '/Volumes/KLEVV-4T-1/Real Estate Management Projects/Owner-Property-Management-AI-SPA/.project-manager.json',
  },
  {
    id: 'project-manager',
    config: sampleConfig2 as ProjectManagerConfig,
    configPath: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager.json',
  },
];

interface MainClientProps {
  currentView: ViewId;
  initialProjectId?: string;
}

export function MainClient({ currentView, initialProjectId }: MainClientProps) {
  const router = useRouter();
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
  const [cronHistory, setCronHistory] = useState<CronRun[]>([]);
  const cronJobsRef = useRef<CronJob[]>([]);
  const cronNextRunRef = useRef<Record<string, number>>({});

  // Load persisted state from localStorage on mount.  The repository wraps a
  // synchronous localStorage in Promises (for future SQLite/cloud backends),
  // but we resolve them inline so the *first* post-mount render already
  // reflects the persisted selection — no async race that could leave a stale
  // [INITIAL_PROJECTS[0].id] selection sitting in state after navigation.
  useEffect(() => {
    let cancelled = false;
    const repo = getProjectsRepository();
    Promise.all([
      repo.listProjects(),
      repo.getSelectedProjectId(),
      repo.getDashboardProjectIds(),
    ]).then(([stored, storedSelectedId, storedDashboardIds]) => {
      if (cancelled) return;
      // Always keep the canonical (bundled) sample projects with their latest
      // config; append any user-added projects from storage as extras.
      const fallbackIds = new Set(INITIAL_PROJECTS.map((p) => p.id));
      const extras = stored.filter((p) => !fallbackIds.has(p.id));
      const safeProjects =
        stored.length > 0 ? [...INITIAL_PROJECTS, ...extras] : INITIAL_PROJECTS;
      setProjects(safeProjects);
      setSelectedProjectId(
        resolveInitialProjectId(safeProjects, initialProjectId, storedSelectedId),
      );
      setSelectedDashboardProjectIds(
        resolveDashboardProjectIds(safeProjects, storedDashboardIds),
      );
      setStorageInitialized(true);
    });
    return () => {
      cancelled = true;
    };
  }, [initialProjectId]);

  // Cross-route sync: when *another* MainClient instance (e.g. on a different
  // route opened from the sidebar) writes to localStorage, the `storage` event
  // fires on every other tab/window.  Same-tab navigations within the App
  // Router unmount/remount this component, so this listener mostly catches
  // edits made from devtools or a second window.  Cheap insurance.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      const repo = getProjectsRepository();
      // Re-read whichever slice changed and push it back into React state.
      if (e.key.endsWith('dashboardProjectIds') || e.key.endsWith('dashboard-selected-project-ids')) {
        void repo.getDashboardProjectIds().then((ids) => {
          if (ids) {
            setSelectedDashboardProjectIds((prev) =>
              JSON.stringify(prev) === JSON.stringify(ids) ? prev : ids,
            );
          }
        });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  // Restore run history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('projectManager:run-history');
      if (stored) setRunHistory(JSON.parse(stored));
    } catch {
      // ignore malformed data
    }
  }, []);

  // Persist run history to localStorage whenever it changes
  useEffect(() => {
    if (runHistory.length === 0) return;
    try {
      localStorage.setItem('projectManager:run-history', JSON.stringify(runHistory.slice(0, 100)));
    } catch {
      // ignore storage quota errors
    }
  }, [runHistory]);

  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  const bridgeStatus = (isTauri ? 'live' : 'dry-run') as 'live' | 'dry-run';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (isTextInput) return;
      if (event.shiftKey && (event.key === '?' || event.key === '/')) {
        event.preventDefault();
        router.push('/keyboard-shortcuts');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

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
    if (!storageInitialized) return;
    getProjectsRepository().saveProjects(projects).catch(() => {});
  }, [projects, storageInitialized]);

  useEffect(() => {
    if (!storageInitialized) return;
    if (!selectedProjectId) return;
    getProjectsRepository().setSelectedProjectId(selectedProjectId).catch(() => {});
  }, [selectedProjectId, storageInitialized]);

  useEffect(() => {
    if (!storageInitialized) return;
    getProjectsRepository()
      .setDashboardProjectIds(selectedDashboardProjectIds)
      .catch(() => {});
  }, [selectedDashboardProjectIds, storageInitialized]);

  // Keep selection valid when projects mutate.
  useEffect(() => {
    if (projects.length === 0) return;
    if (!projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Keep dashboard project multi-selection valid when projects mutate.
  // Only drops IDs that no longer exist; never re-adds anything, so the user's
  // intentional "empty selection" state is preserved.  Guarded by
  // storageInitialized so the init effect's restored selection is never wiped.
  useEffect(() => {
    if (!storageInitialized) return;
    setSelectedDashboardProjectIds((prev) => {
      const valid = prev.filter((id) => projects.some((p) => p.id === id));
      return valid.length === prev.length ? prev : valid;
    });
  }, [projects, storageInitialized]);

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
      const { startGithubPoll, getGithubToken } = await import('../../lib/bridge');
      const token = await getGithubToken();
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

  const handleFeatureUpdate = useCallback(
    (featureId: string, update: Partial<Pick<Feature, 'status' | 'progress'>>) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== selectedProjectId) return p;
          const updatedConfig = {
            ...p.config,
            features: p.config.features.map((f) =>
              f.id === featureId
                ? { ...f, ...update, updatedAt: new Date().toISOString() }
                : f,
            ),
          };
          if (isTauri && p.configPath) {
            import('../../lib/bridge').then(({ writeConfig }) =>
              writeConfig(p.configPath, updatedConfig).catch(() => {}),
            );
          }
          return { ...p, config: updatedConfig };
        }),
      );
    },
    [isTauri, selectedProjectId],
  );

  // Cross-project lookup: progress dashboard features may come from any project
  // (their id is namespaced as "projectId::featureId"). Splits the namespaced
  // id and routes the patch back to the originating project.
  const handleFeaturePromptSave = useCallback(
    (namespacedId: string, config: FeaturePromptConfig) => {
      const sep = namespacedId.indexOf('::');
      const projectId = sep > 0 ? namespacedId.slice(0, sep) : selectedProjectId;
      const featureId = sep > 0 ? namespacedId.slice(sep + 2) : namespacedId;
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          const updatedConfig = {
            ...p.config,
            features: p.config.features.map((f) =>
              f.id === featureId
                ? { ...f, promptConfig: config, updatedAt: new Date().toISOString() }
                : f,
            ),
          };
          if (isTauri && p.configPath) {
            import('../../lib/bridge').then(({ writeConfig }) =>
              writeConfig(p.configPath, updatedConfig).catch(() => {}),
            );
          }
          return { ...p, config: updatedConfig };
        }),
      );
    },
    [isTauri, selectedProjectId],
  );

  // Manual cron job run: same code path as the heartbeat would take, but
  // synchronous and surfaced via the panel button.
  const handleRunCronJob = useCallback(
    async (job: CronJob): Promise<void> => {
      const { spawnAgent } = await import('../../lib/bridge');
      const pid = await spawnAgent({
        command: job.action.command,
        args: job.action.args,
        workingDir: job.action.workingDir,
      });
      handleRunStart(pid, `cron:${job.id}`, job.name, job.action.command, job.action.args);
      const firedAt = new Date().toISOString();
      setCronHistory((h) =>
        [...h, { jobId: job.id, jobName: job.name, firedAt, status: 'ok' as const, pid }].slice(-100),
      );
    },
    [handleRunStart],
  );

  const handleAddProject = useCallback((entry: ProjectEntry) => {
    setProjects((prev) => [...prev, entry]);
    setSelectedProjectId(entry.id);
    setSelectedDashboardProjectIds((prev) => (prev.includes(entry.id) ? prev : [...prev, entry.id]));
  }, []);

  /**
   * Remove a project from PM's tracked list. Always removes the in-memory entry
   * (which then persists via the saveProjects effect); when `deleteConfigFile`
   * is true and we're on Tauri, also deletes the `.project-manager.json` on disk.
   * GitHub-sourced projects (configPath starts with https://) never touch disk.
   */
  const handleRemoveProject = useCallback(
    async (id: string, deleteConfigFile: boolean) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;

      if (deleteConfigFile && isTauri && !target.configPath.startsWith('https://')) {
        try {
          const { deleteConfig } = await import('../../lib/bridge');
          await deleteConfig(target.configPath);
        } catch (e) {
          // Surface the error but still drop the PM reference — the user's
          // primary intent ("remove from PM") shouldn't be blocked by a
          // disk-side failure (file already gone, permission denied, …).
          console.error('Failed to delete config file:', e);
        }
      }

      setProjects((prev) => prev.filter((p) => p.id !== id));
      setSelectedDashboardProjectIds((prev) => prev.filter((pid) => pid !== id));
      // selectedProjectId fallback is handled by the existing "keep selection valid" effect.
    },
    [isTauri, projects],
  );

  /**
   * Re-read a project from its source (local file or GitHub) and merge the
   * remote feature list onto local PM-side edits (status / progress / notes).
   * Stamps `lastSyncedAt` so the card can show "Synced X ago".
   */
  const handleSyncProject = useCallback(
    async (id: string) => {
      const target = projects.find((p) => p.id === id);
      if (!target) throw new Error('Project not found');

      const isGithub = target.configPath.startsWith('https://github.com/');
      const bridge = await import('../../lib/bridge');

      let remoteConfig: ProjectManagerConfig;
      if (isGithub) {
        if (!isTauri) throw new Error('GitHub sync requires Tauri runtime');
        const token = await bridge.getGithubToken();
        const ghFeatures = await bridge.fetchGithubRepo(token, target.configPath);
        const remoteFeatures: Feature[] = ghFeatures.map((f) => ({
          id: f.id,
          name: f.name,
          category: f.category,
          status: f.status as FeatureStatus,
          progress: f.progress,
          notes: f.notes,
          paths: { spec: '', tdd: '', implementation: '' },
        }));
        remoteConfig = migrateConfig({
          ...target.config,
          features: remoteFeatures,
        });
      } else {
        if (!isTauri) throw new Error('Local sync requires Tauri runtime');
        remoteConfig = await bridge.readConfig(target.configPath);
      }

      const mergedFeatures = mergeFeaturesById(remoteConfig.features, target.config.features);
      const mergedConfig: ProjectManagerConfig = { ...remoteConfig, features: mergedFeatures };

      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, config: mergedConfig, lastSyncedAt: new Date().toISOString() }
            : p,
        ),
      );

      // For local projects, write the merged result back so the next disk read
      // already reflects PM-side edits. GitHub repos are read-only here.
      if (!isGithub && isTauri) {
        await bridge.writeConfig(target.configPath, mergedConfig).catch(() => {});
      }
    },
    [isTauri, projects],
  );

  const handleToggleDashboardProject = useCallback((id: string, selected: boolean) => {
    setSelectedDashboardProjectIds((prev) => {
      const next = selected
        ? prev.includes(id)
          ? prev
          : [...prev, id]
        : prev.filter((projectId) => projectId !== id);
      // Persist immediately too — the effect above also writes, but doing it
      // here avoids the gap where a rapid second toggle reads the stale value.
      getProjectsRepository().setDashboardProjectIds(next).catch(() => {});
      return next;
    });
  }, []);

  const handleRolesUpdate = useCallback(
    (roles: EngineerRole[]) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== selectedProjectId) return p;
          const updatedConfig = { ...p.config, engineerRoles: roles };
          if (isTauri && p.configPath) {
            import('../../lib/bridge').then(({ writeConfig }) =>
              writeConfig(p.configPath, updatedConfig).catch(() => {}),
            );
          }
          return { ...p, config: updatedConfig };
        }),
      );
    },
    [isTauri, selectedProjectId],
  );

  const handleCronJobsUpdate = useCallback(
    (jobs: CronJob[]) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== selectedProjectId) return p;
          const updatedConfig = { ...p.config, cronJobs: jobs };
          if (isTauri && p.configPath) {
            import('../../lib/bridge').then(({ writeConfig }) =>
              writeConfig(p.configPath, updatedConfig).catch(() => {}),
            );
          }
          return { ...p, config: updatedConfig };
        }),
      );
    },
    [isTauri, selectedProjectId],
  );

  // Keep the cron jobs ref in sync so the scheduler sees the latest list.
  useEffect(() => {
    const jobs = selectedProject?.config.cronJobs ?? [];
    cronJobsRef.current = jobs;
    const now = Date.now();
    // Initialize nextRun for any newly-added enabled job.
    jobs.forEach((job) => {
      if (!job.enabled) return;
      if (!cronNextRunRef.current[job.id]) {
        const ms =
          job.schedule.unit === 'hours'
            ? job.schedule.value * 3_600_000
            : job.schedule.value * 60_000;
        cronNextRunRef.current[job.id] = now + ms;
      }
    });
    // Remove stale entries for deleted jobs.
    const ids = new Set(jobs.map((j) => j.id));
    Object.keys(cronNextRunRef.current).forEach((id) => {
      if (!ids.has(id)) delete cronNextRunRef.current[id];
    });
  }, [selectedProject?.config.cronJobs]);

  // Heartbeat: check every 30s if any job is due.
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      cronJobsRef.current.forEach((job) => {
        if (!job.enabled) return;
        const next = cronNextRunRef.current[job.id];
        if (!next || next > now) return;

        // Reschedule before firing so concurrent ticks don't double-fire.
        const ms =
          job.schedule.unit === 'hours'
            ? job.schedule.value * 3_600_000
            : job.schedule.value * 60_000;
        cronNextRunRef.current[job.id] = now + ms;

        const firedAt = new Date().toISOString();

        import('../../lib/bridge')
          .then(({ spawnAgent }) =>
            spawnAgent({
              command: job.action.command,
              args: job.action.args,
              workingDir: job.action.workingDir,
            }),
          )
          .then((pid) => {
            handleRunStart(pid, `cron:${job.id}`, job.name, job.action.command, job.action.args);
            setCronHistory((h) =>
              [...h, { jobId: job.id, jobName: job.name, firedAt, status: 'ok' as const, pid }].slice(-100),
            );
            setProjects((prev) =>
              prev.map((p) => {
                const jobs = p.config.cronJobs;
                if (!jobs?.some((j) => j.id === job.id)) return p;
                return {
                  ...p,
                  config: {
                    ...p.config,
                    cronJobs: jobs.map((j) =>
                      j.id === job.id ? { ...j, lastRun: firedAt, lastStatus: 'ok' as const } : j,
                    ),
                  },
                };
              }),
            );
          })
          .catch(() => {
            setCronHistory((h) =>
              [...h, { jobId: job.id, jobName: job.name, firedAt, status: 'error' as const }].slice(-100),
            );
            setProjects((prev) =>
              prev.map((p) => {
                const jobs = p.config.cronJobs;
                if (!jobs?.some((j) => j.id === job.id)) return p;
                return {
                  ...p,
                  config: {
                    ...p.config,
                    cronJobs: jobs.map((j) =>
                      j.id === job.id ? { ...j, lastRun: firedAt, lastStatus: 'error' as const } : j,
                    ),
                  },
                };
              }),
            );
          });
      });
    }, 30_000);

    return () => clearInterval(tick);
  }, [handleRunStart]);

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
        <ProjectProgressClient
          project={selectedProject.config.project}
          features={dashboardFeatures}
          adapters={adapters}
          cronJobs={selectedProject.config.cronJobs ?? []}
          activeRuns={activeRuns}
          dashboardProjectNames={effectiveDashboardProjects.map((p) => p.config.project.name)}
          onCronJobsChange={handleCronJobsUpdate}
          onFeaturePromptSave={handleFeaturePromptSave}
          onRunCronJob={handleRunCronJob}
        />
      )}
      {currentView === 'features' && (
        <FeaturesView
          features={selectedProject.config.features}
          adapters={adapters}
          projectRoot={selectedProject.config.project.root}
          activeRuns={activeRuns}
          runHistory={runHistory}
          engineerRoles={selectedProject.config.engineerRoles ?? []}
          onRunStart={handleRunStart}
          onRunLog={handleRunLog}
          onRunEnd={handleRunEnd}
          onFeatureUpdate={handleFeatureUpdate}
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
          onRemoveProject={handleRemoveProject}
          onSyncProject={handleSyncProject}
          runHistory={runHistory}
        />
      )}
      {currentView === 'plugins' && <PluginsView />}
      {currentView === 'channels' && <ChannelsView />}
      {currentView === 'sessions' && (
        <SessionsView projectRoot={selectedProject.config.project.root} />
      )}
      {currentView === 'cron-jobs' && (
        <CronJobsView
          cronJobs={selectedProject.config.cronJobs ?? []}
          cronHistory={cronHistory}
          onCronJobsChange={handleCronJobsUpdate}
        />
      )}
      {currentView === 'logs' && (
        <LogsView
          activeRuns={activeRuns}
          runHistory={runHistory}
          cronHistory={cronHistory}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onKillRun={handleKillRun}
        />
      )}
      {currentView === 'keys' && <KeysView />}
      {currentView === 'keyboard-shortcuts' && <KeyboardShortcutsView />}
      {currentView === 'settings' && <SettingsView />}
      {currentView === 'documentation' && <DocumentationView />}
      {currentView === 'engineers' && (
        <EngineersView
          roles={selectedProject.config.engineerRoles ?? []}
          agents={adapters}
          onRolesChange={handleRolesUpdate}
        />
      )}
      {currentView === 'project-files' && (
        <ProjectFilesView
          projects={projects}
          selectedDashboardProjectIds={selectedDashboardProjectIds}
        />
      )}
    </AppShell>
  );
}
