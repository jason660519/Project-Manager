'use client';

import type { ReactNode } from 'react';
import { ViewId } from '../../lib/types';
import { I18nProvider } from '../../lib/i18n';
import type { ChatContext } from '../../lib/chat/types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: ReactNode;
  currentView: ViewId;
  bridgeStatus: 'dry-run' | 'connected' | 'offline' | 'live';
  activeRunCount: number;
  chatContext: ChatContext;
}

export function AppShell({
  children,
  currentView,
  bridgeStatus,
  activeRunCount,
  chatContext,
}: AppShellProps) {
  return (
    <I18nProvider>
    <main className="min-h-screen text-stone-100" style={{ background: 'var(--pm-bg)' }}>
      {/* Grid noise layer */}
      <div className="fixed inset-0 pm-bg-noise" />
      {/* Radial glow layer — theme-aware via CSS vars */}
      <div className="fixed inset-0 pm-bg-glow" />
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)]">
        <Sidebar
          currentView={currentView}
          bridgeStatus={bridgeStatus}
          activeRunCount={activeRunCount}
          chatContext={chatContext}
        />
        <div className="flex min-w-0 flex-col border-l border-stone-200/15">
          <TopBar currentView={currentView} activeRunCount={activeRunCount} chatContext={chatContext} />
          <div
            className={
              currentView === 'cmux' || currentView === 'xmux'
                ? 'flex-1 min-h-0 overflow-hidden'
                : 'flex-1 overflow-y-auto px-5 py-5'
            }
          >
            {children}
          </div>
        </div>
      </div>
    </main>
    </I18nProvider>
  );
}
