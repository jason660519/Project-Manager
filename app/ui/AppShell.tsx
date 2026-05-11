'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  children: ReactNode;
  projectName: string;
  projectRoot: string;
  bridgeStatus: 'dry-run' | 'connected' | 'offline' | 'live';
}

export function AppShell({
  children,
  projectName,
  projectRoot,
  bridgeStatus,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#071b18] text-stone-100">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(214,185,118,0.12),transparent_38%),linear-gradient(135deg,rgba(14,63,56,0.9),rgba(4,18,17,0.98)_62%)]" />
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar bridgeStatus={bridgeStatus} />
        <div className="min-w-0 border-l border-stone-200/15">
          <Topbar projectName={projectName} projectRoot={projectRoot} bridgeStatus={bridgeStatus} />
          <div className="px-4 py-4 sm:px-6 lg:px-7 lg:py-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
