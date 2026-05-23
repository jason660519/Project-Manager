'use client';

import { useEffect, useState } from 'react';
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
import { runProjectScan } from '../../../lib/scanner/runProjectScan';
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
  const [postImportScanQueue, setPostImportScanQueue] = useState<ProjectEntry[] | null>(null);
  const [batchScanning, setBatchScanning] = useState(false);
  // Per-row Initialize state. One project at a time can be busy initializing;
  // any failures land in initErrors keyed by project id and surface below the row.
  const [initializingIds, setInitializingIds] = useState<Set<string>>(new Set());
  const [initErrors, setInitErrors] = useState<Record<string, string>>({});
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
      const ghFeatures = await fetchGithubRepo(githubToken, githubUrl);

      const repoName = githubUrl.trim().replace(/\/$/, '').split('/').slice(-2).join('/');
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
        project: { name: repoName, root: githubUrl.trim(), defaultIDE: 'Cursor' },
        features,
        adapters: { ides: [], agents: [] },
      });

      onAddProject({ id: `gh-${Date.now()}`, config, configPath: githubUrl.trim() });
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
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setPickingFolders(false);
      setAdding(false);
    }
  };

  // ── AI Scan handlers ──────────────────────────────────────────────────────

  const formatScanError = (raw: string): string =>
    raw === 'NO_PROVIDER_CONFIGURED'
      ? 'No AI provider is configured. Open Keys to save at least one API key, then enable it in Settings.'
      : raw;

  /**
   * Result of one full Initialize run — used by the row to display the
   * fallback notice ("Initialized via OpenAI — Anthropic failed: …").
   */
  interface InitializeOutcome {
    entry: ProjectEntry;
    providerUsed?: LlmProviderId;
    fallbacks: { provider: LlmProviderId; error: string }[];
  }

  const runScanForProject = async (project: ProjectEntry): Promise<InitializeOutcome> => {
    const root = project.config.project.root;
    if (!root?.trim()) throw new Error('Project root is missing');
    const result = await runProjectScan(root);
    if (!result.success || !result.config) {
      const err = result.error || 'AI Scan failed';
      if (err === 'NO_PROVIDER_CONFIGURED') {
        // Surface the key state to the rest of the view so the banner appears
        // even when the user never explicitly visited Keys.
        setAnyProviderKeyPresent(false);
      }
      throw new Error(err);
    }
    const entry = await applyScanConfigToProject(project, result.config);
    const fallbacks =
      result.attempts
        ?.filter((a) => a.outcome !== 'success' && a.error)
        .map((a) => ({ provider: a.provider, error: a.error! })) ?? [];
    return { entry, providerUsed: result.providerUsed, fallbacks };
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
      if (outcome.fallbacks.length > 0 && outcome.providerUsed) {
        // Tell the user the chain actually saved them — e.g. Anthropic
        // rate-limited but OpenAI succeeded.
        setNotice({
          kind: 'warning',
          text: `${project.config.project.name}: initialized via ${outcome.providerUsed} after ${outcome.fallbacks
            .map((f) => f.provider)
            .join(', ')} failed.`,
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
    // Preflight: short-circuit the whole batch instead of firing N identical
    // "no provider" errors. Banner + dialog already point users at Keys.
    if (anyProviderKeyPresent === false) {
      setBatchScanning(false);
      setPostImportScanQueue(null);
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
      try {
        const outcome = await runScanForProject(project);
        onUpdateProject(outcome.entry);
        succeeded++;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        errors.push({ name: project.config.project.name, message: formatScanError(raw) });
        if (raw === 'NO_PROVIDER_CONFIGURED') break; // No point hammering the same failure.
      }
    }
    setBatchScanning(false);
    setPostImportScanQueue(null);
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
          const isGithub = project.configPath?.startsWith('https://github.com/') ?? false;
          const setupStatus = getProjectSetupStatus(project);
          const isReady = setupStatus === 'ready';
          // GitHub repos have their own feature-sync path — the Initialize
          // button doesn't apply to them. Local projects always show the
          // button, but it's disabled in the browser dev shell because
          // writing the config to disk requires the Tauri bridge.
          const showInitialize = !isGithub;

          return (
            <div
              key={project.id}
              className={`group border bg-[rgb(var(--pm-panel))]/72 transition-colors ${
                isSelected
                  ? 'border-emerald-200/35'
                  : 'border-stone-200/18 hover:border-stone-200/30'
              }`}
            >
              <div
                className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3"
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
                    <div className="flex items-center gap-2">
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
                <div className="flex shrink-0 items-center gap-3 text-xs text-stone-400">
                  <span>{features.length} features</span>
                  {/* Two actions only: Initialize/Initialized toggle + Delete. */}
                  <div className="flex items-center gap-1">
                    {showInitialize &&
                      (isReady ? (
                        // Initialized = passive success state, solid emerald
                        // (matches the project-state semantics: "done, healthy").
                        <span
                          title="Project is initialized — dashboard reads .project-manager/config.json from disk"
                          className="flex h-7 items-center gap-1 border border-emerald-400/50 bg-emerald-600/30 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-100"
                        >
                          <Check size={12} />
                          Initialized
                        </span>
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
