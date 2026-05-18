'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  FolderPlus,
  Github,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { InitializeMode } from '../../../lib/storage';
import { migrateConfig, resolveConfigPath } from '../../../lib/storage';
import { CompletedRun, ProjectManagerConfig, Feature, ProjectEntry } from '../../../lib/types';

interface ProjectsViewProps {
  projects: ProjectEntry[];
  selectedProjectId: string;
  selectedDashboardProjectIds: string[];
  onSelectProject: (id: string) => void;
  onToggleDashboardProject: (id: string, selected: boolean) => void;
  onAddProject: (entry: ProjectEntry) => void;
  onRemoveProject: (id: string, deleteConfigFile: boolean) => Promise<void> | void;
  onSyncProject: (id: string) => Promise<void>;
  onInitializeProject: (id: string, mode: InitializeMode) => Promise<void>;
  runHistory: CompletedRun[];
}

function isMissingConfigError(message: string): boolean {
  return /No such file or directory|Is a directory|os error 2\b|os error 21\b|CONFIG_EXISTS/i.test(
    message,
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSecs = Math.floor((Date.now() - then) / 1000);
  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const mins = Math.floor(diffSecs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

type ScanPhase = 'idle' | 'scanning' | 'preview' | 'error';

interface ScanPreview {
  config: ProjectManagerConfig;
  rawJson: string;
  projectName: string;
  featureCount: number;
  detectedIDEs: string[];
}

export function ProjectsView({
  projects,
  selectedProjectId,
  selectedDashboardProjectIds,
  onSelectProject,
  onToggleDashboardProject,
  onAddProject,
  onRemoveProject,
  onSyncProject,
  onInitializeProject,
  runHistory,
}: ProjectsViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'local' | 'github'>('local');
  /** Folder path used by the AI Scan flow. */
  const [localPath, setLocalPath] = useState('');
  /**
   * Path used by the Manual Add flow. Kept separate from `localPath` so the
   * two inputs don't mirror each other (they serve different intents — AI Scan
   * wants a folder, Manual Add wants an existing config file).
   */
  const [manualConfigPath, setManualConfigPath] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [reportText, setReportText] = useState('');
  const [reportCopied, setReportCopied] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  // AI Scan state
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [scanPreview, setScanPreview] = useState<ScanPreview | null>(null);
  const [scanError, setScanError] = useState('');
  const [editableJson, setEditableJson] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);

  // Sync state — track which project ids are currently syncing + any error.
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [initializingIds, setInitializingIds] = useState<Set<string>>(new Set());
  const [initConfirmTarget, setInitConfirmTarget] = useState<ProjectEntry | null>(null);

  // Delete confirmation modal state.
  const [deleteTarget, setDeleteTarget] = useState<ProjectEntry | null>(null);
  const [deleteAlsoFile, setDeleteAlsoFile] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
    let cancelled = false;
    (async () => {
      const { getGithubToken } = await import('../../../lib/bridge');
      const token = await getGithubToken();
      if (!cancelled) setGithubToken(token);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset scan + manual-add state when modal closes so the next open starts clean.
  useEffect(() => {
    if (!showAddModal) {
      setScanPhase('idle');
      setScanPreview(null);
      setScanError('');
      setEditableJson('');
      setShowRawJson(false);
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
        paths: { spec: '', tdd: '', implementation: '' },
        adapters: [],
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

  const handleAddLocal = async () => {
    if (!manualConfigPath.trim()) return;
    // Resolve `<folder>` → `<folder>/.project-manager.json` so Rust's read_config
    // never sees a directory path (which would surface as `Is a directory (os error 21)`).
    const resolvedPath = resolveConfigPath(manualConfigPath);
    setAdding(true);
    setAddError('');
    try {
      let config: ProjectManagerConfig;
      if (isTauri) {
        const { readConfig } = await import('../../../lib/bridge');
        config = await readConfig(resolvedPath);
      } else {
        const folder = resolvedPath.replace(/\/\.project-manager\.json$/, '');
        config = migrateConfig({
          schemaVersion: 2,
          project: {
            name: folder.split('/').pop() || 'Project',
            root: folder,
            defaultIDE: 'Cursor',
          },
          features: [],
          adapters: { ides: [], agents: [] },
        });
      }
      onAddProject({ id: `proj-${Date.now()}`, config, configPath: resolvedPath });
      setShowAddModal(false);
      setManualConfigPath('');
      setLocalPath('');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // Rust returns `No such file or directory (os error 2)` for missing
      // files and `Is a directory (os error 21)` when handed a folder.
      // Both mean the same thing from the user's perspective: there's no
      // `.project-manager.json` at the location they pointed at. Translate
      // it into actionable guidance instead of leaking the OS error.
      if (/No such file or directory|Is a directory|os error 2\b|os error 21\b/i.test(raw)) {
        setAddError(
          `No .project-manager.json found at ${resolvedPath}. Try the AI Scan option above to generate one automatically.`,
        );
      } else {
        setAddError(`Failed to read config: ${raw}`);
      }
    } finally {
      setAdding(false);
    }
  };

  // ── AI Scan handlers ──────────────────────────────────────────────────────

  const handleAIScan = async () => {
    const path = addMode === 'local' ? localPath.trim() : githubUrl.trim();
    if (!path) return;

    setScanPhase('scanning');
    setScanError('');
    setScanPreview(null);

    try {
      const res = await fetch('/api/scan-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Scan failed');
      }

      const config = data.config as ProjectManagerConfig;
      const rawJson = JSON.stringify(config, null, 2);

      setScanPreview({
        config,
        rawJson,
        projectName: config.project.name,
        featureCount: config.features.length,
        detectedIDEs: data.context?.detectedIDEs ?? [],
      });
      setEditableJson(rawJson);
      setScanPhase('preview');
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
      setScanPhase('error');
    }
  };

  const handleSaveScanResult = () => {
    try {
      // Pipe through migrateConfig so AI-generated JSON missing v2 fields
      // (id / createdAt / …) gets back-filled before we persist it.
      const config = migrateConfig(JSON.parse(editableJson));
      const configPath = config.project.root.endsWith('.project-manager.json')
        ? config.project.root
        : `${config.project.root}/.project-manager.json`;

      onAddProject({
        id: `scan-${Date.now()}`,
        config,
        configPath,
      });
      setShowAddModal(false);
    } catch (e) {
      setScanError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

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

  // ── Sync / Delete handlers ────────────────────────────────────────────────

  const handleSyncOne = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    setSyncErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await onSyncProject(id);
    } catch (e) {
      setSyncErrors((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    // Fire in parallel — projects sync independently.
    await Promise.all(projects.map((p) => handleSyncOne(p.id)));
  };

  const runInitialize = async (project: ProjectEntry, mode: InitializeMode) => {
    setInitializingIds((prev) => new Set(prev).add(project.id));
    setSyncErrors((prev) => {
      if (!(project.id in prev)) return prev;
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
    try {
      await onInitializeProject(project.id, mode);
      setInitConfirmTarget(null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/CONFIG_EXISTS/i.test(raw)) {
        setInitConfirmTarget(project);
      } else {
        setSyncErrors((prev) => ({ ...prev, [project.id]: raw }));
      }
    } finally {
      setInitializingIds((prev) => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
    }
  };

  const handleInitializeClick = async (project: ProjectEntry) => {
    if (!isTauri) {
      setSyncErrors((prev) => ({
        ...prev,
        [project.id]: 'Initialize requires the Project Manager desktop app (Tauri).',
      }));
      return;
    }
    if (project.configPath.startsWith('https://')) return;
    await runInitialize(project, 'create');
  };

  const confirmInitializeMode = async (mode: InitializeMode) => {
    if (!initConfirmTarget) return;
    await runInitialize(initConfirmTarget, mode);
  };

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

  // ── Render: Scan Preview Modal Content ────────────────────────────────────

  const renderScanPreview = () => {
    if (!scanPreview) return null;
    const { config } = scanPreview;

    return (
      <div className="space-y-4">
        {/* Summary header */}
        <div className="flex items-start gap-3 rounded border border-emerald-400/20 bg-emerald-900/20 p-3">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-emerald-300" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-100">
              Scan complete — {config.features.length} features detected
            </p>
            <p className="mt-0.5 text-xs text-emerald-200/70">
              Project: {config.project.name} · IDE: {config.project.defaultIDE}
              {scanPreview.detectedIDEs.length > 0 && (
                <> · Detected: {scanPreview.detectedIDEs.join(', ')}</>
              )}
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div className="max-h-48 space-y-1 overflow-auto">
          {config.features.map((f, i) => (
            <div
              key={f.id || i}
              className="flex items-center gap-2 border-b border-stone-200/8 px-1 py-1.5 text-xs"
            >
              <span className="shrink-0 font-mono text-stone-500">{f.id}</span>
              <span className="min-w-0 truncate text-stone-200">{f.name}</span>
              <span className="ml-auto shrink-0 border border-stone-200/15 px-1.5 py-0.5 text-[10px] text-stone-400">
                {f.category}
              </span>
              <span
                className={`shrink-0 text-[10px] font-medium ${
                  f.status === 'done'
                    ? 'text-emerald-400'
                    : f.status === 'in_progress'
                      ? 'text-amber-300'
                      : f.status === 'on_hold'
                        ? 'text-red-400'
                        : 'text-stone-500'
                }`}
              >
                {f.status}
              </span>
            </div>
          ))}
        </div>

        {/* Editable JSON toggle */}
        <div>
          <button
            onClick={() => setShowRawJson((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200"
          >
            {showRawJson ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showRawJson ? 'Hide' : 'Show'} raw JSON (editable)
          </button>
          {showRawJson && (
            <textarea
              value={editableJson}
              onChange={(e) => setEditableJson(e.target.value)}
              className="mt-2 h-64 w-full border border-stone-200/15 bg-[#03100f] p-3 font-mono text-xs text-stone-300 outline-none focus:ring-2 focus:ring-emerald-300/30"
              spellCheck={false}
            />
          )}
        </div>

        <p className="text-[11px] text-amber-100/60">
          ⚠ Review the generated config before saving. You can edit the JSON directly above.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
          <button
            onClick={handleSyncAll}
            disabled={projects.length === 0 || syncingIds.size > 0}
            className="inline-flex h-9 items-center gap-2 border border-stone-200/20 px-3 text-xs uppercase tracking-[0.14em] text-stone-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            title="Re-read every project from its source"
          >
            <RefreshCw size={14} className={syncingIds.size > 0 ? 'animate-spin' : ''} />
            Sync All
          </button>
          <button
            onClick={handleGenerateReport}
            className="inline-flex h-9 items-center gap-2 border border-stone-200/20 px-3 text-xs uppercase tracking-[0.14em] text-stone-200 hover:bg-white/5"
          >
            <BarChart3 size={14} />
            Weekly Report
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex h-9 items-center gap-2 bg-stone-100 px-3 text-xs font-medium uppercase tracking-[0.14em] text-[#071d1a] hover:bg-amber-100"
          >
            <Plus size={14} />
            Add Project
          </button>
        </div>
      </div>

      {/* Project List */}
      <div className="space-y-3">
        {projects.map((project) => {
          const { features } = project.config;
          const isSelected = project.id === selectedProjectId;
          const isDashboardSelected = selectedDashboardProjectIds.includes(project.id);
          const isSyncing = syncingIds.has(project.id);
          const isInitializing = initializingIds.has(project.id);
          const syncError = syncErrors[project.id];
          const isGithub = project.configPath.startsWith('https://github.com/');
          const showInitialize =
            !isGithub && (isMissingConfigError(syncError ?? '') || !project.lastSyncedAt);

          return (
            <div
              key={project.id}
              className={`group border bg-[#071d1a]/72 transition-colors ${
                isSelected
                  ? 'border-emerald-200/35'
                  : 'border-stone-200/18 hover:border-stone-200/30'
              }`}
            >
              <div
                className="flex cursor-pointer items-center justify-between px-4 py-3"
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isDashboardSelected}
                    onChange={(e) => onToggleDashboardProject(project.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 cursor-pointer accent-emerald-400"
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
                    </div>
                    <p className="mt-0.5 max-w-sm truncate text-xs text-stone-500">
                      {project.configPath}
                    </p>
                    <p className="mt-0.5 text-[10px] text-stone-500">
                      {project.lastSyncedAt
                        ? `Synced ${formatRelativeTime(project.lastSyncedAt)}`
                        : 'Not synced yet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <span>{features.length} features</span>
                  {/* Hover-revealed action group. Sync stays visible while spinning so users get feedback. */}
                  <div
                    className={`flex items-center gap-1 transition-opacity ${
                      isSyncing || isInitializing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {showInitialize && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isTauri) return;
                          void handleInitializeClick(project);
                        }}
                        disabled={isInitializing || isSyncing || !isTauri}
                        title={
                          !isTauri
                            ? 'Initialize requires the desktop app — run ./start_project_manager.sh (without "web") to enable filesystem access.'
                            : 'Create .project-manager.json, docs/features/, and docs/dev-logs/'
                        }
                        className="flex h-7 items-center gap-1 border border-emerald-200/30 bg-emerald-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FolderPlus size={12} className={isInitializing ? 'animate-pulse' : ''} />
                        Init
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSyncOne(project.id);
                      }}
                      disabled={isSyncing || isInitializing}
                      title={isGithub ? 'Re-fetch from GitHub' : 'Re-read .project-manager.json from disk'}
                      className="flex h-7 w-7 items-center justify-center text-stone-400 hover:bg-white/5 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
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
              {syncError && (
                <div className="flex flex-wrap items-start gap-2 border-t border-red-500/25 bg-red-900/15 px-4 py-2 text-[11px] text-red-300">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">Sync failed: {syncError}</span>
                  {showInitialize && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isTauri) return;
                        void handleInitializeClick(project);
                      }}
                      disabled={isInitializing || !isTauri}
                      title={
                        !isTauri
                          ? 'Initialize requires the desktop app — run ./start_project_manager.sh (without "web").'
                          : undefined
                      }
                      className="shrink-0 border border-emerald-200/35 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Initialize
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setSyncErrors((prev) => {
                        const next = { ...prev };
                        delete next[project.id];
                        return next;
                      })
                    }
                    className="shrink-0 text-red-400 hover:text-red-200"
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
        <div className="border border-stone-200/18 bg-[#071d1a]/72">
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

      {/* Initialize — config already exists */}
      {initConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border border-amber-200/25 bg-[#071d1a] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-stone-200/12 bg-amber-500/10 px-6 py-4">
              <AlertTriangle size={18} className="text-amber-200" />
              <h3 className="text-base font-semibold text-stone-50">Config already exists</h3>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-stone-200">
              <p>
                <span className="font-medium text-stone-50">{initConfirmTarget.config.project.name}</span>{' '}
                already has a <code className="font-mono text-stone-300">.project-manager.json</code> on disk.
              </p>
              <p className="text-xs text-stone-400">
                Merge keeps your features and fills missing engineer roles. Overwrite replaces the file with a
                fresh empty scaffold (features cleared). Both ensure <code className="font-mono">docs/features/</code>{' '}
                and <code className="font-mono">docs/dev-logs/</code> exist.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
              <button
                type="button"
                onClick={() => setInitConfirmTarget(null)}
                className="px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmInitializeMode('merge')}
                className="border border-cyan-200/30 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25"
              >
                Merge
              </button>
              <button
                type="button"
                onClick={() => void confirmInitializeMode('overwrite')}
                className="bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border border-red-400/30 bg-[#071d1a] shadow-2xl">
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
                <code className="font-mono text-stone-300">.project-manager.json</code> on disk is left untouched.
              </p>

              {/* Disk-delete opt-in (disabled for GitHub-sourced projects) */}
              {(() => {
                const isGithubTarget = deleteTarget.configPath.startsWith('https://');
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
                      Also delete the <code className="font-mono">.project-manager.json</code> file on disk
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
          <div className="w-full max-w-lg border border-stone-200/18 bg-[#071d1a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
              <h3 className="text-lg font-bold text-stone-50">
                {scanPhase === 'preview' ? 'AI Scan Results' : 'Add Project'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-2xl leading-none text-stone-400 hover:text-stone-100"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 p-6">
              {/* Phase: Preview */}
              {scanPhase === 'preview' ? (
                renderScanPreview()
              ) : (
                <>
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
                            ? 'bg-stone-100 text-[#071d1a]'
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
                      <div>
                        <label className="mb-1 block text-sm font-medium text-stone-200">
                          Project folder path
                        </label>
                        <input
                          value={localPath}
                          onChange={(e) => setLocalPath(e.target.value)}
                          placeholder="/path/to/your/project"
                          className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                        />
                      </div>

                      {/* AI Scan button */}
                      <button
                        onClick={handleAIScan}
                        disabled={!localPath.trim() || scanPhase === 'scanning'}
                        className="flex w-full items-center justify-center gap-2 border border-emerald-400/30 bg-emerald-900/25 px-4 py-2.5 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {scanPhase === 'scanning' ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            Scanning project…
                          </>
                        ) : (
                          <>
                            <Bot size={15} />
                            <Sparkles size={12} />
                            AI Scan — Auto-generate .project-manager.json
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-stone-200/12" />
                        <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                          or add manually
                        </span>
                        <div className="h-px flex-1 bg-stone-200/12" />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-stone-400">
                          Path to existing .project-manager.json
                        </label>
                        <input
                          value={manualConfigPath}
                          onChange={(e) => setManualConfigPath(e.target.value)}
                          placeholder="/path/to/project/.project-manager.json"
                          className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                        />
                        <p className="mt-1 text-[10px] text-stone-500">
                          Folder paths are accepted — .project-manager.json will be appended automatically.
                        </p>
                      </div>

                      {!isTauri && (
                        <p className="text-[11px] text-amber-100/60">
                          Dev mode: AI Scan works via Next.js API route. Manual add creates a placeholder project.
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
                          className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
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
                          className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                        />
                      </div>
                      <p className="text-[11px] text-amber-100/60">
                        GitHub import requires Tauri bridge + GitHub GraphQL API. PR/issue analysis and
                        smart alerts will be enabled when connected.
                      </p>
                    </div>
                  )}

                  {/* Scan error */}
                  {scanPhase === 'error' && scanError && (
                    <div className="rounded border border-red-500/30 bg-red-900/15 p-3">
                      <p className="text-xs text-red-300">{scanError}</p>
                      <button
                        onClick={() => setScanPhase('idle')}
                        className="mt-1 text-[11px] text-red-400 underline hover:text-red-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </>
              )}

              {addError && <p className="text-sm text-red-400">{addError}</p>}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
              {scanPhase === 'preview' ? (
                <>
                  <button
                    onClick={() => setScanPhase('idle')}
                    className="px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSaveScanResult}
                    className="inline-flex items-center gap-2 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    <Save size={14} />
                    Save & Add Project
                  </button>
                </>
              ) : (
                <>
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
                      scanPhase === 'scanning' ||
                      (addMode === 'local'
                        ? !manualConfigPath.trim()
                        : !githubUrl.trim() || !isTauri)
                    }
                    className="bg-stone-100 px-4 py-2 text-sm font-medium text-[#071d1a] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {adding
                      ? 'Importing…'
                      : addMode === 'github'
                        ? isTauri
                          ? 'Import from GitHub'
                          : 'Requires Tauri'
                        : 'Add Project'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
