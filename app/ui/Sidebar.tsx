'use client';

import {
  Boxes,
  CircleGauge,
  DatabaseZap,
  FileInput,
  FolderGit2,
  History,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { ViewId } from '../../lib/types';

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ size: number }> }> =
  [
    { id: 'dashboard', label: 'Dashboard', icon: CircleGauge },
    { id: 'features', label: 'Features', icon: FolderGit2 },
    { id: 'runs', label: 'Runs', icon: History },
    { id: 'projects', label: 'Projects', icon: Boxes },
    { id: 'ingestion', label: 'Ingestion', icon: FileInput },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

interface SidebarProps {
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  bridgeStatus: 'dry-run' | 'connected' | 'offline' | 'live';
  activeRunCount: number;
}

export function Sidebar({ currentView, onNavigate, bridgeStatus, activeRunCount }: SidebarProps) {
  return (
    <aside className="hidden min-h-screen border-r border-stone-200/15 bg-[#061512]/85 lg:flex lg:flex-col">
      {/* Logo */}
      <div className="border-b border-stone-200/15 px-5 py-5">
        <div className="text-lg font-black uppercase leading-4 tracking-[0.08em] text-stone-100">
          Dev
          <br />
          Pilot
        </div>
        <div className="mt-3 inline-flex items-center gap-2 border border-amber-200/25 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-amber-100/80">
          <DatabaseZap size={12} />
          Local Control
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={[
              'relative flex h-11 w-full items-center gap-3 border-y border-transparent px-5 text-left text-xs uppercase tracking-[0.18em] transition-colors',
              item.id === currentView
                ? 'border-stone-100/80 bg-emerald-950/40 text-stone-50'
                : 'text-stone-300/72 hover:border-stone-200/20 hover:bg-white/5 hover:text-stone-100',
            ].join(' ')}
            type="button"
          >
            <item.icon size={15} />
            {item.label}
            {item.id === 'runs' && activeRunCount > 0 && (
              <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                {activeRunCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* System Status */}
      <div className="border-t border-stone-200/15 px-5 py-5">
        <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-stone-400">System</div>
        <div className="space-y-2 text-xs text-stone-300/80">
          <div className="flex items-center justify-between">
            <span>Bridge</span>
            <span className="uppercase text-amber-100">{bridgeStatus}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Execution</span>
            <span className="uppercase text-emerald-200">guarded</span>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 border border-emerald-200/20 px-3 py-2 text-xs text-emerald-100">
          <ShieldCheck size={15} />
          dry-run protected
        </div>
        <div className="mt-5 text-[10px] uppercase tracking-[0.22em] text-stone-500">v0.1.0</div>
      </div>
    </aside>
  );
}
