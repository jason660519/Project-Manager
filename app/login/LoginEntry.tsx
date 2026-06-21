'use client';

import { AlertTriangle, BriefcaseBusiness, Code2, Database, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getDeniedCapabilityMessage,
  getRoleConsoleLabel,
  resolveWorkspaceDestination,
  roleHasCapability,
} from '../../lib/auth/permissions';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '../../lib/auth/supabaseClient';
import { signInWithEmailPassword as signInWithEmailPasswordRequest } from '../../lib/auth/supabaseAuthSession';
import { useWorkspaceSession } from '../../lib/auth/workspaceSession';
import { WorkspaceOnboardingPanel } from './WorkspaceOnboardingPanel';

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
  const [configured, setConfigured] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);
  const { signedIn, userEmail, role, loading, error, signOut, refreshSession } = useWorkspaceSession();
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  async function signInWithEmailPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setAuthMessage('Supabase is not configured yet. Add the public project URL and anon key first.');
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const result = await signInWithEmailPasswordRequest(email, password);
      if (result.error) {
        setAuthMessage(result.error);
        return;
      }

      if (!result.user) {
        setAuthMessage('Supabase email sign-in did not return a user session.');
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Supabase sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  const destination = role ? resolveWorkspaceDestination(role) : '/login?state=missing-membership';

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

            {loading ? (
              <p className="mt-4 text-sm text-stone-400">Checking Supabase session…</p>
            ) : null}

            {!loading && signedIn ? (
              <div className="mt-4 space-y-3">
                <div className="rounded border border-emerald-300/25 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
                  Signed in{userEmail ? ` as ${userEmail}` : ''}.
                  {role ? ` Active role: ${getRoleConsoleLabel(role)}.` : ' No workspace membership yet.'}
                </div>

                {role ? (
                  <button
                    type="button"
                    onClick={() => router.push(destination)}
                    className="flex w-full items-center justify-center gap-2 rounded border border-emerald-300/30 bg-emerald-900/40 px-3 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-900/60"
                  >
                    Continue to {getRoleConsoleLabel(role)}
                  </button>
                ) : (
                  <>
                    <p className="rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-xs leading-5 text-amber-50">
                      Your Supabase account is signed in, but no workspace membership row is visible yet.
                      Create a workspace or accept a pending email invite below.
                    </p>
                    <WorkspaceOnboardingPanel
                      userEmail={userEmail}
                      onSessionRefresh={refreshSession}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="w-full rounded border border-stone-200/20 px-3 py-2 text-sm text-stone-300 hover:bg-stone-100/5"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <button
                  type="button"
                  onClick={() => void signInWithGitHub()}
                  disabled={!configured || authBusy}
                  className="flex w-full items-center justify-center gap-2 rounded border border-blue-400/40 bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-200/15 disabled:bg-stone-800 disabled:text-stone-500"
                >
                  <Code2 size={16} />
                  {authBusy ? 'Opening sign-in...' : 'Continue with GitHub'}
                </button>

                <div className="border-t border-stone-200/10 pt-4">
                  <p className="text-xs leading-5 text-stone-400">
                    Email sign-in for local Supabase when GitHub OAuth is unavailable.
                  </p>
                  <form className="mt-3 space-y-3" onSubmit={(event) => void signInWithEmailPassword(event)}>
                    <label className="block text-xs text-stone-300">
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={!configured || authBusy}
                        className="mt-1 w-full rounded border border-stone-200/20 bg-stone-950/50 px-3 py-2 text-sm text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
                      />
                    </label>
                    <label className="block text-xs text-stone-300">
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={!configured || authBusy}
                        className="mt-1 w-full rounded border border-stone-200/20 bg-stone-950/50 px-3 py-2 text-sm text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!configured || authBusy}
                      className="w-full rounded border border-stone-200/20 px-3 py-2 text-sm font-medium text-stone-100 hover:bg-stone-100/5 disabled:cursor-not-allowed disabled:text-stone-500"
                    >
                      {authBusy ? 'Signing in…' : 'Sign in with email'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {(authMessage || error) && (
              <p className="mt-3 rounded border border-red-300/25 bg-red-950/30 px-3 py-2 text-xs leading-5 text-red-100">
                {authMessage ?? error}
              </p>
            )}

            <div className="mt-5 border-t border-stone-200/10 pt-4 text-xs leading-5 text-stone-400">
              <p>{getDeniedCapabilityMessage('agent:dispatch')}</p>
              <p className="mt-2">
                General Users can inspect progress and reports without installing a local runner.
              </p>
              {signedIn && role ? (
                <p className="mt-2">
                  Or open your console directly:{' '}
                  <Link href={destination} className="text-emerald-300 hover:text-emerald-200">
                    {destination}
                  </Link>
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
