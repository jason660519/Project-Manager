'use client';

import Link from 'next/link';
import {
  Activity,
  BookOpen,
  CircleGauge,
  Files,
  FileText,
  KeyRound,
  MessageSquareText,
  Plug,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Timer,
  Users2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { checkUpdate } from '../../lib/bridge';
import { ChatPanel } from '../../components/chat/ChatPanel';
import type { ChatContext } from '../../lib/chat/types';
import { useI18n } from '../../lib/i18n';
import type { Translations } from '../../lib/i18n';
import { ViewId } from '../../lib/types';

interface NavItem {
  id: ViewId;
  itemKey: keyof Translations['navItems'];
  href: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
}

interface NavGroup {
  groupKey: keyof Translations['navGroups'];
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'workspace',
    items: [
      { id: 'dashboard',     itemKey: 'dashboard', href: '/project-progress-dashboard', icon: CircleGauge },
      { id: 'coding-editor', itemKey: 'codingEditor', href: '/coding-editor',           icon: Files },
    ],
  },
  {
    groupKey: 'execution',
    items: [
      { id: 'keys',             itemKey: 'keys',            href: '/keys',                     icon: KeyRound },
      { id: 'integrations-hub', itemKey: 'integrationsHub', href: '/integrations-hub',         icon: Plug },
      { id: 'cron-jobs',        itemKey: 'cronJobs',        href: '/cron-jobs',                icon: Timer },
      { id: 'engineers',        itemKey: 'engineers',       href: '/engineers',                icon: Users2 },
    ],
  },
  {
    groupKey: 'observe',
    items: [
      { id: 'sessions', itemKey: 'sessions', href: '/sessions', icon: ScrollText },
      { id: 'logs',     itemKey: 'logs',     href: '/logs',     icon: FileText },
      { id: 'chat',     itemKey: 'chat',     href: '/chat',     icon: MessageSquareText },
    ],
  },
  {
    groupKey: 'system',
    items: [
      { id: 'settings',      itemKey: 'settings', href: '/settings',      icon: Settings },
      { id: 'documentation', itemKey: 'docs',     href: '/documentation', icon: BookOpen },
    ],
  },
];

interface SidebarProps {
  currentView: ViewId;
  bridgeStatus: 'dry-run' | 'connected' | 'offline' | 'live';
  activeRunCount: number;
  chatContext: ChatContext;
}

export function Sidebar({ currentView, bridgeStatus, activeRunCount, chatContext }: SidebarProps) {
  const isLive = bridgeStatus === 'live';
  const { t } = useI18n();

  // Defer isTauri to client-side to avoid SSR/client hydration mismatch.
  const [isTauri, setIsTauri] = useState(false);
  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  // Update check
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCheckUpdate = useCallback(async () => {
    if (updateLoading) return;
    setUpdateLoading(true);
    setUpdateMsg(null);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    try {
      const result = await checkUpdate();
      setUpdateMsg(
        result.hasUpdate
          ? t.system.updateAvailable.replace('{version}', result.latest ?? '')
          : t.system.upToDate
      );
    } catch {
      setUpdateMsg(t.system.checkFailed);
    } finally {
      setUpdateLoading(false);
      clearTimer.current = setTimeout(() => setUpdateMsg(null), 3000);
    }
  }, [updateLoading, t]);

  return (
    <aside
      className="relative hidden min-h-screen w-[180px] border-r border-stone-200/15 lg:flex lg:flex-col"
      style={{ background: 'var(--pm-sidebar)' }}
    >
      {/* Logo — h-12 matches TopBar so horizontal dividers align */}
      <div className="flex h-12 items-center gap-2.5 border-b border-stone-200/15 px-4">
        <div className="flex h-7 w-7 items-center justify-center border border-amber-200/30 text-[10px] font-black tracking-wide text-amber-100/90 shrink-0">
          PM
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300/70">
          Project Mgr
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupKey} className="mb-3">
            <p className="px-4 pb-1 pt-2 text-[9px] font-semibold tracking-[0.2em] text-stone-500/70 uppercase">
              {t.navGroups[group.groupKey]}
            </p>
            {group.items.map((item) => {
              const active = item.id === currentView;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={[
                    'mx-2 flex h-8 items-center gap-2.5 px-2.5 text-[11px] font-medium tracking-[0.06em] transition-colors',
                    active
                      ? 'border border-stone-100/60 text-stone-50'
                      : 'border border-transparent text-stone-400/80 hover:border-stone-200/15 hover:bg-white/5 hover:text-stone-200',
                  ].join(' ')}
                  style={active ? { background: 'var(--pm-active-bg)' } : undefined}
                >
                  <item.icon size={13} className="shrink-0 opacity-80" />
                  <span>{t.navItems[item.itemKey]}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom system block ───────────────────────────────────────────── */}
      <div className="border-t border-stone-200/15 px-4 py-3 space-y-2">

        {/* Bridge / run status */}
        <div className="flex items-center gap-2">
          {isLive
            ? <Wifi size={11} className="text-emerald-400 shrink-0" />
            : <WifiOff size={11} className="text-amber-400/80 shrink-0" />}
          <span className={`text-[10px] font-medium tracking-[0.08em] uppercase ${isLive ? 'text-emerald-300/80' : 'text-amber-300/70'}`}>
            {bridgeStatus}
          </span>
        </div>

        {activeRunCount > 0 && (
          <div className="flex items-center gap-2">
            <Activity size={11} className="text-cyan-400 shrink-0 animate-pulse" />
            <span className="text-[10px] font-medium tracking-[0.08em] text-cyan-300/80">
              {t.system.runsActive.replace('{count}', String(activeRunCount))}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ShieldCheck size={11} className="text-stone-500 shrink-0" />
          <span className="text-[10px] text-stone-500/60 tracking-[0.06em]">{t.system.guarded}</span>
        </div>

        {/* Check for Updates — Tauri only */}
        {isTauri && (
          <div>
            <button
              onClick={handleCheckUpdate}
              disabled={updateLoading}
              className="flex items-center gap-1.5 text-[10px] tracking-[0.06em] text-stone-500/70 hover:text-stone-300/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={10} className={`shrink-0 ${updateLoading ? 'animate-spin' : ''}`} />
              <span>{t.system.checkForUpdates}</span>
            </button>
            {updateMsg && (
              <p className={`mt-0.5 text-[9px] tracking-[0.06em] ${
                updateMsg.startsWith('Update') || updateMsg.startsWith('有更新') || updateMsg.startsWith('アップデート')
                  ? 'text-emerald-400/80'
                  : updateMsg === t.system.upToDate
                    ? 'text-stone-400/60'
                    : 'text-amber-400/70'
              }`}>
                {updateMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Version + link */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="text-[9px] text-stone-600/60 font-mono">v0.1.0</span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] tracking-[0.1em] text-stone-600/50 uppercase hover:text-stone-400/70 transition-colors"
        >
          Project Mgr →
        </a>
      </div>
    </aside>
  );
}
