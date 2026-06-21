'use client';

import { Loader2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addWorkspaceMember,
  canEditWorkspaceMemberRole,
  formatWorkspaceRoleLabel,
  listAssignableWorkspaceRoles,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type AdminWorkspaceMember,
} from '../../lib/auth/workspaceMembers';
import type { WorkspaceRole } from '../../lib/auth/permissions';
import {
  inviteWorkspaceMemberByEmail,
  listWorkspaceInvites,
  type WorkspaceInvite,
} from '../../lib/auth/workspaceInvites';
import { canManageWorkspaceMembers, canReadWorkspaceMembers } from '../../lib/supabase/rlsContracts';

interface AdminMembersPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
  actorUserId: string | null;
}

export function AdminMembersPanel({
  workspaceRole,
  workspaceId,
  actorUserId,
}: AdminMembersPanelProps) {
  const [members, setMembers] = useState<AdminWorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingMembershipId, setPendingMembershipId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('viewer');
  const [pendingAdd, setPendingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [emailInviteRole, setEmailInviteRole] = useState<WorkspaceRole>('viewer');
  const [pendingEmailInvite, setPendingEmailInvite] = useState(false);
  const [emailInviteError, setEmailInviteError] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const canManageMembers = workspaceRole !== null && canManageWorkspaceMembers(workspaceRole);
  const assignableRoles = useMemo(
    () =>
      workspaceRole && canManageMembers ? listAssignableWorkspaceRoles(workspaceRole) : [],
    [canManageMembers, workspaceRole],
  );

  const loadMembers = useCallback(async () => {
    if (!workspaceRole || !workspaceId || !canReadWorkspaceMembers(workspaceRole)) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await listWorkspaceMembers(undefined, workspaceId);
    setMembers(result.members);
    setError(result.error);
    setLoading(false);
  }, [workspaceRole, workspaceId]);

  const loadInvites = useCallback(async () => {
    if (!workspaceId || !canManageMembers) {
      setPendingInvites([]);
      setLoadingInvites(false);
      return;
    }

    setLoadingInvites(true);
    const result = await listWorkspaceInvites(undefined, workspaceId);
    setPendingInvites(result.invites.filter((invite) => invite.status === 'pending'));
    setLoadingInvites(false);
  }, [canManageMembers, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!workspaceRole || !workspaceId || !canReadWorkspaceMembers(workspaceRole)) {
        if (!cancelled) {
          setMembers([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      const result = await listWorkspaceMembers(undefined, workspaceId);
      if (cancelled) return;

      setMembers(result.members);
      setError(result.error);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceRole, workspaceId]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function handleRoleChange(member: AdminWorkspaceMember, newRole: WorkspaceRole) {
    if (!workspaceRole || member.role === newRole) {
      return;
    }

    if (!canEditWorkspaceMemberRole(workspaceRole, actorUserId, member)) {
      setActionError('You do not have permission to change this member role.');
      return;
    }

    setPendingMembershipId(member.id);
    setActionError(null);
    const result = await updateWorkspaceMemberRole(member.id, newRole);
    setPendingMembershipId(null);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    if (result.member) {
      setMembers((current) =>
        current.map((entry) => (entry.id === result.member?.id ? result.member : entry)),
      );
    } else {
      await loadMembers();
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !canManageMembers) {
      return;
    }

    setPendingAdd(true);
    setAddError(null);
    const result = await addWorkspaceMember(workspaceId, inviteUserId, inviteRole);
    setPendingAdd(false);

    if (result.error) {
      setAddError(result.error);
      return;
    }

    if (result.member) {
      setMembers((current) => [...current, result.member!]);
      setInviteUserId('');
      setInviteRole('viewer');
    } else {
      await loadMembers();
    }
  }

  async function handleEmailInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !canManageMembers) {
      return;
    }

    setPendingEmailInvite(true);
    setEmailInviteError(null);
    const result = await inviteWorkspaceMemberByEmail(workspaceId, inviteEmail, emailInviteRole);
    setPendingEmailInvite(false);

    if (result.error) {
      setEmailInviteError(result.error);
      return;
    }

    if (result.invite) {
      setPendingInvites((current) => [result.invite!, ...current]);
      setInviteEmail('');
      setEmailInviteRole('viewer');
    } else {
      await loadInvites();
    }
  }

  async function handleRemoveMember(member: AdminWorkspaceMember) {
    if (!workspaceRole || !canEditWorkspaceMemberRole(workspaceRole, actorUserId, member)) {
      setActionError('You do not have permission to remove this member.');
      return;
    }

    setPendingMembershipId(member.id);
    setActionError(null);
    const result = await removeWorkspaceMember(member.id);
    setPendingMembershipId(null);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setMembers((current) => current.filter((entry) => entry.id !== member.id));
  }

  if (!workspaceRole || !canReadWorkspaceMembers(workspaceRole)) {
    return null;
  }

  return (
    <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Workspace members</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Membership roster for the active workspace. Role changes, adds, removals, and email
        invites are audited in cloud Postgres. UUID adds are for local/dev; invitees accept on
        the login page when signed in with the invited email.
      </p>

      {canManageMembers ? (
        <>
          <form
            className="mt-4 space-y-3 rounded border border-stone-200/15 bg-stone-950/20 p-3"
            onSubmit={handleEmailInvite}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-300">
              Invite by email
            </h3>
            <label className="block text-xs text-stone-300">
              Email address
              <input
                type="email"
                value={inviteEmail}
                disabled={pendingEmailInvite}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@example.com"
                className="mt-1 w-full rounded border border-stone-200/20 bg-stone-950/50 px-2 py-1.5 text-sm text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-300">
              Role
              <select
                value={emailInviteRole}
                disabled={pendingEmailInvite}
                aria-label="Invite role"
                onChange={(event) => setEmailInviteRole(event.target.value as WorkspaceRole)}
                className="rounded border border-stone-200/20 bg-stone-950/50 px-2 py-1 text-xs text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatWorkspaceRoleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={pendingEmailInvite || !inviteEmail.trim()}
              className="rounded border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 text-xs font-medium text-amber-50 outline-none ring-amber-200/30 hover:bg-amber-200/15 focus:ring-1 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-stone-950/30 disabled:text-stone-500"
            >
              {pendingEmailInvite ? 'Sending invite…' : 'Create email invite'}
            </button>
            {emailInviteError ? (
              <p className="rounded border border-red-300/25 bg-red-950/30 px-3 py-2 text-sm text-red-100">
                {emailInviteError}
              </p>
            ) : null}
          </form>

          <form className="mt-4 space-y-3 rounded border border-stone-200/15 bg-stone-950/20 p-3" onSubmit={handleAddMember}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-300">
              Add member by UUID
            </h3>
          <label className="block text-xs text-stone-300">
            Supabase user id
            <input
              type="text"
              value={inviteUserId}
              disabled={pendingAdd}
              onChange={(event) => setInviteUserId(event.target.value)}
              placeholder="a0000000-0000-4000-8000-000000000010"
              className="mt-1 w-full rounded border border-stone-200/20 bg-stone-950/50 px-2 py-1.5 font-mono text-xs text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-300">
            Role
            <select
              value={inviteRole}
              disabled={pendingAdd}
              aria-label="New member role"
              onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
              className="rounded border border-stone-200/20 bg-stone-950/50 px-2 py-1 text-xs text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {formatWorkspaceRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pendingAdd || !inviteUserId.trim()}
            className="rounded border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 text-xs font-medium text-amber-50 outline-none ring-amber-200/30 hover:bg-amber-200/15 focus:ring-1 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-stone-950/30 disabled:text-stone-500"
          >
            {pendingAdd ? 'Adding…' : 'Add member'}
          </button>
          {addError ? (
            <p className="rounded border border-red-300/25 bg-red-950/30 px-3 py-2 text-sm text-red-100">
              {addError}
            </p>
          ) : null}
        </form>

          {loadingInvites ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
              <Loader2 size={14} className="animate-spin" />
              Loading pending invites…
            </div>
          ) : null}

          {!loadingInvites && pendingInvites.length > 0 ? (
            <div className="mt-4 rounded border border-stone-200/15 bg-stone-950/20 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-300">
                Pending email invites
              </h3>
              <ul className="mt-3 space-y-2">
                {pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-2 text-xs text-stone-300"
                  >
                    <span className="font-mono text-stone-100">{invite.email}</span>
                    <span className="ml-2 rounded border border-stone-200/20 px-2 py-0.5 uppercase tracking-wide text-stone-400">
                      {formatWorkspaceRoleLabel(invite.role)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading members…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && actionError ? (
        <p className="mt-4 rounded border border-red-300/25 bg-red-950/30 px-3 py-2 text-sm text-red-100">
          {actionError}
        </p>
      ) : null}

      {!loading && !error && members.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">No members are registered for this workspace.</p>
      ) : null}

      {!loading && !error && members.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {members.map((member) => {
            const editable =
              workspaceRole !== null &&
              canEditWorkspaceMemberRole(workspaceRole, actorUserId, member);
            const isPending = pendingMembershipId === member.id;

            return (
              <li
                key={member.id}
                className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono text-sm font-medium text-stone-100">{member.userId}</h3>
                  {editable ? (
                    <label className="flex items-center gap-2 text-xs text-stone-300">
                      Role
                      <select
                        value={member.role}
                        disabled={isPending}
                        aria-label={`Role for ${member.userId}`}
                        onChange={(event) =>
                          void handleRoleChange(member, event.target.value as WorkspaceRole)
                        }
                        className="rounded border border-stone-200/20 bg-stone-950/50 px-2 py-1 text-xs text-stone-100 outline-none ring-amber-200/30 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
                      >
                        {assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {formatWorkspaceRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                      {formatWorkspaceRoleLabel(member.role)}
                    </span>
                  )}
                  {isPending ? (
                    <Loader2 size={14} className="animate-spin text-stone-400" />
                  ) : null}
                  {editable ? (
                    <button
                      type="button"
                      disabled={isPending}
                      aria-label={`Remove ${member.userId}`}
                      onClick={() => void handleRemoveMember(member)}
                      className="rounded border border-red-300/25 bg-red-950/30 px-2 py-1 text-[11px] font-medium text-red-100 outline-none ring-red-300/30 hover:bg-red-950/45 focus:ring-1 disabled:cursor-not-allowed disabled:text-stone-500"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Joined {new Date(member.joinedAt).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
