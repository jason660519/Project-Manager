'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Check,
  FolderOpen,
  Github,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { hasProviderKey } from '../../../lib/keys/loadProviderKey';
import {
  ALL_LLM_PROVIDERS,
  type LlmProviderId,
} from '../../../lib/keys/providerOrder';
import {
  getProjectSetupStatus,
  projectNeedsScan,
  setupStatusLabel,
} from '../../../lib/projectSetup';
import {
  runProjectScan,
  type ProviderAttempt,
  type ScanProgressEvent,
} from '../../../lib/scanner/runProjectScan';
import {
  formatAttemptFailure,
  formatProviderAttempt,
  summarizeScanError,
} from '../../../lib/scanner/errorSummary';
import {
  applyScanConfigToProject,
  buildProjectEntryFromPath,
  migrateConfig,
  resolveConfigPath,
} from '../../../lib/storage';
import { CompletedRun, ProjectManagerConfig, Feature, ProjectEntry } from '../../../lib/types';
import { PostImportScanDialog } from './_components/PostImportScanDialog';

interface ProjectsViewProps {
  projects: ProjectEntry[];
  selectedProjectId: string;
  selectedDashboardProjectIds: string[];
  onSelectProject: (id: string) => void;
  onToggleDashboardProject: (id: string, selected: boolean) => void;
  onAddProject: (entry: ProjectEntry) => void;
  onUpdateProject: (entry: ProjectEntry) => void;
  onRemoveProject: (id: string, deleteConfigFile: boolean) => Promise<void> | void;
  onSyncFromDesktop?: () => Promise<void>;
  runHistory: CompletedRun[];
}

function isMissingConfigError(message: string): boolean {
  return /No such file or directory|Is a directory|os error 2\b|os error 21\b|CONFIG_EXISTS/i.test(
    message,
  );
}

function normalizeGithubRepoUrlInput(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  if (!trimmed) return '';

  let path = '';
  if (trimmed.startsWith('git@github.com:')) {
    path = trimmed.slice('git@github.com:'.length);
  } else if (trimmed.startsWith('ssh://git@github.com/')) {
    path = trimmed.slice('ssh://git@github.com/'.length);
  } else if (trimmed.startsWith('https://github.com/')) {
    path = trimmed.slice('https://github.com/'.length);
  } else if (trimmed.startsWith('http://github.com/')) {
    path = trimmed.slice('http://github.com/'.length);
  }

  const [owner, repo] = path.split('/');
  if (!owner || !repo) {
    throw new Error('Use a GitHub repository URL like https://github.com/owner/repo.');
  }
  return `https://github.com/${owner}/${repo.replace(/\.git$/, '')}`;
}

type InitTraceStatus = 'running' | 'success' | 'warning' | 'failed';

interface InitTraceEntry {
  id: string;
  status: InitTraceStatus;
  label: string;
  detail?: string;
  timestamp: string;
  provider?: LlmProviderId;
  modelId?: string;
}

/**
 * Result of one full Initialize run — used by the row to display fallback
 * notices and the trace panel.
 */
interface InitializeOutcome {
  entry: ProjectEntry;
  providerUsed?: LlmProviderId;
  usedModelId?: string;
  fallbacks: ProviderAttempt[];
}

function shortError(raw: string | undefined): string | undefined {
  const oneLine = summarizeScanError(raw);
  if (!oneLine) return undefined;
  return oneLine.length > 180 ? `${oneLine.slice(0, 177)}...` : oneLine;
}

function scanProgressToTrace(event: ScanProgressEvent): InitTraceEntry {
  const status: InitTraceStatus =
    event.status === 'pending' ? 'running' : event.status;
  return {
    id: `${event.timestamp}-${event.stage}-${event.provider ?? ''}-${event.modelId ?? ''}-${event.status}`,
    status,
    label: event.message,
    detail: shortError(event.error),
    timestamp: event.timestamp,
    provider: event.provider,
    modelId: event.modelId,
  };
}

function buildFallbackNotice(projectName: string, outcome: InitializeOutcome): string | null {
  if (!outcome.providerUsed || outcome.fallbacks.length === 0) return null;
  const successful = outcome.usedModelId
    ? `${outcome.providerUsed}/${outcome.usedModelId}`
    : outcome.providerUsed;
  const failedCount = outcome.fallbacks.length;
  const failures = outcome.fallbacks.map(formatAttemptFailure).join('; ');
  return `${projectName}: initialized successfully with ${successful}. ${failedCount} earlier model attempt${
    failedCount === 1 ? '' : 's'
  } failed: ${failures}. Open the initialization trace for the full sanitized details.`;
}

export function ProjectsView({
  projects,
  selectedProjectId,
  selectedDashboardProjectIds,
  onSelectProject,
  onToggleDashboardProject,
  onAddProject,
  onUpdateProject,
  onRemoveProject,
  onSyncFromDesktop,
  runHistory,
}: ProjectsViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'local' | 'github'>('local');
  /** Folder path used by the AI Scan flow. */
  /** Path the user pastes into the manual-add field (or auto-filled by Browse). */
  const [manualConfigPath, setManualConfigPath] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [reportText, setReportText] = useState('');
  const [reportCopied, setReportCopied] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  // Delete confirmation modal state.
  const [deleteTarget, setDeleteTarget] = useState<ProjectEntry | null>(null);
  const [deleteAlsoFile, setDeleteAlsoFile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickingFolders, setPickingFolders] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [repoEditProjectId, setRepoEditProjectId] = useState<string | null>(null);
  const [repoUrlDraft, setRepoUrlDraft] = useState('');
  const [repoUrlBusyId, setRepoUrlBusyId] = useState<string | null>(null);
  const [repoUrlErrors, setRepoUrlErrors] = useState<Record<string, string>>({});
  const [postImportScanQueue, setPostImportScanQueue] = useState<ProjectEntry[] | null>(null);
  const [batchScanning, setBatchScanning] = useState(false);
  // Per-row Initialize state. One project at a time can be busy initializing;
  // any failures land in initErrors keyed by project id and surface below the row.
  const [initializingIds, setInitializingIds] = useState<Set<string>>(new Set());
  const [initErrors, setInitErrors] = useState<Record<string, string>>({});
  const [initTrace, setInitTrace] = useState<Record<string, InitTraceEntry[]>>({});
  /**
   * Three-colour notice (success / warning / error) replacing the old single
   * emerald string. Same slot in the UI, but the kind decides the colour so
   * "Imported 4" and "1 scan failed" don't both look like success.
   */
  const [notice, setNotice] = useState<
    { kind: 'success' | 'warning' | 'error'; text: string } | null
  >(null);
  /**
   * Tri-state preflight: null = still checking, false = no usable provider,
   * true = at least one fallback-order provider has a key. We gate the
   * Initialize UI on this so a batch-scan never fires identical "no key"
   * errors. (Provider order itself is honoured by the scanner.)
   */
  const [anyProviderKeyPresent, setAnyProviderKeyPresent] = useState<boolean | null>(null);
  const projectRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const router = useRouter();

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
    let cancelled = false;
    (async () => {
      const { getGithubToken } = await import('../../../lib/bridge');
      const token = await getGithubToken();
      if (!cancelled) setGithubToken(token);
    })();
    // Multi-provider preflight — runs on mount and after the Keys view
    // focus event so saving a key (or reordering providers) clears the
    // banner without a full reload. We only need to know whether *any*
    // configured provider has a key; the scanner decides the exact order.
    const refreshKey = async () => {
      try {
        const flags = await Promise.all(ALL_LLM_PROVIDERS.map((p) => hasProviderKey(p)));
        if (!cancelled) setAnyProviderKeyPresent(flags.some(Boolean));
      } catch {
        if (!cancelled) setAnyProviderKeyPresent(false);
      }
    };
    void refreshKey();
    const onFocus = () => void refreshKey();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, []);

  // Reset transient modal state when the dialog closes so the next open
  // starts clean (no stale error / stale path).
  useEffect(() => {
    if (!showAddModal) {
      setAddError('');
      setManualConfigPath('');
    }
  }, [showAddModal]);

  const handleAddGitHub = async () => {
    if (!githubUrl.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const { fetchGithubRepo } = await import('../../../lib/bridge');
      const normalizedGithubUrl = normalizeGithubRepoUrlInput(githubUrl);
      const ghFeatures = await fetchGithubRepo(githubToken, normalizedGithubUrl);

      const repoName = normalizedGithubUrl.split('/').slice(-2).join('/');
      const features: Feature[] = ghFeatures.map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status as Feature['status'],
        category: f.category,
        progress: f.progress,
        notes: f.notes,
        paths: { spec: '', tdd: '' },
      }));

      const config: ProjectManagerConfig = migrateConfig({
        schemaVersion: 2,
        project: {
          name: repoName,
          root: normalizedGithubUrl,
          githubUrl: normalizedGithubUrl,
          defaultIDE: 'Cursor',
        },
        features,
        adapters: { ides: [], agents: [] },
      });

      onAddProject({ id: `gh-${Date.now()}`, config, configPath: normalizedGithubUrl });
      setShowAddModal(false);
      setGithubUrl('');
    } catch (e) {
      setAddError(`GitHub import failed: ${e}`);
    } finally {
      setAdding(false);
    }
  };

  const upsertProjectFromPath = async (folderOrConfigPath: string): Promise<ProjectEntry> => {
    const resolvedPath = resolveConfigPath(folderOrConfigPath.trim());
    const existing = projects.find((p) => p.configPath === resolvedPath);
    const entry = await buildProjectEntryFromPath(folderOrConfigPath, {
      isTauri,
      existing,
    });
    if (existing) {
      onUpdateProject(entry);
    } else {
      onAddProject(entry);
    }
    return entry;
  };

  const beginRepoUrlEdit = (project: ProjectEntry) => {
    setRepoEditProjectId(project.id);
    setRepoUrlDraft(project.config.project.githubUrl ?? '');
    setRepoUrlErrors((prev) => {
      if (!(project.id in prev)) return prev;
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
  };

  const saveProjectRepoUrl = async (project: ProjectEntry, rawUrl: string) => {
    setRepoUrlBusyId(project.id);
    setRepoUrlErrors((prev) => {
      if (!(project.id in prev)) return prev;
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
    try {
      const normalized = normalizeGithubRepoUrlInput(rawUrl);
      const updatedConfig: ProjectManagerConfig = {
        ...project.config,
        updatedAt: new Date().toISOString(),
        updatedBy: 'project-manager',
        project: {
          ...project.config.project,
          githubUrl: normalized || undefined,
        },
      };
      const updatedEntry: ProjectEntry = { ...project, config: updatedConfig };
      if (isTauri && !project.configPath.startsWith('https://') && !project.configMissing) {
        const { writeConfig } = await import('../../../lib/bridge');
        await writeConfig(project.configPath, updatedConfig);
      }
      onUpdateProject(updatedEntry);
      setRepoEditProjectId(null);
      setRepoUrlDraft('');
      setNotice({
        kind: normalized ? 'success' : 'warning',
        text: normalized
          ? `${project.config.project.name}: GitHub repository URL saved.`
          : `${project.config.project.name}: GitHub repository URL cleared.`,
      });
    } catch (e) {
      setRepoUrlErrors((prev) => ({
        ...prev,
        [project.id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setRepoUrlBusyId(null);
    }
  };

  const detectAndSaveProjectRepoUrl = async (project: ProjectEntry) => {
    if (!isTauri || project.config.project.root.startsWith('https://')) return;
    setRepoUrlBusyId(project.id);
    setRepoUrlErrors((prev) => {
      if (!(project.id in prev)) return prev;
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
    try {
      const { detectGithubRepoUrl } = await import('../../../lib/bridge');
      const detected = await detectGithubRepoUrl(project.config.project.root);
      if (!detected) {
        setRepoUrlErrors((prev) => ({
          ...prev,
          [project.id]: 'No GitHub origin remote was found for this local project.',
        }));
        return;
      }
      await saveProjectRepoUrl(project, detected);
    } catch (e) {
      setRepoUrlErrors((prev) => ({
        ...prev,
        [project.id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setRepoUrlBusyId(null);
    }
  };

  const handleAddLocal = async () => {
    if (!manualConfigPath.trim()) return;
    const resolvedPath = resolveConfigPath(manualConfigPath);
    setAdding(true);
    setAddError('');
    try {
      await upsertProjectFromPath(manualConfigPath);
      setShowAddModal(false);
      setManualConfigPath('');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (isMissingConfigError(raw)) {
        setAddError(
          `No dashboard config found at ${resolvedPath}. Click Initialize on this project's row to generate one.`,
        );
      } else {
        setAddError(`Failed to read config: ${raw}`);
      }
    } finally {
      setAdding(false);
    }
  };

  const formatFolderPickerError = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error);
    if (/Loading chunk .*plugin-dialog.*failed/i.test(raw)) {
      return 'Native Finder picker assets changed while the desktop app was open. Reload Project Manager and try Choose from Finder again, or paste the project folder path below.';
    }
    return raw;
  };

  /** Native Finder / Explorer folder picker — fill a field or import immediately. */
  const handlePickFolders = async (mode: 'import' | 'manual') => {
    if (!isTauri) {
      setAddError(
        'Native Finder picker is desktop-only — paste a project folder path below to import from the dev server.',
      );
      return;
    }
    setPickingFolders(true);
    setAddError('');
    try {
      const { pickProjectFolders } = await import('../../../lib/bridge');
      const result = await pickProjectFolders({
        multiple: mode === 'import',
        title:
          mode === 'import'
            ? 'Select project folder(s) to import'
            : 'Select a project folder',
      });

      if (result.status === 'unsupported') {
        setAddError(
          'Native Finder picker is desktop-only — paste a project folder path below to import from the dev server.',
        );
        return;
      }
      if (result.status === 'cancelled') return;

      const { paths } = result;
      if (paths.length === 0) return;

      switch (mode) {
        case 'manual':
          setManualConfigPath(paths[0]);
          return;
        case 'import': {
          setAdding(true);
          const failures: string[] = [];
          const importedEntries: ProjectEntry[] = [];
          const needsSetup: ProjectEntry[] = [];
          for (const folderPath of paths) {
            try {
              const entry = await upsertProjectFromPath(folderPath);
              importedEntries.push(entry);
              if (projectNeedsScan(entry)) needsSetup.push(entry);
            } catch (e) {
              const raw = e instanceof Error ? e.message : String(e);
              const label = folderPath.split('/').filter(Boolean).pop() ?? folderPath;
              failures.push(`${label}: ${raw}`);
            }
          }

          const imported = importedEntries.length;
          if (imported > 0) {
            setNotice(
              failures.length > 0
                ? {
                    kind: 'warning',
                    text: `Imported ${imported} folder${imported === 1 ? '' : 's'}, ${failures.length} failed.`,
                  }
                : {
                    kind: 'success',
                    text: `Imported ${imported} folder${imported === 1 ? '' : 's'}.`,
                  },
            );
            setShowAddModal(false);
            setManualConfigPath('');
            if (needsSetup.length > 0 && isTauri) {
              setPostImportScanQueue(needsSetup);
            }
          }
          if (failures.length > 0) {
            setAddError(failures.join('\n'));
          } else {
            setAddError('');
          }
          if (imported === 0) {
            setAddError(failures.join('\n') || 'No projects were imported.');
            setNotice({
              kind: 'error',
              text: `Import failed for ${failures.length || 1} folder${(failures.length || 1) === 1 ? '' : 's'}.`,
            });
          }
          return;
        }
        default: {
          const _exhaustive: never = mode;
          throw new Error(`unhandled folder-picker mode: ${String(_exhaustive)}`);
        }
      }
    } catch (e) {
      console.error('[handlePickFolders]', e);
      setAddError(formatFolderPickerError(e));
    } finally {
      setPickingFolders(false);
      setAdding(false);
    }
  };

  // ── AI Scan handlers ──────────────────────────────────────────────────────

  const formatScanError = (raw: string): string =>
    raw === 'NO_PROVIDER_CONFIGURED'
      ? 'No AI provider is configured. Open Keys to save at least one API key, then enable it in Settings.'
      : summarizeScanError(raw) ?? raw;

  const resetInitTrace = (projectId: string) => {
    setInitTrace((prev) => ({ ...prev, [projectId]: [] }));
  };

  const appendInitTrace = (projectId: string, entry: InitTraceEntry) => {
    setInitTrace((prev) => ({
      ...prev,
      [projectId]: [...(prev[projectId] ?? []), entry].slice(-40),
    }));
  };

  const revealProjectProgress = (projectId: string) => {
    onSelectProject(projectId);
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      projectRowRefs.current[projectId]?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    });
  };

  const persistInitializationRun = async (
    project: ProjectEntry,
    result: Awaited<ReturnType<typeof runProjectScan>>,
    trace: InitTraceEntry[],
  ) => {
    if (!isTauri || project.config.project.root.startsWith('https://')) return;
    try {
      const { writeFile } = await import('../../../lib/bridge');
      const now = new Date().toISOString();
      const fileSafeNow = now.replace(/[:.]/g, '-');
      const payload = {
        schemaVersion: 1,
        project: {
          name: project.config.project.name,
          root: project.config.project.root,
        },
        startedAt: trace[0]?.timestamp ?? now,
        completedAt: now,
        success: result.success,
        providerUsed: result.providerUsed,
        usedModelId: result.usedModelId,
        attempts: result.attempts?.map((attempt) => ({
          provider: attempt.provider,
          modelId: attempt.modelId,
          outcome: attempt.outcome,
          error: shortError(attempt.error),
        })),
        contextSummary: result.context
          ? {
              sectionCandidateCount: result.context.sectionCandidates?.length ?? 0,
              inventoryPathCount: result.context.inventoryPaths?.length ?? 0,
              featureCount: result.config?.features.length ?? 0,
            }
          : undefined,
        validationReport: result.validationReport,
        reviewSummary: result.reviewSummary,
        quorumSummary: result.quorumSummary,
        trace: trace.map((entry) => ({
          status: entry.status,
          label: entry.label,
          detail: entry.detail,
          timestamp: entry.timestamp,
          provider: entry.provider,
          modelId: entry.modelId,
        })),
      };
      await writeFile(
        `${project.config.project.root.replace(/\/+$/, '')}/.project-manager/initialization-runs/${fileSafeNow}.json`,
        JSON.stringify(payload, null, 2),
      );
    } catch {
      // Trace persistence is best-effort; it should never make initialization fail.
    }
  };

  const runScanForProject = async (project: ProjectEntry): Promise<InitializeOutcome> => {
    const root = project.config.project.root;
    if (!root?.trim()) throw new Error('Project root is missing');
    const trace: InitTraceEntry[] = [];
    const recordTrace = (entry: InitTraceEntry) => {
      trace.push(entry);
      appendInitTrace(project.id, entry);
    };
    const result = await runProjectScan(root, {
      onProgress: (event) => recordTrace(scanProgressToTrace(event)),
    });
    if (!result.success || !result.config) {
      await persistInitializationRun(project, result, trace);
      const err = result.error || 'AI Scan failed';
      if (err === 'NO_PROVIDER_CONFIGURED') {
        // Surface the key state to the rest of the view so the banner appears
        // even when the user never explicitly visited Keys.
        setAnyProviderKeyPresent(false);
      }
      throw new Error(err);
    }
    recordTrace({
      id: `${Date.now()}-validate`,
      status: 'running',
      label: 'Validating located sections and evidence paths',
      timestamp: new Date().toISOString(),
    });
    const entry = await applyScanConfigToProject(project, result.config, {
      sectionCandidates: result.context?.sectionCandidates,
      inventoryPaths: result.context?.inventoryPaths,
    });
    const validationReport = result.validationReport;
    recordTrace({
      id: `${Date.now()}-write`,
      status: validationReport && validationReport.reviewCount > 0 ? 'warning' : 'success',
      label: `Wrote ${entry.config.features.length} feature${
        entry.config.features.length === 1 ? '' : 's'
      } to .project-manager/config.json${
        validationReport
          ? ` (${validationReport.highConfidenceCount} high confidence, ${validationReport.reviewCount} need review)`
          : ''
      }`,
      timestamp: new Date().toISOString(),
    });
    await persistInitializationRun(project, result, trace);
    const fallbacks =
      result.attempts
        ?.filter((a) => a.outcome !== 'success' && a.error)
        ?? [];
    return {
      entry,
      providerUsed: result.providerUsed,
      usedModelId: result.usedModelId,
      fallbacks,
    };
  };

  /**
   * Initialize a single project — runs the AI scan, then writes
   * `.project-manager/config.json` to disk. This is the only per-row action
   * besides Delete after the row simplification.
   */
  const handleInitializeOne = async (project: ProjectEntry) => {
    if (anyProviderKeyPresent === false) {
      setInitErrors((prev) => ({ ...prev, [project.id]: 'NO_PROVIDER_CONFIGURED' }));
      return;
    }
    resetInitTrace(project.id);
    appendInitTrace(project.id, {
      id: `${Date.now()}-queued`,
      status: 'running',
      label: 'Initializing project scan',
      timestamp: new Date().toISOString(),
    });
    setInitializingIds((prev) => new Set(prev).add(project.id));
    setInitErrors((prev) => {
      if (!(project.id in prev)) return prev;
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
    try {
      const outcome = await runScanForProject(project);
      onUpdateProject(outcome.entry);
      const fallbackNotice = buildFallbackNotice(project.config.project.name, outcome);
      if (fallbackNotice) {
        setNotice({
          kind: 'warning',
          text: fallbackNotice,
        });
      } else {
        setNotice({
          kind: 'success',
          text: `${project.config.project.name}: initialized successfully.`,
        });
      }
    } catch (e) {
      setInitErrors((prev) => ({
        ...prev,
        [project.id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setInitializingIds((prev) => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
    }
  };

  const handleBatchScan = async (targets: ProjectEntry[]) => {
    if (targets.length === 0) return;
    setPostImportScanQueue(null);
    revealProjectProgress(targets[0].id);
    // Preflight: short-circuit the whole batch instead of firing N identical
    // "no provider" errors. Banner + dialog already point users at Keys.
    if (anyProviderKeyPresent === false) {
      setBatchScanning(false);
      setNotice({
        kind: 'warning',
        text: 'AI Scan blocked — no AI provider is configured. Open Keys to save a key, then retry.',
      });
      return;
    }
    setBatchScanning(true);
    const errors: { name: string; message: string }[] = [];
    let succeeded = 0;
    for (const project of targets) {
      revealProjectProgress(project.id);
      setInitializingIds((prev) => new Set(prev).add(project.id));
      try {
        resetInitTrace(project.id);
        appendInitTrace(project.id, {
          id: `${Date.now()}-batch-queued`,
          status: 'running',
          label: 'Queued by batch AI Scan',
          timestamp: new Date().toISOString(),
        });
        const outcome = await runScanForProject(project);
        onUpdateProject(outcome.entry);
        succeeded++;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        errors.push({ name: project.config.project.name, message: formatScanError(raw) });
        if (raw === 'NO_PROVIDER_CONFIGURED') break; // No point hammering the same failure.
      } finally {
        setInitializingIds((prev) => {
          const next = new Set(prev);
          next.delete(project.id);
          return next;
        });
      }
    }
    setBatchScanning(false);
    if (errors.length === 0) {
      setNotice({
        kind: 'success',
        text: `AI Scan complete (${succeeded} project${succeeded === 1 ? '' : 's'}).`,
      });
    } else if (succeeded === 0) {
      setNotice({
        kind: 'error',
        text: `AI Scan failed for all ${errors.length} project${errors.length === 1 ? '' : 's'}.`,
      });
    } else {
      setNotice({
        kind: 'warning',
        text: `AI Scan: ${succeeded} succeeded, ${errors.length} failed (${errors
          .map((e) => e.name)
          .join(', ')}).`,
      });
    }
  };

  const openKeysView = () => router.push('/keys');

  const handleGenerateReport = () => {
    const today = new Date().toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const lines: string[] = [`# Project Manager Weekly Report — ${today}`, ''];

    for (const project of projects) {
      const { features } = project.config;
      const done = features.filter((f) => f.status === 'done');
      const inProgress = features.filter((f) => f.status === 'in_progress');
      const blocked = features.filter((f) => f.status === 'on_hold');
      lines.push(`## ${project.config.project.name}`, '');
      if (done.length) {
        lines.push('### ✅ 完成');
        done.forEach((f) => lines.push(`- [${f.id}] ${f.name}`));
        lines.push('');
      }
      if (inProgress.length) {
        lines.push('### 🔄 進行中');
        inProgress.forEach((f) => lines.push(`- [${f.id}] ${f.name} (${f.progress}%)`));
        lines.push('');
      }
      if (blocked.length) {
        lines.push('### 🚧 阻塞');
        blocked.forEach((f) =>
          lines.push(`- [${f.id}] ${f.name}${f.notes ? ` — ${f.notes}` : ''}`),
        );
        lines.push('');
      }
    }
    lines.push('---', `_Generated by Project Manager v0.1.0 — ${new Date().toISOString()}_`);
    setReportText(lines.join('\n'));
  };

  const handleCopyReport = async () => {
    await navigator.clipboard.writeText(reportText);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  // ── Delete handlers ───────────────────────────────────────────────────────

  const openDeleteConfirm = (project: ProjectEntry) => {
    setDeleteTarget(project);
    setDeleteAlsoFile(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onRemoveProject(deleteTarget.id, deleteAlsoFile);
      setDeleteTarget(null);
      setDeleteAlsoFile(false);
    } finally {
      setDeleting(false);
    }
  };


  const noticeClasses: Record<NonNullable<typeof notice>['kind'], string> = {
    success: 'border-emerald-200/25 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-200/30 bg-amber-500/10 text-amber-100',
    error: 'border-red-400/30 bg-red-500/10 text-red-200',
  };
  const traceStatusClasses: Record<InitTraceStatus, string> = {
    running: 'border-cyan-300/35 bg-cyan-400/15 text-cyan-100',
    success: 'border-emerald-300/35 bg-emerald-400/15 text-emerald-100',
    warning: 'border-amber-300/35 bg-amber-400/15 text-amber-100',
    failed: 'border-red-300/35 bg-red-400/15 text-red-100',
  };

  // Show the preflight banner once we've confirmed the key is missing AND the
  // user has at least one project that would actually need a scan. Avoids
  // nagging users who only track ready / GitHub projects.
  const projectsThatNeedKey = projects.filter(
    (p) => !p.configPath?.startsWith('https://') && projectNeedsScan(p),
  );
  const showKeyPreflight =
    anyProviderKeyPresent === false && projectsThatNeedKey.length > 0;

  return (
    <div className="space-y-6">
      {showKeyPreflight && (
        <div className="flex flex-wrap items-start gap-3 border border-amber-200/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-200" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-50">AI Scan blocked — no AI provider configured</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              {projectsThatNeedKey.length} project
              {projectsThatNeedKey.length === 1 ? ' needs' : 's need'} setup. Save at least one
              API key (Anthropic / OpenAI / Gemini) in Keys, then return here.
            </p>
          </div>
          <button
            type="button"
            onClick={openKeysView}
            className="shrink-0 border border-amber-200/40 bg-amber-500/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-amber-50 hover:bg-amber-500/30"
          >
            Open Keys
          </button>
        </div>
      )}
      {notice && (
        <div
          className={`flex items-start justify-between gap-3 border px-4 py-2 text-sm ${noticeClasses[notice.kind]}`}
        >
          <span className="min-w-0 flex-1 break-words">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {postImportScanQueue && postImportScanQueue.length > 0 && (
        <PostImportScanDialog
          projects={postImportScanQueue}
          scanning={batchScanning}
          keyMissing={anyProviderKeyPresent === false}
          onClose={() => setPostImportScanQueue(null)}
          onOpenKeys={openKeysView}
          onScanProjects={handleBatchScan}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
            Projects
          </h1>
          <p className="mt-1 text-xs text-stone-400">
            {projects.length} project{projects.length !== 1 ? 's' : ''} loaded.
          </p>
          <p className="mt-1 text-xs text-emerald-200/80">
            Dashboard scope: {selectedDashboardProjectIds.length} selected
          </p>
        </div>
        <div className="flex gap-2">
          {!isTauri && onSyncFromDesktop && (
            <button
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                setSyncDone(false);
                await onSyncFromDesktop().catch(() => {});
                setSyncing(false);
                setSyncDone(true);
                setTimeout(() => setSyncDone(false), 2500);
              }}
              className="inline-flex h-9 items-center gap-2 border border-stone-200/20 px-3 text-xs uppercase tracking-[0.14em] text-stone-200 hover:bg-white/5 disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : syncDone ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <RefreshCw size={14} />
              )}
              {syncing ? 'Syncing…' : syncDone ? 'Synced' : 'Sync from Desktop'}
            </button>
          )}
          <button
            onClick={handleGenerateReport}
            className="inline-flex h-9 items-center gap-2 border border-stone-200/20 px-3 text-xs uppercase tracking-[0.14em] text-stone-200 hover:bg-white/5"
          >
            <BarChart3 size={14} />
            Weekly Report
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex h-9 items-center gap-2 bg-stone-100 px-3 text-xs font-medium uppercase tracking-[0.14em] text-[rgb(var(--pm-panel))] hover:bg-amber-100"
          >
            <Plus size={14} />
            Add Project
          </button>
        </div>
      </div>

      {/* Project List */}
      <div className="space-y-3">
        {projects.length === 0 && (
          <div className="border border-dashed border-stone-200/20 bg-[rgb(var(--pm-panel))]/40 px-6 py-10 text-center">
            <p className="text-sm text-stone-300">No projects yet</p>
            <p className="mt-1 text-xs text-stone-500">
              Add a local folder or GitHub repo to start tracking progress.
            </p>
          </div>
        )}
        {projects.map((project) => {
          const { features } = project.config;
          const isSelected = project.id === selectedProjectId;
          const isDashboardSelected = selectedDashboardProjectIds.includes(project.id);
          const isInitializing = initializingIds.has(project.id);
          const initError = initErrors[project.id];
          const initTraceEntries = initTrace[project.id] ?? [];
          const isGithub = project.configPath?.startsWith('https://github.com/') ?? false;
          const setupStatus = getProjectSetupStatus(project);
          const isReady = setupStatus === 'ready';
          const repoUrl = project.config.project.githubUrl?.trim() ?? '';
          const isEditingRepoUrl = repoEditProjectId === project.id;
          const repoUrlBusy = repoUrlBusyId === project.id;
          const repoUrlError = repoUrlErrors[project.id];
          // GitHub repos have their own feature-sync path — the Initialize
          // button doesn't apply to them. Local projects always show the
          // button, but it's disabled in the browser dev shell because
          // writing the config to disk requires the Tauri bridge.
          const showInitialize = !isGithub;

          return (
            <div
              key={project.id}
              ref={(node) => {
                projectRowRefs.current[project.id] = node;
              }}
              className={`group border bg-[rgb(var(--pm-panel))]/72 transition-colors ${
                isSelected
                  ? 'border-emerald-200/35'
                  : 'border-stone-200/18 hover:border-stone-200/30'
              }`}
            >
              <div
                className="flex cursor-pointer flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isDashboardSelected}
                    onChange={(e) => onToggleDashboardProject(project.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-400"
                    title="Include this project in Dashboard"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-stone-100">
                        {project.config.project.name}
                      </span>
                      {isDashboardSelected && (
                        <span className="border border-cyan-200/30 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                          Dashboard
                        </span>
                      )}
                      {setupStatus !== 'ready' && (
                        <span
                          className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                            setupStatus === 'needs_scan'
                              ? 'border-amber-200/35 text-amber-200'
                              : 'border-stone-200/25 text-stone-400'
                          }`}
                        >
                          {setupStatusLabel(setupStatus)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 break-all font-mono text-xs text-stone-500">
                      {project.configPath}
                    </p>
                  </div>
                </div>
                <div className="flex w-full shrink-0 flex-wrap items-center gap-2 text-xs text-stone-400 sm:w-auto sm:justify-end">
                  <span>{features.length} features</span>
                  {/* Two actions only: Initialize/Initialized toggle + Delete. */}
                  <div className="flex flex-wrap items-center gap-1">
                    {showInitialize &&
                      (isReady ? (
                        <>
                          {/* Initialized = healthy state indicator. Keep visible even after adding re-init. */}
                          <span
                            title="Project is initialized — dashboard reads .project-manager/config.json from disk"
                            className="flex h-7 items-center gap-1 border border-emerald-400/50 bg-emerald-600/30 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-100"
                          >
                            <Check size={12} />
                            Initialized
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isTauri) return;
                              if (anyProviderKeyPresent === false) {
                                openKeysView();
                                return;
                              }
                              void handleInitializeOne(project);
                            }}
                            disabled={
                              !isTauri ||
                              isInitializing ||
                              batchScanning ||
                              anyProviderKeyPresent === null
                            }
                            title={
                              !isTauri
                                ? 'Re-initialize requires the Project Manager desktop app.'
                                : anyProviderKeyPresent === false
                                  ? 'No AI provider configured — click to open Keys'
                                  : 'Re-run AI scan and refresh .project-manager/config.json'
                            }
                            className="flex h-7 items-center gap-1 border border-cyan-300/35 bg-cyan-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isInitializing ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Re-initializing…
                              </>
                            ) : (
                              <>
                                <RefreshCw size={12} />
                                Re-init
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        // Initialize = call-to-action, amber to match the
                        // "NEEDS SETUP" chip so the visual link is obvious.
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isTauri) return;
                            if (anyProviderKeyPresent === false) {
                              openKeysView();
                              return;
                            }
                            void handleInitializeOne(project);
                          }}
                          disabled={
                            !isTauri ||
                            isInitializing ||
                            batchScanning ||
                            anyProviderKeyPresent === null
                          }
                          title={
                            !isTauri
                              ? 'Initialize requires the Project Manager desktop app — run ./start_project_manager.sh (without "web") to enable filesystem access.'
                              : anyProviderKeyPresent === false
                                ? 'No AI provider configured — click to open Keys'
                                : 'AI-scan the project structure and write .project-manager/config.json'
                          }
                          className="flex h-7 items-center gap-1 border border-amber-300/40 bg-amber-500/20 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-100 hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isInitializing ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Initializing…
                            </>
                          ) : (
                            <>
                              <Bot size={12} />
                              Initialize
                            </>
                          )}
                        </button>
                      ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteConfirm(project);
                      }}
                      title="Remove project"
                      className="flex h-7 w-7 items-center justify-center text-stone-400 hover:bg-red-500/15 hover:text-red-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
              <div
                className="flex flex-wrap items-center gap-2 border-t border-stone-200/10 bg-black/10 px-4 py-2 text-[11px]"
                onClick={(e) => e.stopPropagation()}
              >
                <Github size={12} className={repoUrl ? 'text-emerald-300' : 'text-amber-300'} />
                <span className="shrink-0 uppercase tracking-[0.12em] text-stone-500">
                  GitHub
                </span>
                {isEditingRepoUrl ? (
                  <>
                    <input
                      value={repoUrlDraft}
                      onChange={(e) => setRepoUrlDraft(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="min-w-[220px] flex-1 border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 font-mono text-[11px] text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/30"
                    />
                    <button
                      type="button"
                      disabled={repoUrlBusy}
                      onClick={() => void saveProjectRepoUrl(project, repoUrlDraft)}
                      className="inline-flex h-7 items-center gap-1 border border-emerald-300/35 bg-emerald-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {repoUrlBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={repoUrlBusy}
                      onClick={() => {
                        setRepoEditProjectId(null);
                        setRepoUrlDraft('');
                      }}
                      className="inline-flex h-7 items-center gap-1 border border-stone-200/20 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={`min-w-0 flex-1 break-all font-mono ${
                        repoUrl ? 'text-stone-300' : 'text-amber-200'
                      }`}
                    >
                      {repoUrl || 'No GitHub repository URL configured'}
                    </span>
                    {!repoUrl && isTauri && !project.config.project.root.startsWith('https://') && (
                      <button
                        type="button"
                        disabled={repoUrlBusy}
                        onClick={() => void detectAndSaveProjectRepoUrl(project)}
                        className="inline-flex h-7 items-center gap-1 border border-cyan-300/35 bg-cyan-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {repoUrlBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Detect
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={repoUrlBusy}
                      onClick={() => beginRepoUrlEdit(project)}
                      className="inline-flex h-7 items-center gap-1 border border-stone-200/20 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {repoUrl ? 'Edit URL' : 'Add URL'}
                    </button>
                  </>
                )}
                {repoUrlError && (
                  <span className="basis-full text-[11px] text-red-200">
                    GitHub URL error: {repoUrlError}
                  </span>
                )}
              </div>
              {initTraceEntries.length > 0 && (
                <div
                  className="border-t border-stone-200/10 bg-black/15 px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isInitializing ? (
                        <Loader2 size={13} className="animate-spin text-cyan-200" />
                      ) : initError ? (
                        <AlertTriangle size={13} className="text-red-200" />
                      ) : (
                        <Check size={13} className="text-emerald-200" />
                      )}
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-300">
                        Initialization Trace
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      {initTraceEntries.length} events
                    </span>
                  </div>
                  <ol className="max-h-56 space-y-1 overflow-auto">
                    {initTraceEntries.slice(-12).map((entry) => (
                      <li
                        key={entry.id}
                        className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-[11px] leading-5"
                      >
                        <span
                          className={`inline-flex h-5 items-center justify-center border px-1.5 text-[9px] font-medium uppercase tracking-[0.08em] ${
                            traceStatusClasses[entry.status]
                          }`}
                        >
                          {entry.status}
                        </span>
                        <span className="min-w-0 text-stone-300">
                          <span>{entry.label}</span>
                          {(entry.provider || entry.modelId) && (
                            <span className="ml-2 font-mono text-stone-500">
                              {entry.provider
                                ? formatProviderAttempt({
                                    provider: entry.provider,
                                    modelId: entry.modelId,
                                  })
                                : entry.modelId}
                            </span>
                          )}
                          {entry.detail && (
                            <span className="block break-words text-[10px] text-stone-500">
                              {entry.detail}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {initError && (
                <div className="flex flex-wrap items-start gap-2 border-t border-violet-500/25 bg-violet-900/15 px-4 py-2 text-[11px] text-violet-200">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">
                    Initialize failed: {formatScanError(initError)}
                  </span>
                  {initError === 'NO_PROVIDER_CONFIGURED' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openKeysView();
                      }}
                      className="shrink-0 border border-amber-200/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-50 hover:bg-amber-500/30"
                    >
                      Open Keys
                    </button>
                  ) : (
                    showInitialize &&
                    isTauri && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleInitializeOne(project);
                        }}
                        disabled={isInitializing || anyProviderKeyPresent === false}
                        className="shrink-0 border border-violet-200/35 bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-violet-100 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )
                  )}
                  <button
                    onClick={() =>
                      setInitErrors((prev) => {
                        const next = { ...prev };
                        delete next[project.id];
                        return next;
                      })
                    }
                    className="shrink-0 text-violet-300 hover:text-violet-100"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Weekly Report */}
      {reportText && (
        <div className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
          <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
              Weekly Report
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopyReport}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  reportCopied ? 'text-emerald-300' : 'text-stone-300 hover:text-stone-100'
                }`}
              >
                {reportCopied ? '✓ Copied' : 'Copy Markdown'}
              </button>
              <button
                onClick={() => setReportText('')}
                className="text-stone-400 hover:text-stone-100"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-stone-300">
            {reportText}
          </pre>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border border-red-400/30 bg-[rgb(var(--pm-panel))] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-stone-200/12 bg-red-500/10 px-6 py-4">
              <AlertTriangle size={18} className="text-red-300" />
              <h3 className="text-base font-semibold text-stone-50">Remove project?</h3>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <p className="text-sm text-stone-200">
                  Remove <span className="font-medium text-stone-50">{deleteTarget.config.project.name}</span> from Project Manager?
                </p>
                <p className="mt-1 truncate font-mono text-[11px] text-stone-500">
                  {deleteTarget.configPath}
                </p>
              </div>
              <p className="text-xs text-stone-400">
                By default, this only removes the project from PM&apos;s tracked list. The{' '}
                <code className="font-mono text-stone-300">.project-manager/config.json</code> on disk is left untouched.
              </p>

              {/* Disk-delete opt-in (disabled for GitHub-sourced projects) */}
              {(() => {
                const isGithubTarget = deleteTarget.configPath?.startsWith('https://') ?? false;
                return (
                  <label
                    className={`flex items-start gap-2 border border-stone-200/12 px-3 py-2 text-xs ${
                      isGithubTarget ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={deleteAlsoFile}
                      onChange={(e) => setDeleteAlsoFile(e.target.checked)}
                      disabled={isGithubTarget}
                      className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-red-400 disabled:cursor-not-allowed"
                    />
                    <span className="text-stone-200">
                      Also delete the <code className="font-mono">.project-manager/config.json</code> file on disk
                      {isGithubTarget && (
                        <span className="ml-1 text-stone-500">(N/A for GitHub-sourced projects)</span>
                      )}
                    </span>
                  </label>
                );
              })()}
            </div>
            <div className="flex justify-end gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-stone-300 hover:bg-white/5 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Removing…
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    {deleteAlsoFile ? 'Remove & Delete File' : 'Remove from PM'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
              <h3 className="text-lg font-bold text-stone-50">
                Add Project
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-2xl leading-none text-stone-400 hover:text-stone-100"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 p-6">
              {/* Mode tabs */}
              <div className="flex border border-stone-200/18">
                {(
                  [
                    { id: 'local', label: 'Local Path', icon: FolderOpen },
                    { id: 'github', label: 'GitHub URL', icon: Github },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setAddMode(id)}
                    className={`flex flex-1 items-center justify-center gap-2 py-2 text-xs uppercase tracking-[0.14em] transition-colors ${
                      addMode === id
                        ? 'bg-stone-100 text-[rgb(var(--pm-panel))]'
                        : 'text-stone-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>

              {addMode === 'local' ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => void handlePickFolders('import')}
                        disabled={pickingFolders || adding}
                        title={
                          isTauri
                            ? 'Open Finder — select one or more folders (⌘-click for multiple)'
                            : 'Native Finder picker is desktop-only (browsers cannot expose absolute paths). Paste the folder path below instead.'
                        }
                        className="flex w-full items-center justify-center gap-2 border border-cyan-200/30 bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {pickingFolders ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            Opening folder picker…
                          </>
                        ) : (
                          <>
                            <FolderOpen size={15} />
                            Choose from Finder…
                          </>
                        )}
                      </button>
                      <p className="text-[10px] leading-relaxed text-stone-500">
                        Import one or more project folders at once. Folders without{' '}
                        <code className="font-mono text-stone-400">.project-manager/</code> are
                        still added — click <span className="text-stone-300">Initialize</span> on
                        the row afterwards to AI-scan and generate the dashboard config.
                      </p>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="h-px flex-1 bg-stone-200/12" />
                        <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                          or paste a path
                        </span>
                        <div className="h-px flex-1 bg-stone-200/12" />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-stone-400">
                          Project folder path
                        </label>
                        <div className="flex gap-2">
                          <input
                            value={manualConfigPath}
                            onChange={(e) => setManualConfigPath(e.target.value)}
                            placeholder="/path/to/project (auto-detects .project-manager/)"
                            className="min-w-0 flex-1 border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                          />
                          <button
                            type="button"
                            onClick={() => void handlePickFolders('manual')}
                            disabled={pickingFolders || !isTauri}
                            title={
                              isTauri
                                ? 'Choose a folder in Finder'
                                : 'Native Finder picker is desktop-only — paste the path into the field instead.'
                            }
                            className="inline-flex shrink-0 items-center gap-1.5 border border-stone-200/20 px-3 py-2 text-xs uppercase tracking-[0.12em] text-stone-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FolderOpen size={13} />
                            Browse
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] text-stone-500">
                          Folder paths are accepted — .project-manager/config.json is resolved automatically.
                        </p>
                      </div>

                      {!isTauri && (
                        <p className="text-[11px] text-amber-100/60">
                          Dev mode: paste an absolute folder path above to import — the Next.js
                          server reads the disk for you. The native Finder picker is desktop-only
                          (browsers can&apos;t expose absolute paths); launch{' '}
                          <code className="font-mono">./start_project_manager.sh</code> for the
                          one-click picker.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-stone-200">
                          GitHub Repository URL
                        </label>
                        <input
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          placeholder="https://github.com/user/my-app"
                          className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-stone-200">
                          GitHub Token
                        </label>
                        <input
                          type="password"
                          value={githubToken}
                          onChange={(e) => {
                            const value = e.target.value;
                            setGithubToken(value);
                            // Persist via the bridge so it lands in OS Keychain
                            // under Tauri (and localStorage in dev fallback).
                            void import('../../../lib/bridge').then(({ setGithubToken: persist }) =>
                              persist(value).catch(() => {}),
                            );
                          }}
                          placeholder="ghp_..."
                          className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                        />
                      </div>
                      <p className="text-[11px] text-amber-100/60">
                        GitHub import requires Tauri bridge + GitHub GraphQL API. PR/issue analysis and
                        smart alerts will be enabled when connected.
                      </p>
                    </div>
                  )}

              {addError && <p className="text-sm text-red-400">{addError}</p>}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={addMode === 'local' ? handleAddLocal : handleAddGitHub}
                disabled={
                  adding ||
                  (addMode === 'local'
                    ? !manualConfigPath.trim()
                    : !githubUrl.trim() || !isTauri)
                }
                className="bg-stone-100 px-4 py-2 text-sm font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {adding
                  ? 'Importing…'
                  : addMode === 'github'
                    ? isTauri
                      ? 'Import from GitHub'
                      : 'Requires Tauri'
                    : 'Add Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
