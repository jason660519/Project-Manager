'use client';

import Link from 'next/link';
import {
  BookOpen,
  Boxes,
  CircleGauge,
  Files,
  FileText,
  KeyRound,
  Plug,
  Radio,
  ScrollText,
  Settings,
  ShieldCheck,
  Timer,
  Users2,
} from 'lucide-react';
import { ViewId } from '../../lib/types';

const NAV_ITEMS: Array<{
  id: ViewId;
  label: string;
  href: string;
  hint: string;
  icon: React.ComponentType<{ size: number }>;
}> =
  [
    {
      id: 'projects',
      label: 'Projects',
      href: '/projects',
      hint: 'Switch projects and manage project-level configuration.',
      icon: Boxes,
    },
    {
      id: 'dashboard',
      label: 'Project Progress Dashboard',
      href: '/project-progress-dashboard',
      hint: 'Overview metrics and project health at a glance.',
      icon: CircleGauge,
    },
    {
      id: 'project-files',
      label: 'Project Files',
      href: '/project-files',
      hint: 'Browse all files under your selected projects.',
      icon: Files,
    },
    {
      id: 'plugins',
      label: 'Plugins',
      href: '/plugins',
      hint: 'Configure AI providers, agent CLIs, and IDE integrations.',
      icon: Plug,
    },
    {
      id: 'engineers',
      label: 'AI Engineers',
      href: '/engineers',
      hint: 'Configure engineer role presets — skills, system prompts, reference files.',
      icon: Users2,
    },
    {
      id: 'sessions',
      label: 'Sessions',
      href: '/sessions',
      hint: 'Browse and search all AI agent conversation histories.',
      icon: ScrollText,
    },
    {
      id: 'channels',
      label: 'Channels',
      href: '/channels',
      hint: 'Configure messaging channels (Telegram, WhatsApp, LINE, WeChat) to control DevPilot from your phone.',
      icon: Radio,
    },
    {
      id: 'cron-jobs',
      label: 'Cron Jobs',
      href: '/cron-jobs',
      hint: 'Schedule recurring commands to run automatically while the app is open.',
      icon: Timer,
    },
    {
      id: 'logs',
      label: 'Logs',
      href: '/logs',
      hint: 'Agent run logs, cron job history, and feature dev logs in one place.',
      icon: FileText,
    },
    {
      id: 'documentation',
      label: 'Documentation',
      href: '/documentation',
      hint: 'Hermes Agent API reference — browse endpoints, params, and responses.',
      icon: BookOpen,
    },
    {
      id: 'keys',
      label: 'Keys',
      href: '/keys',
      hint: 'Manage API keys and tokens. Stored in OS Keychain.',
      icon: KeyRound,
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/settings',
      hint: 'Adjust bridge behavior and workspace preferences.',
      icon: Settings,
    },
  ];

interface SidebarProps {
  currentView: ViewId;
  bridgeStatus: 'dry-run' | 'connected' | 'offline' | 'live';
  activeRunCount: number;
}

export function Sidebar({ currentView, bridgeStatus, activeRunCount }: SidebarProps) {
  return (
    <aside className="hidden min-h-screen w-[68px] border-r border-stone-200/15 bg-[#061512]/95 lg:flex lg:flex-col">
      <div className="flex h-16 items-center justify-center border-b border-stone-200/15">
        <div className="inline-flex h-9 w-9 items-center justify-center border border-amber-200/25 text-[11px] font-black tracking-normal text-amber-100/90">
          DP
        </div>
      </div>

      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={[
              'group relative mx-2 mb-1 flex h-11 items-center justify-center border transition-colors',
              item.id === currentView
                ? 'border-stone-100/80 bg-emerald-950/50 text-stone-50'
                : 'border-transparent text-stone-300/78 hover:border-stone-200/20 hover:bg-white/5 hover:text-stone-100',
            ].join(' ')}
          >
            <item.icon size={17} />

            <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 hidden w-56 -translate-y-1/2 border border-stone-200/20 bg-[#061512] p-3 text-left group-hover:block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-100">
                {item.label}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-stone-300/85">{item.hint}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-stone-200/15 py-4">
        <div className="group relative flex justify-center">
          <div className="inline-flex h-9 w-9 items-center justify-center border border-emerald-200/20 text-emerald-100">
            <ShieldCheck size={16} />
          </div>
          <span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-[calc(100%+10px)] z-50 hidden w-56 border border-stone-200/20 bg-[#061512] p-3 text-left group-hover:block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-100">
              System Status
            </span>
            <span className="mt-1 block text-[11px] leading-4 text-stone-300/85">
              Bridge: {bridgeStatus.toUpperCase()} · Execution: GUARDED
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
