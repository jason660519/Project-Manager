'use client';

import { FolderGit2, RefreshCw, ShieldCheck } from 'lucide-react';
import { ProjectEntry, ViewId } from '../../lib/types';

const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  features: 'Features',
  runs: 'Runs',
  projects: 'Projects',
  ingestion: 'Ingestion',
  settings: 'Settings',
};

interface TopbarProps {
  currentView: ViewId;
  projects: ProjectEntry[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  projectName: string;
  projectRoot: string;
  bridgeStatus: 'dry-run' | 'connected' | 'offline' | 'live';
}

export function Topbar({
  currentView,
  projects,
  selectedProjectId,
  onSelectProject,
  projectName,
  projectRoot,
  bridgeStatus,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/15 bg-[#071b18]/92 backdrop-blur">
      <div className="flex min-h-16 flex-col justify-between gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold uppercase tracking-[0.18em] text-stone-50">
              {VIEW_TITLES[currentView]}
            </h1>
            <span className="border border-amber-200/25 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100/85">
              MVP
            </span>
          </div>

          {/* Project Switcher */}
          {projects.length > 1 ? (
            <div className="mt-1 flex items-center gap-2">
              <FolderGit2 size={14} className="shrink-0 text-stone-400" />
              <select
                value={selectedProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                className="cursor-pointer bg-transparent text-xs text-stone-200 outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#071d1a]">
                    {p.config.project.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-stone-300/75">
              <FolderGit2 size={14} className="shrink-0" />
              <span className="font-medium text-stone-200">{projectName}</span>
              <span className="hidden text-stone-500 sm:inline">/</span>
              <span className="truncate">{projectRoot}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 items-center gap-2 border border-emerald-200/25 px-3 text-xs uppercase tracking-[0.14em] text-emerald-100">
            <ShieldCheck size={14} />
            Bridge: {bridgeStatus}
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 border border-stone-200/20 px-3 text-xs uppercase tracking-[0.14em] text-stone-200 hover:border-stone-100/45 hover:bg-white/5"
            type="button"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
