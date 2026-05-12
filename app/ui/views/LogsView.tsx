'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Terminal,
  XCircle,
} from 'lucide-react';
import type { ActiveRun, CompletedRun, CronRun, Feature, ProjectEntry } from '../../../lib/types';

type Tab = 'runs' | 'cron' | 'devlogs';

interface LogsViewProps {
  activeRuns: ActiveRun[];
  runHistory: CompletedRun[];
  cronHistory: CronRun[];
  projects: ProjectEntry[];
  selectedProjectId: string;
  onKillRun: (pid: number) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtTime(ts: number | string) {
  return new Date(ts).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Runs tab ──────────────────────────────────────────────────────────────────

function RunsTab({
  activeRuns,
  runHistory,
  onKillRun,
}: {
  activeRuns: ActiveRun[];
  runHistory: CompletedRun[];
  onKillRun: (pid: number) => void;
}) {
  const [expandedPid, setExpandedPid] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {activeRuns.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">Active</h2>
          <div className="space-y-3">
            {activeRuns.map((run) => (
              <div key={run.pid} className="border border-emerald-200/25 bg-[#071d1a]/72">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Activity size={15} className="shrink-0 animate-pulse text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-100">{run.featureName}</span>
                      <span className="font-mono text-xs text-stone-500">PID {run.pid}</span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-stone-400">
                      {run.command} {run.args.join(' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">
                      {fmtDuration(Date.now() - run.startedAt)}
                    </span>
                    <button
                      onClick={() => setExpandedPid(expandedPid === run.pid ? null : run.pid)}
                      className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                    >
                      {expandedPid === run.pid ? 'Hide' : 'Log'}
                    </button>
                    <button
                      onClick={() => onKillRun(run.pid)}
                      className="border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                    >
                      Kill
                    </button>
                  </div>
                </div>
                {expandedPid === run.pid && (
                  <div className="border-t border-stone-200/12 bg-[#03100f] p-3">
                    <div className="max-h-48 overflow-auto font-mono text-xs leading-5 text-stone-300">
                      {run.logs.length === 0 ? (
                        <span className="animate-pulse text-stone-500">Waiting…</span>
                      ) : (
                        run.logs.slice(-50).map((line, i) => (
                          <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-400">History</h2>
        {runHistory.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-stone-200/18 text-center">
            <Terminal className="mb-2 text-stone-500" size={24} />
            <p className="text-sm text-stone-400">No runs yet in this session.</p>
            <p className="mt-1 text-xs text-stone-500">Dispatch a feature to see history here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runHistory.map((run, i) => (
              <div key={`${run.pid}-${i}`} className="border border-stone-200/18 bg-[#071d1a]/72">
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                >
                  {run.success ? (
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size={15} className="shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-100">{run.featureName}</span>
                      <span className={`text-xs ${run.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        exit {run.exitCode}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-stone-500">
                      {run.command} {run.args.slice(0, 2).join(' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-500">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {fmtDuration(run.completedAt - run.startedAt)}
                    </span>
                    <span>{fmtTime(run.completedAt)}</span>
                  </div>
                </div>
                {expandedIdx === i && run.logs.length > 0 && (
                  <div className="border-t border-stone-200/12 bg-[#03100f] p-3">
                    <div className="max-h-48 overflow-auto font-mono text-xs leading-5 text-stone-300">
                      {run.logs.slice(-50).map((line, li) => (
                        <div key={li} className="whitespace-pre-wrap break-all">{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Cron tab ──────────────────────────────────────────────────────────────────

function CronTab({ cronHistory }: { cronHistory: CronRun[] }) {
  if (cronHistory.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-stone-200/18 text-center">
        <Clock className="mb-2 text-stone-500" size={24} />
        <p className="text-sm text-stone-400">No cron runs recorded yet.</p>
        <p className="mt-1 text-xs text-stone-500">Cron jobs appear here as they fire.</p>
      </div>
    );
  }

  const grouped: Record<string, CronRun[]> = {};
  for (const r of [...cronHistory].reverse()) {
    const day = new Date(r.firedAt).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(r);
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, runs]) => (
        <section key={day}>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            {day}
          </h2>
          <div className="divide-y divide-stone-200/10 border border-stone-200/12">
            {runs.map((run, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                {run.status === 'ok' ? (
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                ) : (
                  <XCircle size={13} className="shrink-0 text-red-400" />
                )}
                <span className="flex-1 text-xs text-stone-300">{run.jobName}</span>
                {run.pid && (
                  <span className="font-mono text-xs text-stone-600">PID {run.pid}</span>
                )}
                <span className="text-xs text-stone-500">{fmtRelative(run.firedAt)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Dev Logs tab ──────────────────────────────────────────────────────────────

interface DevLogEntry {
  featureId: string;
  featureName: string;
  folder: string;
}

function DevLogsTab({
  projects,
  selectedProjectId,
}: {
  projects: ProjectEntry[];
  selectedProjectId: string;
}) {
  const [selected, setSelected] = useState<DevLogEntry | null>(null);
  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const entries: DevLogEntry[] = (project?.config.features ?? [])
    .filter((f: Feature) => f.paths?.developmentLogSummaryFolder)
    .map((f: Feature) => ({
      featureId: f.id,
      featureName: f.name,
      folder: f.paths.developmentLogSummaryFolder!,
    }));

  async function handleSelectEntry(entry: DevLogEntry) {
    setSelected(entry);
    setSelectedFile(null);
    setContent('');
    setFileList([]);
    setLoading(true);
    try {
      const { listProjectFiles } = await import('../../../lib/bridge');
      const nodes = await listProjectFiles(entry.folder, 1);
      const mdFiles = nodes
        .filter((n) => !n.isDir && (n.name.endsWith('.md') || n.name.endsWith('.html')))
        .map((n) => n.path)
        .sort((a, b) => b.localeCompare(a)); // newest first by name
      setFileList(mdFiles);
    } catch {
      setFileList([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectFile(path: string) {
    setSelectedFile(path);
    setContent('');
    setLoading(true);
    try {
      const { readFile } = await import('../../../lib/bridge');
      setContent(await readFile(path));
    } catch {
      setContent('(Unable to read file — Tauri runtime required)');
    } finally {
      setLoading(false);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-stone-200/18 text-center">
        <FileText className="mb-2 text-stone-500" size={24} />
        <p className="text-sm text-stone-400">No dev log folders configured.</p>
        <p className="mt-1 text-xs text-stone-500">
          Set <code className="text-stone-400">paths.developmentLogSummaryFolder</code> on a feature to see logs here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Feature list */}
      <aside className="w-52 shrink-0">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-stone-500">Features</p>
        <div className="divide-y divide-stone-200/8 border border-stone-200/12">
          {entries.map((e) => (
            <button
              key={e.featureId}
              onClick={() => handleSelectEntry(e)}
              className={[
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors',
                selected?.featureId === e.featureId
                  ? 'bg-emerald-950/50 text-stone-100'
                  : 'text-stone-300 hover:bg-white/[0.03]',
              ].join(' ')}
            >
              <FolderOpen size={13} className="shrink-0 text-stone-500" />
              <span className="truncate">{e.featureName}</span>
              <ChevronRight size={11} className="ml-auto shrink-0 text-stone-600" />
            </button>
          ))}
        </div>
      </aside>

      {/* File list + content */}
      <div className="min-w-0 flex-1 space-y-4">
        {!selected ? (
          <div className="flex min-h-32 items-center justify-center text-xs text-stone-500">
            Select a feature to browse its dev logs.
          </div>
        ) : (
          <>
            {/* File list */}
            {loading && fileList.length === 0 ? (
              <p className="text-xs text-stone-500">Loading…</p>
            ) : fileList.length === 0 ? (
              <p className="text-xs text-stone-500">
                No .md / .html files found in{' '}
                <code className="text-stone-400">{selected.folder}</code>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {fileList.map((f) => {
                  const name = f.split('/').pop() ?? f;
                  return (
                    <button
                      key={f}
                      onClick={() => handleSelectFile(f)}
                      className={[
                        'flex items-center gap-1.5 border px-2.5 py-1.5 text-xs transition-colors',
                        selectedFile === f
                          ? 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300'
                          : 'border-stone-200/15 text-stone-300 hover:border-stone-200/30 hover:text-stone-100',
                      ].join(' ')}
                    >
                      <FileText size={11} />
                      {name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* File content */}
            {selectedFile && (
              <div className="border border-stone-200/12 bg-[#03100f]">
                <div className="flex items-center justify-between border-b border-stone-200/10 px-4 py-2">
                  <span className="font-mono text-[11px] text-stone-400">
                    {selectedFile.split('/').pop()}
                  </span>
                  {loading && <span className="text-[11px] text-stone-500">Loading…</span>}
                </div>
                <div className="max-h-[60vh] overflow-auto p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-stone-300">
                    {content || (loading ? '' : '(empty)')}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main LogsView ─────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = {
  runs: 'Runs',
  cron: 'Cron',
  devlogs: 'Dev Logs',
};

export function LogsView({
  activeRuns,
  runHistory,
  cronHistory,
  projects,
  selectedProjectId,
  onKillRun,
}: LogsViewProps) {
  const [tab, setTab] = useState<Tab>('runs');

  const badge: Partial<Record<Tab, number>> = {
    runs: activeRuns.length || undefined,
  };

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-end gap-1 border-b border-stone-200/12">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'relative px-4 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors',
              tab === t
                ? 'border-b-2 border-emerald-400 text-stone-100'
                : 'text-stone-400 hover:text-stone-200',
            ].join(' ')}
          >
            {TAB_LABELS[t]}
            {badge[t] !== undefined && (
              <span className="ml-1.5 rounded-sm bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                {badge[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'runs' && (
        <RunsTab activeRuns={activeRuns} runHistory={runHistory} onKillRun={onKillRun} />
      )}
      {tab === 'cron' && <CronTab cronHistory={cronHistory} />}
      {tab === 'devlogs' && (
        <DevLogsTab projects={projects} selectedProjectId={selectedProjectId} />
      )}
    </div>
  );
}
