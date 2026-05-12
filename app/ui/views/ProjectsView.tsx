'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  FolderGit2,
  FolderOpen,
  Github,
  Loader2,
  Plus,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { migrateConfig } from '../../../lib/storage';
import { CompletedRun, DevPilotConfig, Feature, ProjectEntry } from '../../../lib/types';

interface ProjectsViewProps {
  projects: ProjectEntry[];
  selectedProjectId: string;
  selectedDashboardProjectIds: string[];
  onSelectProject: (id: string) => void;
  onToggleDashboardProject: (id: string, selected: boolean) => void;
  onAddProject: (entry: ProjectEntry) => void;
  runHistory: CompletedRun[];
}

type ScanPhase = 'idle' | 'scanning' | 'preview' | 'error';

interface ScanPreview {
  config: DevPilotConfig;
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
  runHistory,
}: ProjectsViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'local' | 'github'>('local');
  const [localPath, setLocalPath] = useState('');
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

  // Reset scan state when modal closes
  useEffect(() => {
    if (!showAddModal) {
      setScanPhase('idle');
      setScanPreview(null);
      setScanError('');
      setEditableJson('');
      setShowRawJson(false);
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

      const config: DevPilotConfig = migrateConfig({
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
    if (!localPath.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      let config: DevPilotConfig;
      if (isTauri) {
        const { readConfig } = await import('../../../lib/bridge');
        config = await readConfig(localPath);
      } else {
        config = migrateConfig({
          schemaVersion: 2,
          project: {
            name: localPath.split('/').pop() ?? 'Project',
            root: localPath,
            defaultIDE: 'Cursor',
          },
          features: [],
          adapters: { ides: [], agents: [] },
        });
      }
      onAddProject({ id: `proj-${Date.now()}`, config, configPath: localPath });
      setShowAddModal(false);
      setLocalPath('');
    } catch (e) {
      setAddError(`Failed to read config: ${e}`);
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

      const config = data.config as DevPilotConfig;
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
      const configPath = config.project.root.endsWith('.dev-pilot.json')
        ? config.project.root
        : `${config.project.root}/.dev-pilot.json`;

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
    const lines: string[] = [`# DevPilot Weekly Report — ${today}`, ''];

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
    lines.push('---', `_Generated by DevPilot v0.1.0 — ${new Date().toISOString()}_`);
    setReportText(lines.join('\n'));
  };

  const handleCopyReport = async () => {
    await navigator.clipboard.writeText(reportText);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
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

          return (
            <div
              key={project.id}
              className={`border bg-[#071d1a]/72 transition-colors ${
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
                  <FolderGit2
                    size={16}
                    className={isSelected ? 'text-emerald-300' : 'text-stone-400'}
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
                      {project.config.project.root}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <span>{features.length} features</span>
                </div>
              </div>
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
                            AI Scan — Auto-generate .dev-pilot.json
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
                          Path to existing .dev-pilot.json
                        </label>
                        <input
                          value={localPath}
                          onChange={(e) => setLocalPath(e.target.value)}
                          placeholder="/path/to/project/.dev-pilot.json"
                          className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                        />
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
                      (addMode === 'local' ? !localPath.trim() : !githubUrl.trim() || !isTauri)
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
