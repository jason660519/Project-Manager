'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  evaluateWorkspaceAccess,
  getRoleConsoleLabel,
  type ProjectManagerCapability,
  type WorkspaceRole,
} from '../../lib/auth/permissions';
import type { WorkspaceMembership } from '../../lib/auth/workspaceMemberships';
import { isSupabaseConfigured } from '../../lib/auth/supabaseClient';
import { WorkspacePicker } from './WorkspacePicker';

interface WorkspaceAccessSurfaceProps {
  title: string;
  description: string;
  requiredCapability: ProjectManagerCapability;
  currentRole?: WorkspaceRole | null;
  activeWorkspaceId?: string | null;
  activeWorkspaceName?: string | null;
  memberships?: WorkspaceMembership[];
  onWorkspaceSelect?: (workspaceId: string) => void;
  signedIn?: boolean;
  sessionPending?: boolean;
  children: ReactNode;
}

export function WorkspaceAccessSurface({
  title,
  description,
  requiredCapability,
  currentRole = null,
  activeWorkspaceId = null,
  activeWorkspaceName = null,
  memberships = [],
  onWorkspaceSelect,
  signedIn = false,
  sessionPending = false,
  children,
}: WorkspaceAccessSurfaceProps) {
  const access = evaluateWorkspaceAccess({
    supabaseConfigured: isSupabaseConfigured(),
    signedIn,
    role: currentRole,
    requiredCapability,
  });
  const allowed = access.status === 'allowed';

  return (
    <main className="min-h-screen text-stone-100" style={{ background: 'var(--pm-bg)' }}>
      <div className="fixed inset-0 pm-bg-noise" />
      <div className="fixed inset-0 pm-bg-glow" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-5 py-6">
        <header className="border-b border-stone-200/15 pb-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded border border-amber-200/40 bg-amber-100/10 text-sm font-semibold text-amber-100">
            PM
          </div>
          <h1 className="text-2xl font-semibold text-stone-100">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">{description}</p>
        </header>

        <div className="rounded border border-stone-200/15 bg-stone-950/30">
          <div className="flex flex-col gap-3 border-b border-stone-200/15 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-100">Workspace access</h2>
              <p className="mt-1 text-xs text-stone-400">
                Required capability: <span className="font-mono">{requiredCapability}</span>
              </p>
              {activeWorkspaceName ? (
                <p className="mt-1 text-xs text-stone-500">Workspace: {activeWorkspaceName}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              {onWorkspaceSelect ? (
                <WorkspacePicker
                  memberships={memberships}
                  activeWorkspaceId={activeWorkspaceId}
                  onSelect={onWorkspaceSelect}
                  disabled={sessionPending}
                />
              ) : null}
              <div className="rounded border border-stone-200/15 bg-stone-100/5 px-3 py-2 text-xs text-stone-300">
                Role: {getRoleConsoleLabel(currentRole)}
              </div>
            </div>
          </div>

          {sessionPending ? (
            <div className="p-4 text-sm text-stone-400">Checking Supabase session and workspace membership…</div>
          ) : allowed ? (
            <div className="p-4">
              <div className="mb-4 flex items-center gap-2 rounded border border-emerald-300/25 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
                <ShieldCheck size={16} />
                {access.message}
              </div>
              {children}
            </div>
          ) : (
            <div className="p-4">
              <div className="rounded border border-amber-200/30 bg-amber-200/10 p-4 text-sm text-amber-50">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={16} />
                  Access blocked
                </div>
                <p className="mt-2 text-amber-50/80">{access.message}</p>
                {access.status === 'sign_in_required' ? (
                  <Link
                    href="/login"
                    className="mt-3 inline-flex rounded border border-amber-200/30 px-3 py-2 text-xs font-medium text-amber-50 hover:bg-amber-200/10"
                  >
                    Go to sign in
                  </Link>
                ) : null}
                {access.status !== 'sign_in_required' ? (
                  <p className="mt-2 text-amber-50/70">
                    This route intentionally withholds privileged controls until Supabase session and
                    workspace membership checks are wired.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
