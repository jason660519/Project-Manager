'use client';

// @table-classification: basic
// @table-reason: Operational projects dashboard table (many columns, horizontal overflow,
//   repeated use). Has search, status/category filters, numeric freeze, resize+persist, hidden
//   cols, sort.
// @table-waivers: shared-primitive — uses a bespoke localStorage prefs layer
//   (readProjectsTablePrefs) predating components/table/datasheet; migration tracked as follow-up.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Check,
  EyeOff,
  FolderOpen,
  Github,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Snowflake,
  Trash2,
  X,
} from 'lucide-react';
import { hasProviderKey } from '../../../lib/keys/loadProviderKey';
import { useInAppPrompt } from '../../../components/ui/InAppDialog';
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
  buildProjectScaffold,
  buildProjectEntryFromPath,
  migrateConfig,
  resolveConfigPath,
  type InitializeMode,
} from '../../../lib/storage';
import { COL_ID_COLUMN_HEADER } from '../../../components/table/colId';
import { BUILT_IN_PROGRESS_TEMPLATES } from '../../../lib/progress-sheets/templates';
import { CompletedRun, ProjectManagerConfig, Feature, ProjectEntry } from '../../../lib/types';
import { PostImportScanDialog } from './_components/PostImportScanDialog';
import { ProgressSheetTemplatePicker } from './_components/ProgressSheetTemplatePicker';

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
  onInitializeProject?: (
    id: string,
    mode: InitializeMode,
    progressSheetTemplateIds: string[],
  ) => Promise<void> | void;
  runHistory: CompletedRun[];
}

const PROJECTS_TABLE_PREFS_KEY = 'projectManager.progressDashboard.projectsTable.v2';
const DEFAULT_PROGRESS_TEMPLATE_IDS = ['software-desktop-app'] as const;

interface ProjectsTablePrefs {
  columnSizing?: ColumnSizingState;
  columnVisibility?: VisibilityState;
  freezeCols?: number;
  rowHeight?: number;
  hiddenRowIds?: string[];
}

function readProjectsTablePrefs(): ProjectsTablePrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROJECTS_TABLE_PREFS_KEY);
    return raw ? (JSON.parse(raw) as ProjectsTablePrefs) : {};
  } catch {
    return {};
  }
}

function writeProjectsTablePrefs(prefs: ProjectsTablePrefs): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROJECTS_TABLE_PREFS_KEY, JSON.stringify(prefs));
    }
  } catch {
    /* preference save is non-blocking */
  }
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
  onInitializeProject,
  runHistory,
}: ProjectsViewProps) {
  const resizePrompt = useInAppPrompt();
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
  const repoUrlDraftRef = useRef('');
  const [repoUrlBusyId, setRepoUrlBusyId] = useState<string | null>(null);
  const [repoUrlErrors, setRepoUrlErrors] = useState<Record<string, string>>({});
  const [postImportScanQueue, setPostImportScanQueue] = useState<ProjectEntry[] | null>(null);
  const [batchScanning, setBatchScanning] = useState(false);
  // Per-row Initialize state. One project at a time can be busy initializing;
  // any failures land in initErrors keyed by project id and surface below the row.
  const [initializingIds, setInitializingIds] = useState<Set<string>>(new Set());
  const [initErrors, setInitErrors] = useState<Record<string, string>>({});
  const [initTrace, setInitTrace] = useState<Record<string, InitTraceEntry[]>>({});
  const [templateSelections, setTemplateSelections] = useState<Record<string, string[]>>({});
  const [templateSelectionErrors, setTemplateSelectionErrors] = useState<Record<string, string>>({});
  const [scaffoldInitializingIds, setScaffoldInitializingIds] = useState<Set<string>>(new Set());
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
  const anyProviderKeyPresentRef = useRef<boolean | null>(null);
  const projectRowRefs = useRef<Record<string, HTMLElement | null>>({});
  const router = useRouter();

  useEffect(() => {
    anyProviderKeyPresentRef.current = anyProviderKeyPresent;
  }, [anyProviderKeyPresent]);

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
    repoUrlDraftRef.current = project.config.project.githubUrl ?? '';
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

  const getSelectedTemplateIds = (project: ProjectEntry): string[] =>
    templateSelections[project.id] ??
    project.config.progressSheets?.map((sheet) => sheet.templateId) ??
    [...DEFAULT_PROGRESS_TEMPLATE_IDS];

  const validateSelectedTemplateIds = (project: ProjectEntry): string[] | null => {
    const selected = getSelectedTemplateIds(project);
    if (selected.length > 0) {
      setTemplateSelectionErrors((prev) => {
        if (!(project.id in prev)) return prev;
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      return selected;
    }
    setTemplateSelectionErrors((prev) => ({
      ...prev,
      [project.id]: 'Select at least one progress sheet before initializing.',
    }));
    return null;
  };

  const setTemplateSelection = (project: ProjectEntry, nextIds: string[]) => {
    setTemplateSelections((prev) => ({ ...prev, [project.id]: nextIds }));
    setTemplateSelectionErrors((prev) => {
      if (!(project.id in prev)) return prev;
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
  };

  const toggleTemplateSelection = (project: ProjectEntry, templateId: string) => {
    const current = templateSelections[project.id] ?? getSelectedTemplateIds(project);
    const next = current.includes(templateId)
      ? current.filter((id) => id !== templateId)
      : [...current, templateId];
    setTemplateSelection(project, next);
  };

  const selectAllTemplateSelections = (project: ProjectEntry) => {
    const current = templateSelections[project.id] ?? getSelectedTemplateIds(project);
    const allIds = BUILT_IN_PROGRESS_TEMPLATES.map((template) => template.id);
    const next = current.length === allIds.length ? [] : allIds;
    setTemplateSelection(project, next);
  };

  const clearTemplateSelection = (project: ProjectEntry) => {
    setTemplateSelection(project, []);
  };

  const runScanForProject = async (
    project: ProjectEntry,
    progressSheetTemplateIds: string[],
  ): Promise<InitializeOutcome> => {
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
    const scaffoldSheets = buildProjectScaffold(root, {
      projectName: project.config.project.name,
      progressSheetTemplateIds,
    }).progressSheets;
    const scannedWithSheets: ProjectManagerConfig = {
      ...result.config,
      progressSheets: scaffoldSheets,
    };
    const entry = await applyScanConfigToProject(project, scannedWithSheets, {
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
    const progressSheetTemplateIds = validateSelectedTemplateIds(project);
    if (!progressSheetTemplateIds) return;
    if (anyProviderKeyPresentRef.current === false) {
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
      const outcome = await runScanForProject(project, progressSheetTemplateIds);
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

  const handleScaffoldInitialize = async (project: ProjectEntry, mode: InitializeMode) => {
    if (!onInitializeProject) return;
    const progressSheetTemplateIds = validateSelectedTemplateIds(project);
    if (!progressSheetTemplateIds) return;
    setScaffoldInitializingIds((prev) => new Set(prev).add(project.id));
    setInitErrors((prev) => {
      if (!(project.id in prev)) return prev;
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
    try {
      await onInitializeProject(project.id, mode, progressSheetTemplateIds);
      setNotice({
        kind: 'success',
        text: `${project.config.project.name}: ${mode} scaffold initialized with ${progressSheetTemplateIds.length} progress sheet${progressSheetTemplateIds.length === 1 ? '' : 's'}.`,
      });
    } catch (e) {
      setInitErrors((prev) => ({
        ...prev,
        [project.id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setScaffoldInitializingIds((prev) => {
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
        const outcome = await runScanForProject(project, getSelectedTemplateIds(project));
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

  const [sorting, setSorting] = useState<SortingState>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | 'ready' | 'needs_scan' | 'scaffold'>('all');
  const [showProjectHiddenRows, setShowProjectHiddenRows] = useState(false);
  const [showProjectHiddenCols, setShowProjectHiddenCols] = useState(false);
  const [showProjectHiddenRowsMenu, setShowProjectHiddenRowsMenu] = useState(false);
  const [projectsTablePrefs, setProjectsTablePrefs] = useState<ProjectsTablePrefs>(() => ({
    freezeCols: 0,
    rowHeight: 52,
  }));
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const columnHelper = useMemo(() => createColumnHelper<ProjectEntry>(), []);

  useEffect(() => {
    const stored = readProjectsTablePrefs();
    setProjectsTablePrefs({
      freezeCols: Math.max(0, Math.min(5, stored.freezeCols ?? 0)),
      rowHeight: Math.max(36, Math.min(160, stored.rowHeight ?? 52)),
      hiddenRowIds: Array.isArray(stored.hiddenRowIds) ? stored.hiddenRowIds : [],
    });
    setColumnSizing(stored.columnSizing ?? {});
    setColumnVisibility(stored.columnVisibility ?? {});
  }, []);

  useEffect(() => {
    writeProjectsTablePrefs({
      columnSizing,
      columnVisibility,
      freezeCols: projectsTablePrefs.freezeCols,
      rowHeight: projectsTablePrefs.rowHeight,
      hiddenRowIds: projectsTablePrefs.hiddenRowIds,
    });
  }, [columnSizing, columnVisibility, projectsTablePrefs.freezeCols, projectsTablePrefs.hiddenRowIds, projectsTablePrefs.rowHeight]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'col-include-dashboard',
        header: 'Include',
        size: 96,
        enableSorting: false,
        cell: ({ row }) => {
          const project = row.original;
          const checked = selectedDashboardProjectIds.includes(project.id);
          return (
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggleDashboardProject(project.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 cursor-pointer accent-emerald-400"
                title="Include this project in Dashboard"
                aria-label={`Include ${project.config.project.name} in Dashboard`}
              />
            </div>
          );
        },
      }),
      columnHelper.accessor((project) => project.id, {
        id: 'col-id',
        header: COL_ID_COLUMN_HEADER,
        size: 140,
        cell: ({ getValue }) => (
          <span className="block max-w-[160px] truncate font-mono text-[11px] text-stone-300" title={getValue()}>
            {getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((project) => project.config.project.name, {
        id: 'col-project-name',
        header: 'Project',
        size: 240,
        cell: ({ row, getValue }) => {
          const project = row.original;
          const setupStatus = getProjectSetupStatus(project);
          const isDashboardSelected = selectedDashboardProjectIds.includes(project.id);
          return (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-stone-100">{getValue()}</span>
                {isDashboardSelected && (
                  <span className="border border-cyan-200/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-200">
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
              <p className="mt-1 truncate font-mono text-[11px] text-stone-500" title={project.configPath}>
                {project.configPath}
              </p>
            </div>
          );
        },
      }),
      columnHelper.accessor((project) => project.config.project.root, {
        id: 'col-local-path',
        header: 'Local Path',
        size: 280,
        cell: ({ row, getValue }) => {
          const isGithub = row.original.configPath?.startsWith('https://github.com/') ?? false;
          const value = isGithub ? '' : getValue();
          return value ? (
            <span className="block max-w-[360px] truncate font-mono text-xs text-stone-300" title={value}>
              {value}
            </span>
          ) : (
            <span className="text-xs text-stone-500">-</span>
          );
        },
      }),
      columnHelper.display({
        id: 'col-github-url',
        header: 'GitHub Repo URL',
        size: 320,
        cell: ({ row }) => {
          const project = row.original;
          const repoUrl = project.config.project.githubUrl?.trim() ?? '';
          const isEditing = repoEditProjectId === project.id;
          const repoUrlBusy = repoUrlBusyId === project.id;
          const canDetect = isTauri && !project.config.project.root.startsWith('https://');

          if (isEditing) {
            return (
              <div className="flex min-w-[280px] flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  defaultValue={repoUrlDraft}
                  onChange={(e) => {
                    repoUrlDraftRef.current = e.target.value;
                    setRepoUrlDraft(e.target.value);
                  }}
                  placeholder="https://github.com/owner/repo"
                  className="min-w-[220px] flex-1 border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 font-mono text-[11px] text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
                <button
                  type="button"
                  disabled={repoUrlBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void saveProjectRepoUrl(project, repoUrlDraftRef.current);
                  }}
                  className="inline-flex h-7 items-center gap-1 border border-emerald-300/35 bg-emerald-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {repoUrlBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
                <button
                  type="button"
                  disabled={repoUrlBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRepoEditProjectId(null);
                    setRepoUrlDraft('');
                    repoUrlDraftRef.current = '';
                  }}
                  className="inline-flex h-7 items-center gap-1 border border-stone-200/20 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={12} />
                  Cancel
                </button>
              </div>
            );
          }

          return (
            <div className="flex min-w-[260px] items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Github size={12} className={repoUrl ? 'shrink-0 text-emerald-300' : 'shrink-0 text-amber-300'} />
              <span
                className={`min-w-0 flex-1 truncate font-mono text-xs ${
                  repoUrl ? 'text-stone-300' : 'text-amber-200'
                }`}
                title={repoUrl || 'No GitHub repository URL configured'}
              >
                {repoUrl || 'No GitHub URL'}
              </span>
              {!repoUrl && canDetect && (
                <button
                  type="button"
                  disabled={repoUrlBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void detectAndSaveProjectRepoUrl(project);
                  }}
                  className="inline-flex h-7 items-center gap-1 border border-cyan-300/35 bg-cyan-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {repoUrlBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Detect
                </button>
              )}
              <button
                type="button"
                disabled={repoUrlBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  beginRepoUrlEdit(project);
                }}
                className="inline-flex h-7 items-center gap-1 border border-stone-200/20 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {repoUrl ? 'Edit URL' : 'Add URL'}
              </button>
            </div>
          );
        },
      }),
      columnHelper.accessor((project) => project.config.features.length, {
        id: 'col-feature-count',
        header: 'Features',
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-stone-200">{getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'col-progress-templates',
        header: 'Progress Sheets',
        size: 280,
        enableSorting: false,
        cell: ({ row }) => {
          const project = row.original;
          const selectedTemplateIds = getSelectedTemplateIds(project);
          const selectedTemplates = BUILT_IN_PROGRESS_TEMPLATES.filter((template) =>
            selectedTemplateIds.includes(template.id),
          );
          const templateError = templateSelectionErrors[project.id];
          const isScaffoldInitializing = scaffoldInitializingIds.has(project.id);
          return (
            <div className="min-w-[240px] space-y-2" onClick={(e) => e.stopPropagation()}>
              <ProgressSheetTemplatePicker
                templates={BUILT_IN_PROGRESS_TEMPLATES}
                selectedIds={selectedTemplateIds}
                onToggle={(templateId) => toggleTemplateSelection(project, templateId)}
                onSelectAll={() => selectAllTemplateSelections(project)}
                onClear={() => clearTemplateSelection(project)}
                disabled={isScaffoldInitializing}
              />
              <div className="flex flex-wrap items-center gap-1">
                {selectedTemplates.length === 0 ? (
                  <span className="text-[10px] text-amber-200">
                    No sheets selected.
                  </span>
                ) : (
                  selectedTemplates.map((template) => (
                    <span
                      key={template.id}
                      title={template.fields.map((field) => field.label).join(', ')}
                      className="border border-blue-200/25 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-100"
                    >
                      {template.sheetTitle} · {template.fields.slice(0, 3).map((field) => field.label).join(', ')}
                      {template.fields.length > 3 ? ` +${template.fields.length - 3}` : ''}
                      {' · '}
                      {template.statusOptions.length} statuses
                    </span>
                  ))
                )}
              </div>
              {templateError && (
                <div className="flex items-center gap-1 text-[10px] text-amber-100">
                  <AlertTriangle size={11} />
                  {templateError}
                </div>
              )}
              {onInitializeProject && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {(['create', 'merge', 'overwrite'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={isScaffoldInitializing || !isTauri}
                      onClick={() => void handleScaffoldInitialize(project, mode)}
                      title={
                        mode === 'overwrite'
                          ? 'Overwrite replaces existing scaffold data through the Tauri initializer.'
                          : `${mode[0].toUpperCase()}${mode.slice(1)} uses existing scaffold merge behavior.`
                      }
                      className={`inline-flex h-6 items-center gap-1 border px-2 text-[10px] font-medium uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40 ${
                        mode === 'overwrite'
                          ? 'border-red-300/30 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                          : mode === 'merge'
                            ? 'border-blue-300/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20'
                            : 'border-stone-200/20 bg-white/[0.035] text-stone-200 hover:bg-white/[0.07]'
                      }`}
                    >
                      {isScaffoldInitializing ? <Loader2 size={11} className="animate-spin" /> : null}
                      {mode === 'create'
                        ? 'Create scaffold'
                        : mode === 'merge'
                          ? 'Merge scaffold'
                          : 'Overwrite scaffold'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'col-initialized',
        header: 'Init Status',
        size: 132,
        cell: ({ row }) => {
          const project = row.original;
          const isGithub = project.configPath?.startsWith('https://github.com/') ?? false;
          const isReady = getProjectSetupStatus(project) === 'ready';
          if (isReady) {
            return (
              <span
                title="Project is initialized; dashboard reads .project-manager/config.json from disk"
                className="inline-flex h-7 items-center gap-1 border border-emerald-400/50 bg-emerald-600/30 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-100"
              >
                <Check size={12} />
                Initialized
              </span>
            );
          }
          return (
            <span className="inline-flex h-7 items-center border border-amber-300/35 bg-amber-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-100">
              {isGithub ? 'Imported' : 'No'}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'col-reinit',
        header: 'Re-init',
        size: 140,
        cell: ({ row }) => {
          const project = row.original;
          const isGithub = project.configPath?.startsWith('https://github.com/') ?? false;
          const isReady = getProjectSetupStatus(project) === 'ready';
          const isInitializing = initializingIds.has(project.id);
          const disabled =
            isGithub ||
            !isTauri ||
            isInitializing ||
            batchScanning;
          const label = isReady ? 'Re-init' : 'Initialize';
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isGithub) return;
                if (!isTauri) return;
                void handleInitializeOne(project);
              }}
              disabled={disabled}
              title={
                isGithub
                  ? 'GitHub-imported projects use the GitHub sync path.'
                  : !isTauri
                    ? 'Initialize requires the Project Manager desktop app.'
                    : 'Run AI scan and refresh .project-manager/config.json'
              }
              className={`inline-flex h-7 items-center gap-1 border px-2 text-[10px] font-medium uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40 ${
                isReady
                  ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/30'
                  : 'border-amber-300/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/35'
              }`}
            >
              {isInitializing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Running
                </>
              ) : isReady ? (
                <>
                  <RefreshCw size={12} />
                  {label}
                </>
              ) : (
                <>
                  <Bot size={12} />
                  {label}
                </>
              )}
            </button>
          );
        },
      }),
      columnHelper.display({
        id: 'col-delete',
        header: 'Delete',
        size: 104,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openDeleteConfirm(row.original);
            }}
            title="Remove project"
            className="inline-flex h-7 items-center gap-1 border border-red-300/25 bg-red-500/10 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-red-200 hover:bg-red-500/20"
          >
            <Trash2 size={12} />
            Delete
          </button>
        ),
      }),
    ],
    [
      batchScanning,
      columnHelper,
      initializingIds,
      isTauri,
      onToggleDashboardProject,
      scaffoldInitializingIds,
      templateSelectionErrors,
      templateSelections,
      repoEditProjectId,
      repoUrlBusyId,
      selectedDashboardProjectIds,
    ],
  );

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    const hidden = new Set(projectsTablePrefs.hiddenRowIds ?? []);
    return projects.filter((project) => {
      if (!showProjectHiddenRows && hidden.has(project.id)) return false;
      const setupStatus = getProjectSetupStatus(project);
      if (projectStatusFilter !== 'all' && setupStatus !== projectStatusFilter) return false;
      if (!q) return true;
      const hay = [
        project.id,
        project.config.project.name,
        project.config.project.root,
        project.config.project.githubUrl ?? '',
        project.configPath,
        setupStatusLabel(setupStatus),
        String(project.config.features.length),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [projectSearch, projectStatusFilter, projects, projectsTablePrefs.hiddenRowIds, showProjectHiddenRows]);

  const hiddenProjectRows = useMemo(() => {
    const hidden = new Set(projectsTablePrefs.hiddenRowIds ?? []);
    return projects
      .filter((project) => hidden.has(project.id))
      .map((project) => ({ id: project.id, label: `${project.id} · ${project.config.project.name}` }));
  }, [projects, projectsTablePrefs.hiddenRowIds]);

  const table = useReactTable({
    data: filteredProjects,
    columns,
    state: { sorting, columnSizing, columnVisibility },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    enableSortingRemoval: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleProjectColumns = table.getVisibleLeafColumns();
  const projectLeftOffsets = useMemo(() => {
    let acc = 0;
    return visibleProjectColumns.map((column) => {
      const left = acc;
      acc += column.getSize();
      return left;
    });
  }, [visibleProjectColumns]);
  const frozenProjectCols = Math.max(0, Math.min(visibleProjectColumns.length, projectsTablePrefs.freezeCols ?? 0));
  const resetProjectsTableView = () => {
    setProjectSearch('');
    setProjectStatusFilter('all');
    setSorting([]);
    setColumnSizing({});
    setColumnVisibility({});
    setProjectsTablePrefs({ freezeCols: 0, rowHeight: 52, hiddenRowIds: [] });
    try {
      window.localStorage.removeItem(PROJECTS_TABLE_PREFS_KEY);
    } catch {
      /* noop */
    }
  };

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap gap-2 sm:justify-end">
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

      <div className="flex flex-wrap items-center gap-2 border border-stone-200/12 bg-[rgb(var(--pm-card))]/50 px-3 py-2">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Search projects..."
            className="h-8 w-full border border-stone-200/15 bg-[rgb(var(--pm-rail))]/80 pl-8 pr-3 text-xs text-stone-100 placeholder:text-stone-500 outline-none focus:border-emerald-300/40"
          />
        </div>
        <select
          aria-label="Init Status filter"
          value={projectStatusFilter}
          onChange={(e) => setProjectStatusFilter(e.target.value as typeof projectStatusFilter)}
          className="h-8 border border-stone-200/15 bg-[rgb(var(--pm-rail))]/80 px-2 text-xs text-stone-100 outline-none"
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="needs_scan">Needs scan</option>
          <option value="scaffold">Scaffold</option>
        </select>
        <div className="flex items-center gap-1 border-l border-stone-200/15 pl-2">
          <Snowflake size={12} className="text-cyan-300" />
          <label className="text-[10px] text-stone-400">Freeze cols</label>
          <input
            type="number"
            min={0}
            max={5}
            value={projectsTablePrefs.freezeCols ?? 0}
            onChange={(e) => setProjectsTablePrefs((prev) => ({ ...prev, freezeCols: Math.max(0, Math.min(5, Number(e.target.value) || 0)) }))}
            className="h-6 w-10 border border-stone-200/15 bg-[rgb(var(--pm-rail))]/80 px-1 text-center text-xs text-stone-100"
          />
          <label className="text-[10px] text-stone-400">Row h</label>
          <input
            type="number"
            min={36}
            max={160}
            value={projectsTablePrefs.rowHeight ?? 52}
            onChange={(e) => setProjectsTablePrefs((prev) => ({ ...prev, rowHeight: Math.max(36, Math.min(160, Number(e.target.value) || 52)) }))}
            className="h-6 w-12 border border-stone-200/15 bg-[rgb(var(--pm-rail))]/80 px-1 text-center text-xs text-stone-100"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProjectHiddenCols((value) => !value)}
            className="inline-flex h-8 items-center gap-1 border border-stone-200/15 px-2 text-xs text-stone-300 hover:text-stone-100"
          >
            <EyeOff size={12} /> Hidden cols ({table.getAllLeafColumns().filter((column) => !column.getIsVisible()).length})
          </button>
          {showProjectHiddenCols && (
            <div className="absolute right-0 top-9 z-40 w-64 border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-2 shadow-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-stone-400">Column visibility</p>
                <button
                  type="button"
                  onClick={() => setColumnVisibility({})}
                  className="text-[10px] text-cyan-200 hover:text-cyan-100"
                >
                  Show all
                </button>
              </div>
              {table.getAllLeafColumns().map((column) => (
                <button
                  key={column.id}
                  type="button"
                  disabled={column.id === 'col-id'}
                  onClick={() => column.toggleVisibility(!column.getIsVisible())}
                  className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[11px] text-stone-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-stone-500"
                >
                  <span className="truncate">{String(column.columnDef.header ?? column.id)}</span>
                  <span className="text-[10px] text-stone-500">{column.getIsVisible() ? 'Shown' : 'Hidden'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProjectHiddenRowsMenu((value) => !value)}
            className={`inline-flex h-8 items-center gap-1 border px-2 text-xs ${
              hiddenProjectRows.length > 0
                ? 'border-cyan-200/35 bg-cyan-500/10 text-cyan-100'
                : 'border-stone-200/15 text-stone-300 hover:text-stone-100'
            }`}
          >
            <EyeOff size={12} /> Hidden rows ({hiddenProjectRows.length})
          </button>
          {showProjectHiddenRowsMenu && (
            <div className="absolute right-0 top-9 z-40 w-72 border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-2 shadow-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-stone-400">Hidden rows</p>
                {hiddenProjectRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setProjectsTablePrefs((prev) => ({ ...prev, hiddenRowIds: [] }))}
                    className="text-[10px] text-cyan-200 hover:text-cyan-100"
                  >
                    Show all
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowProjectHiddenRows((value) => !value)}
                className="mb-2 block w-full border border-stone-200/15 px-2 py-1.5 text-left text-[11px] text-stone-200 hover:bg-white/10"
              >
                {showProjectHiddenRows ? 'Hide hidden rows from table' : 'Show hidden rows in table'}
              </button>
              {hiddenProjectRows.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-stone-500">No hidden rows.</p>
              ) : (
                <div className="max-h-60 overflow-auto">
                  {hiddenProjectRows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-2 py-1">
                      <span className="min-w-0 truncate text-[11px] text-stone-200" title={row.label}>
                        {row.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setProjectsTablePrefs((prev) => ({
                          ...prev,
                          hiddenRowIds: (prev.hiddenRowIds ?? []).filter((id) => id !== row.id),
                        }))}
                        className="border border-cyan-200/30 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
                      >
                        Show
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={resetProjectsTableView}
          className="inline-flex h-8 items-center gap-1 border border-stone-200/15 px-2 text-xs text-stone-300 hover:text-stone-100"
        >
          <RotateCcw size={12} /> Reset view
        </button>
        <span className="ml-auto text-[10px] text-stone-500">
          {filteredProjects.length} shown
        </span>
      </div>

      {/* Projects table */}
      <div className="pm-scroll min-h-0 overflow-auto border border-stone-200/12 bg-[rgb(var(--pm-panel))]/72">
        <table className="w-full table-fixed min-w-[1320px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-40 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      void (async () => {
                        const raw = await resizePrompt.open({
                          title: 'Resize column',
                          message: 'Resize column width in px. Enter 0 to hide this column.',
                          defaultValue: String(header.column.getSize()),
                        });
                        if (raw == null) return;
                        const value = Number(raw);
                        if (!Number.isFinite(value)) return;
                        if (value === 0) {
                          if (header.column.id !== 'col-id') header.column.toggleVisibility(false);
                          return;
                        }
                        setColumnSizing((prev) => ({ ...prev, [header.column.id]: Math.max(56, Math.min(640, value)) }));
                      })();
                    }}
                    className={`overflow-hidden px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400 ${
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:text-stone-200' : ''
                    }`}
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      position: visibleProjectColumns.findIndex((column) => column.id === header.column.id) < frozenProjectCols ? 'sticky' : undefined,
                      left: visibleProjectColumns.findIndex((column) => column.id === header.column.id) < frozenProjectCols
                        ? projectLeftOffsets[visibleProjectColumns.findIndex((column) => column.id === header.column.id)]
                        : undefined,
                      zIndex: visibleProjectColumns.findIndex((column) => column.id === header.column.id) < frozenProjectCols ? 50 : undefined,
                      background: 'rgb(var(--pm-panel))',
                    }}
                  >
                    <span className="inline-flex items-center gap-1 pr-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-[10px] text-stone-500">
                          {header.column.getIsSorted() === 'asc'
                            ? '↑'
                            : header.column.getIsSorted() === 'desc'
                              ? '↓'
                          : '↕'}
                        </span>
                      )}
                    </span>
                    {header.column.getCanResize() && (
                      <span
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-emerald-300/60"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const project = row.original;
              const isSelected = project.id === selectedProjectId;
              const isInitializing = initializingIds.has(project.id);
              const initError = initErrors[project.id];
              const initTraceEntries = initTrace[project.id] ?? [];
              const repoUrlError = repoUrlErrors[project.id];
              const hasDetail = Boolean(repoUrlError || initTraceEntries.length > 0 || initError);
              const showRetry = !(project.configPath?.startsWith('https://github.com/') ?? false);

              return (
                <Fragment key={row.id}>
                  <tr
                    ref={(node) => {
                      projectRowRefs.current[project.id] = node;
                    }}
                    onClick={() => onSelectProject(project.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setProjectsTablePrefs((prev) => ({
                        ...prev,
                        hiddenRowIds: (prev.hiddenRowIds ?? []).includes(project.id)
                          ? (prev.hiddenRowIds ?? []).filter((id) => id !== project.id)
                          : Array.from(new Set([...(prev.hiddenRowIds ?? []), project.id])),
                      }));
                    }}
                    className={`cursor-pointer border-b border-stone-200/10 transition-colors hover:bg-white/[0.045] ${
                      isSelected ? 'bg-emerald-950/20' : ''
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const visibleIndex = visibleProjectColumns.findIndex((column) => column.id === cell.column.id);
                      const isFrozen = visibleIndex >= 0 && visibleIndex < frozenProjectCols;
                      return (
                      <td
                        key={cell.id}
                        className="overflow-hidden px-3 py-3 align-middle text-sm text-stone-300"
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          height: projectsTablePrefs.rowHeight,
                          position: isFrozen ? 'sticky' : undefined,
                          left: isFrozen ? projectLeftOffsets[visibleIndex] : undefined,
                          zIndex: isFrozen ? 20 : undefined,
                          background: isFrozen ? 'rgb(var(--pm-panel))' : undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                      );
                    })}
                  </tr>
                  {hasDetail && (
                    <tr key={`${row.id}-details`} className="border-b border-stone-200/10 bg-black/15">
                      <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-3">
                        <div className="space-y-3">
                          {repoUrlError && (
                            <div className="flex items-start gap-2 text-[11px] text-red-200">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                              <span className="min-w-0 break-words">GitHub URL error: {repoUrlError}</span>
                            </div>
                          )}
                          {initTraceEntries.length > 0 && (
                            <div onClick={(e) => e.stopPropagation()}>
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
                            <div className="flex flex-wrap items-start gap-2 text-[11px] text-violet-200">
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
                                showRetry &&
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInitErrors((prev) => {
                                    const next = { ...prev };
                                    delete next[project.id];
                                    return next;
                                  });
                                }}
                                className="shrink-0 text-violet-300 hover:text-violet-100"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-6 py-10 text-center"
                >
                  {projects.length === 0 ? (
                    <>
                      <p className="text-sm text-stone-300">No projects yet</p>
                      <p className="mt-1 text-xs text-stone-500">
                        Add a local folder or GitHub repo to start tracking progress.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-stone-300">No rows match the current search or filters.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setProjectSearch('');
                          setProjectStatusFilter('all');
                          setShowProjectHiddenRows(false);
                        }}
                        className="mt-3 border border-stone-200/20 px-3 py-1.5 text-xs text-stone-200 hover:bg-white/5"
                      >
                        Clear search and filters
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
      {resizePrompt.dialog}
    </div>
  );
}
