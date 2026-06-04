'use client';

import { AlertTriangle, BriefcaseBusiness, Code2, Database, ShieldCheck, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getDeniedCapabilityMessage, roleHasCapability } from '../../lib/auth/permissions';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '../../lib/auth/supabaseClient';

const capabilityRows = [
  {
    label: 'Developer Console',
    role: 'developer' as const,
    description: 'Project setup, runner pairing, agent dispatch, execution logs, and feature work.',
    capabilities: ['agent:dispatch', 'runner:pair'] as const,
    icon: Code2,
  },
  {
    label: 'User Portal',
    role: 'user' as const,
    description: 'Project progress, requirements, reports, and solution detail pages without local execution.',
    capabilities: ['project:read', 'report:read', 'solution:read'] as const,
    icon: UserRound,
  },
  {
    label: 'Admin Console',
    role: 'admin' as const,
    description: 'Workspace members, roles, integrations, settings, and audit visibility.',
    capabilities: ['members:manage', 'settings:manage', 'audit:read'] as const,
    icon: BriefcaseBusiness,
  },
];

export function LoginEntry() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  async function signInWithGitHub() {
    if (!configured) {
      setAuthMessage('Supabase is not configured yet. Add the public project URL and anon key first.');
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo =
        typeof window === 'undefined' ? undefined : `${window.location.origin}/login`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo },
      });
      if (error) setAuthMessage(error.message);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Supabase sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <main className="min-h-screen text-stone-100" style={{ background: 'var(--pm-bg)' }}>
      <div className="fixed inset-0 pm-bg-noise" />
      <div className="fixed inset-0 pm-bg-glow" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-5 py-6">
        <header className="flex flex-col gap-3 border-b border-stone-200/15 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded border border-amber-200/40 bg-amber-100/10 text-sm font-semibold text-amber-100">
              PM
            </div>
            <h1 className="text-2xl font-semibold text-stone-100">Project Manager Cloud Sign In</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
              Supabase manages workspace identity and shared product data. The desktop runner stays
              responsible for local repo access and guarded agent execution.
            </p>
          </div>

          <div className="rounded border border-stone-200/15 bg-stone-950/35 px-4 py-3 text-xs text-stone-300">
            <div className="flex items-center gap-2 font-medium text-stone-100">
              <Database size={14} />
              Cloud control plane
            </div>
            <div className="mt-1">
              Supabase: {configured ? 'configured' : 'setup required'}
            </div>
          </div>
        </header>

        {!configured && (
          <div className="rounded border border-amber-200/30 bg-amber-200/10 p-4 text-sm text-amber-50">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={16} />
              Supabase setup required
            </div>
            <p className="mt-2 text-amber-50/80">
              Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` before enabling
              real sign-in. Service-role keys must never be exposed in the browser.
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded border border-stone-200/15 bg-stone-950/30">
            <div className="border-b border-stone-200/15 px-4 py-3">
              <h2 className="text-base font-semibold text-stone-100">Role-based entry</h2>
              <p className="mt-1 text-xs text-stone-400">
                One identity system routes each workspace member to the right console.
              </p>
            </div>
            <div className="divide-y divide-stone-200/10">
              {capabilityRows.map((entry) => {
                const Icon = entry.icon;
                return (
                  <div key={entry.label} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_220px]">
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-stone-200/15 bg-stone-100/5">
                        <Icon size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-stone-100">{entry.label}</h3>
                        <p className="mt-1 text-sm leading-5 text-stone-400">{entry.description}</p>
                      </div>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-300">
                      {entry.capabilities.map((capability) => (
                        <li key={capability} className="flex items-center gap-2">
                          <ShieldCheck
                            size={14}
                            className={
                              roleHasCapability(entry.role, capability)
                                ? 'text-emerald-300'
                                : 'text-stone-500'
                            }
                          />
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded border border-stone-200/15 bg-stone-950/30 p-4">
            <h2 className="text-base font-semibold text-stone-100">Continue</h2>
            <p className="mt-2 text-sm leading-5 text-stone-400">
              Sign in first, then Project Manager reads workspace membership to select Developer,
              User, or Admin routing.
            </p>

            <button
              type="button"
              onClick={() => void signInWithGitHub()}
              disabled={!configured || authBusy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded border border-blue-400/40 bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-200/15 disabled:bg-stone-800 disabled:text-stone-500"
            >
              <Code2 size={16} />
              {authBusy ? 'Opening sign-in...' : 'Continue with GitHub'}
            </button>

            {authMessage && (
              <p className="mt-3 rounded border border-red-300/25 bg-red-950/30 px-3 py-2 text-xs leading-5 text-red-100">
                {authMessage}
              </p>
            )}

            <div className="mt-5 border-t border-stone-200/10 pt-4 text-xs leading-5 text-stone-400">
              <p>{getDeniedCapabilityMessage('agent:dispatch')}</p>
              <p className="mt-2">
                General Users can inspect progress and reports without installing a local runner.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
