'use client';

import {
  BarChart3,
  Bot,
  Boxes,
  CircleGauge,
  DatabaseZap,
  FileInput,
  FolderGit2,
  History,
  KeyRound,
  Settings,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: CircleGauge, active: true },
  { label: 'Features', icon: FolderGit2 },
  { label: 'Runs', icon: History },
  { label: 'Projects', icon: Boxes },
  { label: 'Adapters', icon: Bot },
  { label: 'Ingestion', icon: FileInput },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
  { label: 'Keys', icon: KeyRound },
];

interface SidebarProps {
  bridgeStatus: 'dry-run' | 'connected' | 'offline' | 'live';
}

export function Sidebar({ bridgeStatus }: SidebarProps) {
  return (
    <aside className="hidden min-h-screen border-r border-stone-200/15 bg-[#061512]/85 lg:flex lg:flex-col">
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

      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={[
              'flex h-11 w-full items-center gap-3 border-y border-transparent px-5 text-left text-xs uppercase tracking-[0.18em] transition-colors',
              item.active
                ? 'border-stone-100/80 bg-emerald-950/40 text-stone-50'
                : 'text-stone-300/72 hover:border-stone-200/20 hover:bg-white/5 hover:text-stone-100',
            ].join(' ')}
            type="button"
          >
            <item.icon size={15} />
            {item.label}
          </button>
        ))}
      </nav>

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
