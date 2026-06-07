'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import sampleConfig1 from '../../config/samples/project-manager.sample.json';
import sampleConfig2 from '../../config/samples/project-manager-self.sample.json';
import { listAdapters } from '../../lib/adapters/registry';
import {
  ensureEngineerRoles,
  getProjectsRepository,
  mergeFeaturesById,
  mergeProjectConfigFromDisk,
  migrateConfig,
  normalizeProjectEntries,
  remapProjectIds,
  resolveDashboardProjectIds,
  resolveInitialProjectId,
} from '../../lib/storage';
import { resolveProjectRoot } from '../../lib/storage/dashboardLayout';
import { getProjectSetupStatus } from '../../lib/projectSetup';
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
import { ProjectsView } from './views/ProjectsView';
import { DOCUMENTATION_SITE_PUBLIC_MANIFEST } from '../../lib/generated/documentation-site-public';
import type { AIAssistantSheetId } from '../../lib/ai-assistants/types';
import {
  getBlockingGatesInOrder,
  type GateRunAllProgress,
  type GateRunPhase,
  type StandardsGateId,
} from '../../lib/companyStandards/standardsGates';
import { formatStandardsGateRunError } from '../../lib/companyStandards/formatGatePolicyMessage';
import { spawnStandardsGateRun, StandardsGateRunError } from '../../lib/companyStandards/spawnStandardsGate';
import { I18nProvider, useI18n } from '../../lib/i18n';

function RouteViewLoading() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center rounded border border-stone-700/80 bg-editor-panel p-6 text-[13px] text-stone-400">
      Loading view...
    </div>
  );
}

const FeaturesView = dynamic(
  () => import('./views/FeaturesView').then((mod) => mod.FeaturesView),
  { loading: RouteViewLoading },
);
const EngineersView = dynamic(
  () => import('./views/EngineersView').then((mod) => mod.EngineersView),
  { loading: RouteViewLoading },
);
const PluginsView = dynamic(
  () => import('./views/PluginsView').then((mod) => mod.PluginsView),
  { loading: RouteViewLoading },
);
const XmuxView = dynamic(
  () => import('./views/XmuxView').then((mod) => mod.XmuxView),
  { loading: RouteViewLoading },
);
const ChannelsView = dynamic(
  () => import('./views/ChannelsView').then((mod) => mod.ChannelsView),
  { loading: RouteViewLoading },
);
const CronJobsView = dynamic(
  () => import('./views/CronJobsView').then((mod) => mod.CronJobsView),
  { loading: RouteViewLoading },
);
const LogsView = dynamic(
  () => import('./views/LogsView').then((mod) => mod.LogsView),
  { loading: RouteViewLoading },
);
const SessionsView = dynamic(
  () => import('./views/SessionsView').then((mod) => mod.SessionsView),
  { loading: RouteViewLoading },
);
const KeysView = dynamic(
  () => import('./views/KeysView').then((mod) => mod.KeysView),
  { loading: RouteViewLoading },
);
const AiSdksView = dynamic(
  () => import('./views/AiSdksView').then((mod) => mod.AiSdksView),
  { loading: RouteViewLoading },
);
const SettingsView = dynamic(
  () => import('./views/SettingsView').then((mod) => mod.SettingsView),
  { loading: RouteViewLoading },
);
const DocumentationView = dynamic(
  () => import('./views/DocumentationView').then((mod) => mod.DocumentationView),
  { loading: RouteViewLoading },
);
const CompanyStandardsView = dynamic(
  () => import('./views/CompanyStandardsView').then((mod) => mod.CompanyStandardsView),
  { loading: RouteViewLoading },
);
const ChatPageClient = dynamic(
  () => import('../chat/ChatPageClient').then((mod) => mod.ChatPageClient),
  { loading: RouteViewLoading },
);
const AIAssistantsConsoleClient = dynamic(
  () => import('../ai_assistants/AIAssistantsConsoleClient').then((mod) => mod.AIAssistantsConsoleClient),
  { loading: RouteViewLoading },
);

type BridgeFileNode = {
  name: string;
  path: string;
  isDir?: boolean;
  is_dir?: boolean;
  children?: BridgeFileNode[];
};

function nodeIsDir(node: BridgeFileNode): boolean {
  return node.isDir ?? node.is_dir ?? false;
}

function collectFilePaths(nodes: BridgeFileNode[]): string[] {
  return nodes.flatMap((node) =>
    nodeIsDir(node) ? collectFilePaths(node.children ?? []) : [node.path],
  );
}

async function collectDashboardArtifactSnapshot(
  root: string,
  listProjectFiles: (root: string, maxDepth?: number) => Promise<BridgeFileNode[]>,
  readFile: (path: string) => Promise<string>,
) {
  const normalizedRoot = root.replace(/\/+$/, '');
  const files = collectFilePaths(await listProjectFiles(normalizedRoot, 4));
  const relativePaths = files.map((file) =>
    file.startsWith(`${normalizedRoot}/`) ? file.slice(normalizedRoot.length + 1) : file,
  );
  const readmeMatches = relativePaths
    .map((relativePath) => ({
      relativePath,
      match: relativePath.match(/^\.project-manager\/features\/(F\d+)\/README\.md$/),
    }))
    .filter((item): item is { relativePath: string; match: RegExpMatchArray } =>
      Boolean(item.match),
    );

  const featureReadmes = await Promise.all(
    readmeMatches.map(async ({ relativePath, match }) => ({
      featureId: match[1],
      relativePath,
      content: await readFile(`${normalizedRoot}/${relativePath}`),
    })),
  );

  return { featureReadmes, relativePaths };
}

/**
 * Bundled sample projects used to seed a brand-new install so first-time users
 * have something to explore. After the initial seed (tracked via
 * `ProjectsRepository.isSeeded`), the user fully owns the list — deleting a
 * sample is permanent. Existing users upgrading past the legacy
 * force-merge-on-every-boot behaviour also get these IDs scrubbed out exactly
 * once during the seeded-flag migration.
 */
const SEED_PROJECTS: ProjectEntry[] = [
  {
    id: 'owner-property',
    config: ensureEngineerRoles({
      ...(sampleConfig1 as ProjectManagerConfig),
      project: {
        ...(sampleConfig1 as ProjectManagerConfig).project,
        root: './internal-resources/projects/owner-property-management-ai-spa',
      },
    } as ProjectManagerConfig),
    configPath:
      './internal-resources/projects/owner-property-management-ai-spa/.project-manager/config.json',
  },
  {
    id: 'project-manager',
    config: ensureEngineerRoles({
      ...(sampleConfig2 as ProjectManagerConfig),
      project: {
        ...(sampleConfig2 as ProjectManagerConfig).project,
        root: '.',
      },
    } as ProjectManagerConfig),
    configPath: './.project-manager/config.json',
  },
];

const SEED_PROJECT_IDS = new Set(SEED_PROJECTS.map((p) => p.id));

// Upper bound on staged exit codes (see gateExitCodesRef). Bounds memory when
// unclaimed spawn tokens (dispatch processes the gate never drains) flow through
// the global listener.
const GATE_EXIT_CACHE_CAP = 64;

interface MainClientProps {
  currentView: ViewId;
  initialProjectId?: string;
  integrationsSheet?: import('../../lib/integrations/types').IntegrationSheet;
  keysSheet?: import('../../lib/keys/sheetSlugs').KeysSheetSlug;
  aiSdksSheet?: import('../../lib/aiSdks/sheetSlugs').AiSdksSheetSlug;
  documentationSlug?: string[];
  assistantSheet?: AIAssistantSheetId;
}

export function MainClient(props: MainClientProps) {
  return (
    <I18nProvider>
      <MainClientInner {...props} />
    </I18nProvider>
  );
}

function MainClientInner({ currentView, initialProjectId, integrationsSheet, keysSheet, aiSdksSheet, documentationSlug, assistantSheet }: MainClientProps) {
  const { t } = useI18n();
  const standardsGateLabels = t.companyStandards.gates;
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectEntry[]>(SEED_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId ?? SEED_PROJECTS[0]?.id ?? '',
  );
  const [selectedDashboardProjectIds, setSelectedDashboardProjectIds] = useState<string[]>(
    SEED_PROJECTS[0] ? [SEED_PROJECTS[0].id] : [],
  );
  const [storageInitialized, setStorageInitialized] = useState(false);
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [runHistory, setRunHistory] = useState<CompletedRun[]>([]);
  const [cronHistory, setCronHistory] = useState<CronRun[]>([]);
  const [detectedProjectManagerRoot, setDetectedProjectManagerRoot] = useState<string>('');
  const cronJobsRef = useRef<CronJob[]>([]);
  const cronNextRunRef = useRef<Record<string, number>>({});
  // Waiters/cache are keyed by the Rust-issued spawn token (unique, monotonic),
  // not the reusable OS PID — so a recycled PID can never replay a stale exit
  // onto an unrelated gate run (PR #15 follow-up; see ADR-014).
  const gateExitWaitersRef = useRef<Map<number, (code: number) => void>>(new Map());
  // Spawn tokens claimed by the standards-gate runner. The global agent-event
  // listener only routes these; dispatch modals own their own tokens and forward
  // separately (otherwise each gate-vs-dispatch event would be handled twice).
  const gateProcessTokensRef = useRef<Set<number>>(new Set());
  // Exit codes that arrived before the gate claimed its token / registered a
  // waiter (fast/instant-failing gates, or the exit racing the spawn invoke).
  // Keyed by token; bounded by GATE_EXIT_CACHE_CAP. Token uniqueness — not a
  // timing window — is what makes cross-correlation impossible.
  const gateExitCodesRef = useRef<Map<number, number>>(new Map());
  // True only while a standards-gate spawn is awaiting its token. The global
  // listener stages UNCLAIMED exits only in this window, so dispatch-process
  // exits (handled by the dispatch modals' own listeners) never fill the gate
  // cache and can't FIFO-evict the gate's own staged exit under batch load.
  const gateSpawnPendingRef = useRef(false);
  const [gatePhases, setGatePhases] = useState<Partial<Record<StandardsGateId, GateRunPhase>>>({});
  const [gateRunAllProgress, setGateRunAllProgress] = useState<GateRunAllProgress | null>(null);
  const [gateRunMessage, setGateRunMessage] = useState<string | null>(null);
  const [gateOrchestrationBusy, setGateOrchestrationBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getProjectManagerRoot } = await import('../../lib/bridge');
        const root = await getProjectManagerRoot();
        if (!cancelled) setDetectedProjectManagerRoot(root);
      } catch {
        if (!cancelled) setDetectedProjectManagerRoot('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const resolved = detectedProjectManagerRoot.trim().replace(/\/+$/, '');
    if (!resolved) return;
    setProjects((current) => {
      let changed = false;
      const next = current.map((project) => {
        const rewriteAbsolute = (value: string) =>
          value.replace(/^\/Users\/Project-Manager/, resolved);
        const rewriteRelative = (value: string) => {
          if (value === '.') return resolved;
          if (value.startsWith('./')) return `${resolved}/${value.slice(2)}`;
          return value;
        };

        if (project.id === 'project-manager') {
          const updated: ProjectEntry = {
            ...project,
            configPath: `${resolved}/.project-manager/config.json`,
            config: {
              ...project.config,
              project: { ...project.config.project, root: resolved },
            },
          };
          changed ||= JSON.stringify(updated) !== JSON.stringify(project);
          return updated;
        }

        if (project.id === 'owner-property') {
          const ownerRoot = `${resolved}/internal-resources/projects/owner-property-management-ai-spa`;
          const updated: ProjectEntry = {
            ...project,
            configPath: `${ownerRoot}/.project-manager/config.json`,
            config: {
              ...project.config,
              project: { ...project.config.project, root: ownerRoot },
            },
          };
          changed ||= JSON.stringify(updated) !== JSON.stringify(project);
          return updated;
        }

        const nextConfigPath = rewriteRelative(rewriteAbsolute(project.configPath ?? ''));
        const nextRoot = rewriteRelative(rewriteAbsolute(project.config.project.root ?? ''));
        if (nextConfigPath === project.configPath && nextRoot === project.config.project.root) {
          return project;
        }
        changed = true;
        return {
          ...project,
          configPath: nextConfigPath,
          config: {
            ...project.config,
            project: { ...project.config.project, root: nextRoot },
          },
        };
      });

      if (!changed) return current;
      void getProjectsRepository().saveProjects(next);
      return next;
    });
  }, [detectedProjectManagerRoot]);

  // Load persisted state from localStorage on mount.  The repository wraps a
  // synchronous localStorage in Promises (for future SQLite/cloud backends),
  // but we resolve them inline so the *first* post-mount render already
  // reflects the persisted selection — no async race that could leave a stale
  // [SEED_PROJECTS[0].id] selection sitting in state after navigation.
  //
  // Seeding contract: a brand-new install gets SEED_PROJECTS once. After that
  // (or after upgrading past the legacy force-merge behaviour), the user owns
  // their list completely — deleted samples never come back.
  useEffect(() => {
    let cancelled = false;
    const repo = getProjectsRepository();
    Promise.all([
      repo.listProjects(),
      repo.getSelectedProjectId(),
      repo.getDashboardProjectIds(),
      repo.isSeeded(),
    ]).then(([stored, storedSelectedId, storedDashboardIds, seeded]) => {
      if (cancelled) return;

      let safeProjects: ProjectEntry[];
      if (!seeded) {
        // One-time seeding / migration path.
        if (stored.length === 0) {
          // Brand-new install — show bundled samples as exploration aids.
          safeProjects = SEED_PROJECTS;
          void repo.saveProjects(SEED_PROJECTS);
        } else {
          // Existing user upgrading: previously their list was force-merged
          // with SEED_PROJECTS on every boot. Strip the hardcoded sample IDs
          // exactly once so deleting them in the UI actually sticks.
          safeProjects = stored
            .filter((p) => !SEED_PROJECT_IDS.has(p.id))
            .map((p) => ({ ...p, config: ensureEngineerRoles(p.config) }));
          void repo.saveProjects(safeProjects);
        }
        void repo.markSeeded();
      } else {
        // Already seeded — trust storage completely, including an empty list.
        safeProjects = stored.map((p) => ({ ...p, config: ensureEngineerRoles(p.config) }));
      }

      const normalized = normalizeProjectEntries(safeProjects);
      safeProjects = normalized.projects;

      const remappedStoredSelectedId = storedSelectedId
        ? (normalized.idMap.get(storedSelectedId) ?? storedSelectedId)
        : storedSelectedId;
      const remappedStoredDashboardIds = remapProjectIds(storedDashboardIds, normalized.idMap);

      setProjects(safeProjects);
      setSelectedProjectId(
        resolveInitialProjectId(safeProjects, initialProjectId, remappedStoredSelectedId),
      );
      setSelectedDashboardProjectIds(
        resolveDashboardProjectIds(safeProjects, remappedStoredDashboardIds),
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
  const projectManagerProject =
    projects.find((p) => p.id === 'project-manager') ??
    SEED_PROJECTS.find((p) => p.id === 'project-manager');
  const isAbsoluteLikePath = (value: string) =>
    value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
  const derivedRootFromConfigPath =
    projectManagerProject?.configPath && isAbsoluteLikePath(projectManagerProject.configPath)
      ? resolveProjectRoot(projectManagerProject.configPath)
      : '';
  const projectManagerRoot =
    detectedProjectManagerRoot ||
    derivedRootFromConfigPath ||
    (projectManagerProject?.config.project.root &&
    isAbsoluteLikePath(projectManagerProject.config.project.root)
      ? projectManagerProject.config.project.root
      : '');
  const adapters = selectedProject ? listAdapters(selectedProject.config) : [];
  const selectedDashboardProjects = projects.filter((p) => selectedDashboardProjectIds.includes(p.id));
  const effectiveDashboardProjects =
    selectedDashboardProjects.length > 0
      ? selectedDashboardProjects
      : selectedProject
        ? [selectedProject]
        : [];
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
        router.push('/settings');
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
        setProjects((prev) =>
          prev.map((p) =>
            p.configPath === path
              ? { ...p, config: mergeProjectConfigFromDisk(p.config, config, path) }
              : p,
          ),
        );
      });
    })();
    return () => unlisten?.();
  }, [isTauri]);

  // Tauri boot: hydrate local projects from disk immediately (don't wait for
  // the 2 s poll) and back-fill any missing default engineer roles.
  //
  // We read from the *current* project list rather than SEED_PROJECTS so a
  // user who has deleted the samples never has them silently re-hydrated.
  // The effect only fires once per session — `setProjects` mutations inside
  // do not retrigger because `projects` is intentionally not in the deps.
  useEffect(() => {
    if (!isTauri || !storageInitialized) return;
    let cancelled = false;
    (async () => {
      const { detectGithubRepoUrl, readConfig, writeConfig } = await import('../../lib/bridge');
      const localProjects = projects.filter(
        (p) => p.configPath && !p.configPath.startsWith('https://'),
      );
      const reads = await Promise.all(
        localProjects.map(async (p) => {
          try {
            let disk = await readConfig(p.configPath);
            if (!disk.project.githubUrl) {
              const root =
                disk.project.root ||
                p.config.project.root ||
                p.configPath
                  .replace(/\/\.project-manager\/config\.json$/, '')
                  .replace(/\/\.project-manager\.json$/, '');
              const detected = root ? await detectGithubRepoUrl(root).catch(() => null) : null;
              if (detected) {
                disk = {
                  ...disk,
                  updatedAt: new Date().toISOString(),
                  updatedBy: 'project-manager-git-origin',
                  project: { ...disk.project, githubUrl: detected },
                };
                await writeConfig(p.configPath, disk).catch(() => {});
              }
            }
            return { path: p.configPath, config: disk };
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const byPath = new Map(
        reads.filter((r): r is { path: string; config: ProjectManagerConfig } => r !== null)
          .map((r) => [r.path, r.config]),
      );
      if (byPath.size === 0) return;
      setProjects((prev) =>
        prev.map((p) => {
          const disk = byPath.get(p.configPath);
          return disk
            ? { ...p, config: mergeProjectConfigFromDisk(p.config, disk, p.configPath) }
            : p;
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot per session
  }, [isTauri, storageInitialized]);

  // Callable from the Projects toolbar sync button and the background poll.
  //
  // The dev `/api/registry` route inlines each project's on-disk config so we
  // can hydrate with real features instead of an empty scaffold. Older builds
  // of the route only returned `{ configPath }` — we still tolerate that
  // shape via the `buildProjectEntryFromPath` fallback below.
  const syncFromDesktop = useCallback(async (): Promise<void> => {
    const { buildProjectEntryFromPath } = await import('../../lib/storage');
    const res = await fetch('/api/registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' }),
    });
    if (!res.ok) return;
    const entries = (await res.json()) as Array<{
      configPath: string;
      config?: ProjectManagerConfig | null;
    }>;
    for (const entry of entries) {
      try {
        if (entry.config) {
          const diskConfig = entry.config;
          setProjects((prev) => {
            const idx = prev.findIndex((p) => p.configPath === entry.configPath);
            if (idx >= 0) {
              // One-shot upgrade: if the existing entry is still an empty
              // scaffold (configMissing or features: []), pull the disk
              // features in. Skip otherwise so the 2 s poll doesn't trample
              // PM-side edits or churn re-renders.
              const local = prev[idx];
              const diskFeatures = Array.isArray(diskConfig.features) ? diskConfig.features : [];
              if (diskFeatures.length === 0) {
                if (local.configMissing) {
                  const next = [...prev];
                  next[idx] = { ...local, configMissing: false };
                  return next;
                }
                return prev;
              }
              const merged = mergeProjectConfigFromDisk(local.config, diskConfig, entry.configPath);
              if (!local.configMissing && JSON.stringify(local.config) === JSON.stringify(merged)) {
                return prev;
              }
              const next = [...prev];
              next[idx] = { ...local, config: merged, configMissing: false };
              return next;
            }
            // Brand new project — take the disk config as the local copy.
            return normalizeProjectEntries([
              ...prev,
              {
                id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                config: migrateConfig(diskConfig),
                configPath: entry.configPath,
                configMissing: false,
              },
            ]).projects;
          });
        } else {
          // Disk unreadable / missing — fall back to scaffold so the folder
          // still surfaces in the Projects tab.
          const built = await buildProjectEntryFromPath(entry.configPath, { isTauri: false });
          setProjects((prev) =>
            normalizeProjectEntries(
              prev.some((p) => p.configPath === built.configPath) ? prev : [...prev, built],
            ).projects,
          );
        }
      } catch {
        /* skip unreadable paths */
      }
    }
  }, []);

  // One-shot: write all existing Tauri projects into the shared registry so
  // the web dev server can see them even before any new project is added.
  useEffect(() => {
    if (!isTauri || !storageInitialized) return;
    void (async () => {
      const { addToRegistry } = await import('../../lib/bridge');
      for (const p of projects) {
        if (p.configPath && !p.configPath.startsWith('https://')) {
          await addToRegistry(p.configPath).catch(() => {});
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot per session
  }, [isTauri, storageInitialized]);

  // Web dev mode: background poll so new desktop projects appear automatically.
  useEffect(() => {
    if (isTauri || !storageInitialized) return;
    let inFlight = false;
    async function poll() {
      if (inFlight) return;
      inFlight = true;
      await syncFromDesktop().catch(() => {});
      inFlight = false;
    }
    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => window.clearInterval(interval);
  }, [isTauri, storageInitialized, syncFromDesktop]);

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
    if (projects.length === 0) {
      if (selectedProjectId) setSelectedProjectId('');
      return;
    }
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

  // Respect an optional route-provided project ID for deep links.
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

  // Display-only: move a finished run into history and (for gates) flip its
  // phase chip. Token-based gate reconciliation (waiter resolve / early-exit
  // cache) lives in the global agent-event listener, not here.
  const handleRunEnd = useCallback((pid: number, exitCode: number) => {
    setActiveRuns((prev) => {
      const run = prev.find((r) => r.pid === pid);
      if (run) {
        if (run.featureId.startsWith('gate:')) {
          const gateId = run.featureId.slice(5) as StandardsGateId;
          setGatePhases((phases) => ({
            ...phases,
            [gateId]: exitCode === 0 ? 'pass' : 'fail',
          }));
        }
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

  const handleRunLogRef = useRef(handleRunLog);
  const handleRunEndRef = useRef(handleRunEnd);
  handleRunLogRef.current = handleRunLog;
  handleRunEndRef.current = handleRunEnd;

  const handleKillRun = useCallback(
    async (pid: number) => {
      const { killProcess } = await import('../../lib/bridge');
      await killProcess(pid);
      handleRunEnd(pid, -1);
    },
    [handleRunEnd],
  );

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    let unlistenAll: (() => void) | undefined;
    void (async () => {
      const { subscribeAgentProcessEvents, safeUnlisten } = await import('../../lib/bridge');
      // This MainClient-level listener exists to capture standards-gate process
      // events (gates have no mounted modal to forward them). Dispatch modals
      // already subscribe and forward their own PIDs, so route logs/exits for
      // gate-owned PIDs only — otherwise dispatch events would be handled twice.
      const unlisten = await subscribeAgentProcessEvents({
        onStdout: ({ pid, spawnToken, line }) => {
          if (gateProcessTokensRef.current.has(spawnToken)) handleRunLogRef.current(pid, line);
        },
        onStderr: ({ pid, spawnToken, line }) => {
          if (gateProcessTokensRef.current.has(spawnToken)) handleRunLogRef.current(pid, line);
        },
        onExit: ({ pid, spawnToken, code }) => {
          if (gateProcessTokensRef.current.has(spawnToken)) {
            // Claimed gate run: update display, then resolve the awaiting
            // orchestration by token. (If the waiter isn't registered yet, stash
            // the code — but in practice the claim path registers it
            // synchronously, with no await, before any event can interleave.)
            gateProcessTokensRef.current.delete(spawnToken);
            handleRunEndRef.current(pid, code);
            const waiter = gateExitWaitersRef.current.get(spawnToken);
            if (waiter) {
              gateExitWaitersRef.current.delete(spawnToken);
              waiter(code);
            } else {
              gateExitCodesRef.current.set(spawnToken, code);
            }
            return;
          }
          // Token not yet claimed. Rust (src-tauri/src/lib.rs) starts the
          // exit-emitting task before returning the token, so a fast gate's
          // agent-exit can arrive before spawnStandardsGateRun resolves. Stage
          // it by token so the gate claim can reconcile instead of hanging.
          // Only stage while a gate spawn is in flight: outside that window an
          // unclaimed token is a dispatch process the modals handle themselves,
          // and staging it here would just pressure the bounded cache and risk
          // FIFO-evicting the gate's own exit under batch load. Token uniqueness
          // (not a timing window) is what makes the staged code safe to replay.
          if (!gateSpawnPendingRef.current) return;
          const codes = gateExitCodesRef.current;
          codes.set(spawnToken, code);
          if (codes.size > GATE_EXIT_CACHE_CAP) {
            const oldest = codes.keys().next().value;
            if (oldest !== undefined) codes.delete(oldest);
          }
        },
      });
      if (cancelled) {
        safeUnlisten(unlisten);
        return;
      }
      unlistenAll = unlisten;
    })();
    return () => {
      cancelled = true;
      unlistenAll?.();
      unlistenAll = undefined;
    };
  }, [isTauri]);

  const waitForGateProcessExit = useCallback((spawnToken: number) => {
    // The exit event may have already fired before we got here — drain the cache.
    const cached = gateExitCodesRef.current.get(spawnToken);
    if (cached !== undefined) {
      gateExitCodesRef.current.delete(spawnToken);
      return Promise.resolve(cached);
    }
    return new Promise<number>((resolve) => {
      gateExitWaitersRef.current.set(spawnToken, resolve);
    });
  }, []);

  const handleRunStandardsGate = useCallback(
    async (gateId: StandardsGateId) => {
      const root = projectManagerRoot?.trim();
      if (!isTauri || !root) {
        setGateRunMessage(standardsGateLabels.desktopRequired);
        return;
      }
      if (gateOrchestrationBusy || activeRuns.some((r) => r.featureId.startsWith('gate:'))) {
        return;
      }
      setGateRunMessage(null);
      setGatePhases((phases) => ({ ...phases, [gateId]: 'running' }));
      try {
        // Open the staging window only around the native spawn (after all
        // preflight), so foreign dispatch exits during policy/inventory checks
        // aren't cached. onBeforeNativeSpawn fires right before the spawn invoke.
        const result = await spawnStandardsGateRun(gateId, root, isTauri, () => {
          gateSpawnPendingRef.current = true;
        });
        // Claim the token so the global listener routes this gate's events.
        gateProcessTokensRef.current.add(result.spawnToken);
        // Token claimed: close the staging window so later dispatch exits aren't cached.
        gateSpawnPendingRef.current = false;
        handleRunStart(result.pid, result.featureId, result.featureName, result.command, result.args);
        // The exit may have already fired before we claimed the token (Rust emits
        // agent-exit before returning it). Drain the cache now that the run
        // exists; otherwise await the listener. Token uniqueness guarantees a
        // cached code can only belong to this gate.
        const earlyExit = gateExitCodesRef.current.get(result.spawnToken);
        if (earlyExit !== undefined) {
          gateExitCodesRef.current.delete(result.spawnToken);
          gateProcessTokensRef.current.delete(result.spawnToken);
          handleRunEnd(result.pid, earlyExit);
        } else {
          await waitForGateProcessExit(result.spawnToken);
        }
      } catch (e) {
        gateSpawnPendingRef.current = false;
        setGateRunMessage(formatStandardsGateRunError(e, standardsGateLabels));
        setGatePhases((phases) => ({
          ...phases,
          [gateId]:
            e instanceof StandardsGateRunError && e.policyFailure ? 'blocked' : 'fail',
        }));
      }
    },
    [
      isTauri,
      projectManagerRoot,
      gateOrchestrationBusy,
      activeRuns,
      handleRunStart,
      handleRunEnd,
      waitForGateProcessExit,
      standardsGateLabels,
    ],
  );

  const handleRunAllBlockingGates = useCallback(async () => {
    const root = projectManagerRoot?.trim();
    if (!isTauri || !root) {
      setGateRunMessage(standardsGateLabels.desktopRequired);
      return;
    }
    if (gateOrchestrationBusy || activeRuns.some((r) => r.featureId.startsWith('gate:'))) {
      return;
    }

    const blocking = getBlockingGatesInOrder();
    setGateRunMessage(null);
    setGateOrchestrationBusy(true);
    setGateRunAllProgress({ active: true, index: 0, total: blocking.length });

    for (let i = 0; i < blocking.length; i += 1) {
      const gate = blocking[i];
      setGateRunAllProgress({
        active: true,
        currentLabel: gate.label,
        index: i + 1,
        total: blocking.length,
      });
      setGatePhases((phases) => ({ ...phases, [gate.id]: 'running' }));

      try {
        // Open the staging window only around the native spawn (see handleRunStandardsGate).
        const result = await spawnStandardsGateRun(gate.id, root, isTauri, () => {
          gateSpawnPendingRef.current = true;
        });
        // Claim the token and drain any exit that fired first (see handleRunStandardsGate).
        gateProcessTokensRef.current.add(result.spawnToken);
        // Token claimed: close the staging window so later dispatch exits aren't cached.
        gateSpawnPendingRef.current = false;
        handleRunStart(result.pid, result.featureId, result.featureName, result.command, result.args);
        const earlyExit = gateExitCodesRef.current.get(result.spawnToken);
        let code: number;
        if (earlyExit !== undefined) {
          gateExitCodesRef.current.delete(result.spawnToken);
          gateProcessTokensRef.current.delete(result.spawnToken);
          handleRunEnd(result.pid, earlyExit);
          code = earlyExit;
        } else {
          code = await waitForGateProcessExit(result.spawnToken);
        }
        setGatePhases((phases) => ({
          ...phases,
          [gate.id]: code === 0 ? 'pass' : 'fail',
        }));
        if (code !== 0) {
          for (let j = i + 1; j < blocking.length; j += 1) {
            const skipped = blocking[j];
            setGatePhases((phases) => ({ ...phases, [skipped.id]: 'skipped' }));
          }
          break;
        }
      } catch (e) {
        gateSpawnPendingRef.current = false;
        setGateRunMessage(formatStandardsGateRunError(e, standardsGateLabels));
        setGatePhases((phases) => ({
          ...phases,
          [gate.id]:
            e instanceof StandardsGateRunError && e.policyFailure ? 'blocked' : 'fail',
        }));
        for (let j = i + 1; j < blocking.length; j += 1) {
          const skipped = blocking[j];
          setGatePhases((phases) => ({ ...phases, [skipped.id]: 'skipped' }));
        }
        break;
      }
    }

    setGateRunAllProgress(null);
    setGateOrchestrationBusy(false);
  }, [
    isTauri,
    projectManagerRoot,
    gateOrchestrationBusy,
    activeRuns,
    handleRunStart,
    handleRunEnd,
    waitForGateProcessExit,
    standardsGateLabels,
  ]);

  const standardsGateRunBusy =
    gateOrchestrationBusy || activeRuns.some((r) => r.featureId.startsWith('gate:'));

  const handleFeatureUpdate = useCallback(
    (featureId: string, update: Partial<Feature>) => {
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

  // Cross-project feature patcher used by the progress dashboard. The
  // dashboard's row id is namespaced as `<projectId>::<featureId>` because
  // features from multiple projects can be aggregated into one view; this
  // splits the prefix off and routes the partial patch back to the
  // originating project's config.  Accepts any subset of Feature fields so
  // the dashboard can edit testCoverage / deployStatus / etc. without each
  // new field needing its own handler.
  const handleFeaturePatch = useCallback(
    (namespacedId: string, patch: Partial<Feature>) => {
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
                ? { ...f, ...patch, updatedAt: new Date().toISOString() }
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

  // Thin wrapper around the generic patcher kept for call-site readability —
  // the prompt-config flow is the loudest consumer and "save my prompt" is
  // clearer than a `{ promptConfig: ... }` patch object at the call site.
  const handleFeaturePromptSave = useCallback(
    (namespacedId: string, config: FeaturePromptConfig) =>
      handleFeaturePatch(namespacedId, { promptConfig: config }),
    [handleFeaturePatch],
  );

  // Manual cron job run: same code path as the heartbeat would take, but
  // synchronous and surfaced via the panel button.
  const handleRunCronJob = useCallback(
    async (job: CronJob): Promise<void> => {
      if (job.action.type !== 'run-command') {
        // dispatch-engineer execution lands in PR2 (ADR-012 follow-up).
        console.warn(`[cron] manual run skipped: action.type=${job.action.type} not yet implemented`);
        return;
      }
      const { spawnAgent } = await import('../../lib/bridge');
      const { pid } = await spawnAgent({
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

  const handleUpdateProject = useCallback((entry: ProjectEntry) => {
    setProjects((prev) => prev.map((p) => (p.id === entry.id ? entry : p)));
  }, []);

  const handleAddProject = useCallback(
    (entry: ProjectEntry) => {
      setProjects((prev) => [...prev, entry]);
      setSelectedProjectId(entry.id);
      // Only auto-include 'ready' projects in dashboard scope. Empty scaffolds
      // and needs-scan entries contribute zero rows, so prefilling the checkbox
      // creates the "checked but empty" confusion the user reported.
      if (getProjectSetupStatus(entry) === 'ready') {
        setSelectedDashboardProjectIds((prev) =>
          prev.includes(entry.id) ? prev : [...prev, entry.id],
        );
      }

      if (!isTauri) return;
      const root = entry.config.project.root;
      if (!root || root.startsWith('https://')) return;
      // Write to shared registry so the web dev server can sync by polling.
      void (async () => {
        const { addToRegistry } = await import('../../lib/bridge');
        await addToRegistry(entry.configPath).catch(() => {});
      })();
    },
    [isTauri],
  );

  /**
   * Remove a project from PM's tracked list. Always removes the in-memory entry
   * (which then persists via the saveProjects effect) and the shared registry
   * reference; when `deleteConfigFile` is true and we're on Tauri, also deletes
   * the `.project-manager/config.json` on disk.
   * GitHub-sourced projects (configPath starts with https://) never touch disk.
   */
  const handleRemoveProject = useCallback(
    async (id: string, deleteConfigFile: boolean) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;

      if (!target.configPath.startsWith('https://')) {
        if (isTauri && deleteConfigFile) {
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
        void (async () => {
          const { removeFromRegistry } = await import('../../lib/bridge');
          await removeFromRegistry(target.configPath).catch(() => {});
        })();
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
  const handleInitializeProject = useCallback(
    async (id: string, mode: 'create' | 'merge' | 'overwrite') => {
      const target = projects.find((p) => p.id === id);
      if (!target) throw new Error('Project not found');
      if (target.configPath.startsWith('https://')) {
        throw new Error('Initialize is only available for local projects');
      }
      if (!isTauri) throw new Error('Initialize requires the Project Manager desktop app');

      const {
        buildRecoveredProjectConfig,
        buildOverwriteScaffold,
        buildProjectScaffold,
        ensureFeaturePaths,
        hasRecoverableDashboardArtifacts,
        mergeProjectConfig,
        normalizeFeaturesLocatedSection,
      } = await import('../../lib/storage');
      const { initializeProject, listProjectFiles, readConfig, readFile, writeConfig } =
        await import('../../lib/bridge');

      const root =
        target.config.project.root ||
        target.configPath.replace(/\/\.project-manager\.json$/, '');
      let config = buildProjectScaffold(root, { projectName: target.config.project.name });
      let invokeMode: 'create' | 'merge' | 'overwrite' = mode;
      let shouldTryRecovery = mode === 'create';

      if (mode === 'merge' || mode === 'overwrite') {
        try {
          const existing = await readConfig(target.configPath);
          config =
            mode === 'merge'
              ? mergeProjectConfig(existing, config)
              : buildOverwriteScaffold(root, existing.project.name);
        } catch {
          invokeMode = 'create';
          shouldTryRecovery = true;
        }
      }

      if (shouldTryRecovery) {
        const snapshot = await collectDashboardArtifactSnapshot(root, listProjectFiles, readFile);
        if (hasRecoverableDashboardArtifacts(snapshot)) {
          config = buildRecoveredProjectConfig(root, snapshot, {
            projectName: target.config.project.name,
          });
        }
      }

      config = {
        ...config,
        features: normalizeFeaturesLocatedSection(ensureFeaturePaths(config.features)),
      };
      const result = await initializeProject(root, config, invokeMode);
      let mergedConfig = await readConfig(result.configPath);
      mergedConfig = {
        ...mergedConfig,
        features: normalizeFeaturesLocatedSection(ensureFeaturePaths(mergedConfig.features)),
      };
      await writeConfig(result.configPath, mergedConfig);

      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                config: mergedConfig,
                configPath: result.configPath,
                configMissing: false,
                lastSyncedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
    },
    [isTauri, projects],
  );

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
      const mergedConfig = ensureEngineerRoles({
        ...remoteConfig,
        features: mergedFeatures,
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                config: mergedConfig,
                configMissing: false,
                lastSyncedAt: new Date().toISOString(),
              }
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
        if (job.action.type !== 'run-command') {
          // dispatch-engineer scheduling lands in PR2 (ADR-012 follow-up).
          console.warn(`[cron] scheduled run skipped for ${job.id}: action.type=${job.action.type} not yet implemented`);
          return;
        }

        // Reschedule before firing so concurrent ticks don't double-fire.
        const ms =
          job.schedule.unit === 'hours'
            ? job.schedule.value * 3_600_000
            : job.schedule.value * 60_000;
        cronNextRunRef.current[job.id] = now + ms;

        const firedAt = new Date().toISOString();
        const action = job.action; // narrowed to RunCommandAction by guard above

        import('../../lib/bridge')
          .then(({ spawnAgent }) =>
            spawnAgent({
              command: action.command,
              args: action.args,
              workingDir: action.workingDir,
            }),
          )
          .then(({ pid }) => {
            handleRunStart(pid, `cron:${job.id}`, job.name, action.command, action.args);
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
      bridgeStatus={bridgeStatus}
      activeRunCount={activeRuns.length}
      chatContext={{
        currentView,
        selectedProject,
        adapters,
        activeRunCount: activeRuns.length,
        activeRuns: activeRuns.map((run) => ({
          featureId: run.featureId,
          featureName: run.featureName,
          phase: run.phase,
          startedAt: run.startedAt,
        })),
        recentRuns: runHistory.slice(0, 5),
        features: dashboardFeatures,
        dashboardProjects: effectiveDashboardProjects.map((p) => p.config.project.name),
      }}
    >
      {currentView === 'dashboard' && selectedProject && (
        <ProjectProgressClient
          project={selectedProject.config.project}
          projectRoot={selectedProject.config.project.root}
          features={dashboardFeatures}
          adapters={adapters}
          engineerRoles={selectedProject.config.engineerRoles ?? []}
          cronJobs={selectedProject.config.cronJobs ?? []}
          activeRuns={activeRuns}
          runHistory={runHistory}
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedDashboardProjectIds={selectedDashboardProjectIds}
          dashboardProjectNames={effectiveDashboardProjects.map((p) => p.config.project.name)}
          dashboardProjects={effectiveDashboardProjects.map((p) => ({
            id: p.id,
            name: p.config.project.name,
            repoUrl: p.config.project.githubUrl,
          }))}
          onSelectProject={setSelectedProjectId}
          onToggleDashboardProject={handleToggleDashboardProject}
          onAddProject={handleAddProject}
          onUpdateProject={handleUpdateProject}
          onRemoveProject={handleRemoveProject}
          onSyncFromDesktop={syncFromDesktop}
          onCronJobsChange={handleCronJobsUpdate}
          onFeaturePatch={handleFeaturePatch}
          onFeaturePromptSave={handleFeaturePromptSave}
          onRunCronJob={handleRunCronJob}
          onRunStart={handleRunStart}
          onRunLog={handleRunLog}
          onRunEnd={handleRunEnd}
        />
      )}
      {currentView === 'dashboard' && !selectedProject && (
        <ProjectsView
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedDashboardProjectIds={selectedDashboardProjectIds}
          onSelectProject={setSelectedProjectId}
          onToggleDashboardProject={handleToggleDashboardProject}
          onAddProject={handleAddProject}
          onUpdateProject={handleUpdateProject}
          onRemoveProject={handleRemoveProject}
          onSyncFromDesktop={syncFromDesktop}
          runHistory={runHistory}
        />
      )}
      {currentView === 'features' && selectedProject && (
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
      {currentView === 'integrations-hub' && (
        <PluginsView
          projectRoot={selectedProject?.config.project.root ?? ''}
          pmRepoRoot={projectManagerRoot}
          initialSheet={integrationsSheet}
        />
      )}
      {currentView === 'xmux' && (
        <XmuxView
          projects={projects}
          selectedDashboardProjectIds={selectedDashboardProjectIds}
          selectedProjectId={selectedProjectId}
        />
      )}
      {currentView === 'channels' && <ChannelsView />}
      {currentView === 'sessions' && selectedProject && (
        <SessionsView projectRoot={selectedProject.config.project.root} />
      )}
      {currentView === 'cron-jobs' && selectedProject && (
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
      {currentView === 'keys' && (
        <KeysView
          projectRoot={projectManagerRoot}
          initialSheet={keysSheet}
        />
      )}
      {currentView === 'ai-sdks' && (
        <AiSdksView
          projectRoot={projectManagerRoot}
          initialSheet={aiSdksSheet}
        />
      )}
      {currentView === 'settings' && <SettingsView />}
      {currentView === 'chat' && (
        assistantSheet ? (
          <AIAssistantsConsoleClient
            activeSheet={assistantSheet}
            projectRoot={selectedProject?.config.project.root}
            engineersPanel={
              selectedProject ? (
                <EngineersView
                  embedded
                  roles={selectedProject.config.engineerRoles ?? []}
                  agents={adapters}
                  onRolesChange={handleRolesUpdate}
                />
              ) : undefined
            }
            initialChatContext={{
              currentView,
              selectedProject,
              adapters,
              activeRunCount: activeRuns.length,
              activeRuns: activeRuns.map((run) => ({
                featureId: run.featureId,
                featureName: run.featureName,
                phase: run.phase,
                startedAt: run.startedAt,
              })),
              recentRuns: runHistory.slice(0, 5),
              features: dashboardFeatures,
              dashboardProjects: effectiveDashboardProjects.map((p) => p.config.project.name),
            }}
          />
        ) : (
          <ChatPageClient
            initialChatContext={{
              currentView,
              selectedProject,
              adapters,
              activeRunCount: activeRuns.length,
              activeRuns: activeRuns.map((run) => ({
                featureId: run.featureId,
                featureName: run.featureName,
                phase: run.phase,
                startedAt: run.startedAt,
              })),
              recentRuns: runHistory.slice(0, 5),
              features: dashboardFeatures,
              dashboardProjects: effectiveDashboardProjects.map((p) => p.config.project.name),
            }}
          />
        )
      )}
      {currentView === 'documentation' && (
        <DocumentationView
          manifest={DOCUMENTATION_SITE_PUBLIC_MANIFEST}
          initialSlug={documentationSlug ?? []}
        />
      )}
      {currentView === 'company-standards' && (
        <CompanyStandardsView
          dashboardScopeProjects={effectiveDashboardProjects}
          canRunGates={isTauri && Boolean(projectManagerRoot?.trim())}
          gatePhases={gatePhases}
          runAllProgress={gateRunAllProgress}
          gateRunMessage={gateRunMessage}
          anyGateRunning={standardsGateRunBusy}
          onRunGate={handleRunStandardsGate}
          onRunAllBlocking={handleRunAllBlockingGates}
        />
      )}
    </AppShell>
  );
}
