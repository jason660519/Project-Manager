'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { resolveWorkspaceDestination } from '../../lib/auth/permissions';
import { createWorkspace } from '../../lib/auth/workspaces';
import {
  acceptWorkspaceInvite,
  listPendingWorkspaceInvites,
  type WorkspaceInvite,
} from '../../lib/auth/workspaceInvites';

interface WorkspaceOnboardingPanelProps {
  userEmail: string | null;
  onSessionRefresh: () => Promise<void>;
}

export function WorkspaceOnboardingPanel({
  userEmail,
  onSessionRefresh,
}: WorkspaceOnboardingPanelProps) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState('');
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [creating, setCreating] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setLoadingInvites(true);
    const result = await listPendingWorkspaceInvites();
    setPendingInvites(result.invites);
    setLoadingInvites(false);
    if (result.error) {
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingInvites(true);
      const result = await listPendingWorkspaceInvites();
      if (cancelled) return;
      setPendingInvites(result.invites);
      setLoadingInvites(false);
      if (result.error) {
        setError(result.error);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    const result = await createWorkspace(workspaceName);
    setCreating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    await onSessionRefresh();
    router.push('/admin');
  }

  async function handleAcceptInvite(invite: WorkspaceInvite) {
    setAcceptingInviteId(invite.id);
    setError(null);

    const result = await acceptWorkspaceInvite(invite.id);
    setAcceptingInviteId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    await onSessionRefresh();
    router.push(result.role ? resolveWorkspaceDestination(result.role) : '/portal');
  }

  return (
    <div className="mt-4 space-y-4">
      {loadingInvites ? (
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Checking pending workspace invites…
        </div>
      ) : null}

      {!loadingInvites && pendingInvites.length > 0 ? (
        <div className="rounded border border-stone-200/15 bg-stone-950/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-300">
            Pending invites
          </h3>
          <p className="mt-1 text-xs leading-5 text-stone-400">
            Accept a workspace invite for {userEmail ?? 'your signed-in account'}.
          </p>
          <ul className="mt-3 space-y-2">
            {pendingInvites.map((invite) => {
              const isAccepting = acceptingInviteId === invite.id;
              return (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-stone-200/15 bg-stone-950/30 px-3 py-2"
                >
                  <span className="font-mono text-xs text-stone-200">{invite.email}</span>
                  <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                    {invite.role}
                  </span>
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={() => void handleAcceptInvite(invite)}
                    className="rounded border border-emerald-300/30 bg-emerald-900/40 px-2 py-1 text-[11px] font-medium text-emerald-50 hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:text-stone-500"
                  >
                    {isAccepting ? 'Accepting…' : 'Accept invite'}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => void loadInvites()}
            className="mt-3 text-xs text-stone-400 underline-offset-2 hover:text-stone-200 hover:underline"
          >
            Refresh invites
          </button>
        </div>
      ) : null}

      <form
        className="rounded border border-stone-200/15 bg-stone-950/20 p-3"
        onSubmit={handleCreateWorkspace}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-300">
          Create a workspace
        </h3>
        <p className="mt-1 text-xs leading-5 text-stone-400">
          Start a new cloud workspace as owner. Email delivery for invites is recorded in Postgres;
          outbound mail lands in a later slice.
        </p>
        <label className="mt-3 block text-xs text-stone-300">
          Workspace name
          <input
            type="text"
            value={workspaceName}
            disabled={creating}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="Acme Delivery Team"
            className="mt-1 w-full rounded border border-stone-200/20 bg-stone-950/50 px-3 py-2 text-sm text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
          />
        </label>
        <button
          type="submit"
          disabled={creating || !workspaceName.trim()}
          className="mt-3 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-amber-200/15 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-stone-950/30 disabled:text-stone-500"
        >
          {creating ? 'Creating…' : 'Create workspace'}
        </button>
      </form>

      {error ? (
        <p className="rounded border border-red-300/25 bg-red-950/30 px-3 py-2 text-xs leading-5 text-red-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
