'use client';

import { FolderGit2 } from 'lucide-react';
import { ViewId } from '../../lib/types';

const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: 'Project Progress Dashboard',
  features: 'Features',
  projects: 'Projects',
  'project-files': 'Project Files',
  plugins: 'Plugins',
  settings: 'Settings',
  engineers: 'AI Engineers',
  channels: 'Channels',
  sessions: 'Sessions',
  'cron-jobs': 'Cron Jobs',
  logs: 'Logs',
  keys: 'API Keys',
  'keyboard-shortcuts': 'Keyboard Shortcuts',
  documentation: 'Documentation',
};

interface TopbarProps {
  currentView: ViewId;
  projectName: string;
  projectRoot: string;
}

export function Topbar({
  currentView,
  projectName,
  projectRoot,
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

          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-stone-300/75">
            <FolderGit2 size={14} className="shrink-0" />
            <span className="font-medium text-stone-200">{projectName}</span>
            <span className="hidden text-stone-500 sm:inline">/</span>
            <span className="truncate">{projectRoot}</span>
          </div>
        </div>


      </div>
    </header>
  );
}
