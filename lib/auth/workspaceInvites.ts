import type { WorkspaceRole } from './permissions';
import { canManageWorkspaceMembers } from '../supabase/rlsContracts';
import { getSupabaseBrowserClient } from './supabaseClient';

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted' | 'revoked';
  invitedByUserId: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface WorkspaceInviteListResult {
  invites: WorkspaceInvite[];
  error: string | null;
}

export interface WorkspaceInviteCreateResult {
  invite: WorkspaceInvite | null;
  error: string | null;
}

export interface WorkspaceInviteAcceptResult {
  workspaceId: string | null;
  role: WorkspaceRole | null;
  error: string | null;
}

type WorkspaceInviteRow = {
  id?: unknown;
  workspace_id?: unknown;
  email?: unknown;
  role?: unknown;
  status?: unknown;
  invited_by_user_id?: unknown;
  created_at?: unknown;
  accepted_at?: unknown;
};

type WorkspaceInviteQuery = {
  eq: (
    column: string,
    value: string,
  ) => WorkspaceInviteQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: WorkspaceInviteRow[] | null; error: { message?: string } | null }>;
};

type WorkspaceInviteSelect = {
  select: (columns: string) => WorkspaceInviteQuery;
};

type WorkspaceMembershipRow = {
  workspace_id?: unknown;
  role?: unknown;
};

export type WorkspaceInviteClient = {
  from: (table: 'workspace_invites') => WorkspaceInviteSelect;
  rpc: (
    fn: 'pm_invite_workspace_member' | 'pm_accept_workspace_invite',
    args: Record<string, string>,
  ) => Promise<{ data: WorkspaceInviteRow | WorkspaceMembershipRow | null; error: { message?: string } | null }>;
};

const WORKSPACE_ROLES = new Set<WorkspaceRole>([
  'owner',
  'admin',
  'developer',
  'reviewer',
  'viewer',
  'user',
]);

const INVITE_STATUSES = new Set<WorkspaceInvite['status']>(['pending', 'accepted', 'revoked']);

const WORKSPACE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === 'string' && WORKSPACE_ROLES.has(value as WorkspaceRole);
}

function isInviteStatus(value: unknown): value is WorkspaceInvite['status'] {
  return typeof value === 'string' && INVITE_STATUSES.has(value as WorkspaceInvite['status']);
}

export function normalizeWorkspaceEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isWorkspaceEmail(value: string): boolean {
  return WORKSPACE_EMAIL_PATTERN.test(normalizeWorkspaceEmail(value));
}

export function normalizeWorkspaceInviteRows(rows: WorkspaceInviteRow[] | null): WorkspaceInvite[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.email !== 'string' ||
      typeof row.invited_by_user_id !== 'string' ||
      typeof row.created_at !== 'string' ||
      !isWorkspaceRole(row.role) ||
      !isInviteStatus(row.status)
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        email: row.email,
        role: row.role,
        status: row.status,
        invitedByUserId: row.invited_by_user_id,
        createdAt: row.created_at,
        acceptedAt: typeof row.accepted_at === 'string' ? row.accepted_at : null,
      },
    ];
  });
}

export async function listWorkspaceInvites(
  client: WorkspaceInviteClient = getSupabaseBrowserClient() as unknown as WorkspaceInviteClient,
  workspaceId?: string | null,
): Promise<WorkspaceInviteListResult> {
  try {
    const baseQuery = client
      .from('workspace_invites')
      .select(
        'id, workspace_id, email, role, status, invited_by_user_id, created_at, accepted_at',
      );
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('created_at', { ascending: false });

    if (error) {
      return {
        invites: [],
        error: error.message || 'Workspace invite lookup failed.',
      };
    }

    return {
      invites: normalizeWorkspaceInviteRows(data),
      error: null,
    };
  } catch (error) {
    return {
      invites: [],
      error: error instanceof Error ? error.message : 'Workspace invite lookup failed.',
    };
  }
}

export async function listPendingWorkspaceInvites(
  client: WorkspaceInviteClient = getSupabaseBrowserClient() as unknown as WorkspaceInviteClient,
): Promise<WorkspaceInviteListResult> {
  const result = await listWorkspaceInvites(client);
  if (result.error) {
    return result;
  }

  return {
    invites: result.invites.filter((invite) => invite.status === 'pending'),
    error: null,
  };
}

export async function inviteWorkspaceMemberByEmail(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  client: WorkspaceInviteClient = getSupabaseBrowserClient() as unknown as WorkspaceInviteClient,
): Promise<WorkspaceInviteCreateResult> {
  const trimmedWorkspaceId = workspaceId.trim();
  const normalizedEmail = normalizeWorkspaceEmail(email);

  if (!trimmedWorkspaceId || !normalizedEmail) {
    return {
      invite: null,
      error: 'Workspace id and email are required.',
    };
  }

  if (!isWorkspaceEmail(normalizedEmail)) {
    return {
      invite: null,
      error: 'Valid email is required.',
    };
  }

  if (!isWorkspaceRole(role)) {
    return {
      invite: null,
      error: 'Invalid workspace role.',
    };
  }

  try {
    const { data, error } = await client.rpc('pm_invite_workspace_member', {
      p_workspace_id: trimmedWorkspaceId,
      p_email: normalizedEmail,
      p_role: role,
    });

    if (error) {
      return {
        invite: null,
        error: error.message || 'Workspace invite failed.',
      };
    }

    const invites = normalizeWorkspaceInviteRows([data ?? {}]);
    if (invites.length === 0) {
      return {
        invite: null,
        error: 'Workspace invite returned malformed data.',
      };
    }

    return {
      invite: invites[0],
      error: null,
    };
  } catch (error) {
    return {
      invite: null,
      error: error instanceof Error ? error.message : 'Workspace invite failed.',
    };
  }
}

export async function acceptWorkspaceInvite(
  inviteId: string,
  client: WorkspaceInviteClient = getSupabaseBrowserClient() as unknown as WorkspaceInviteClient,
): Promise<WorkspaceInviteAcceptResult> {
  if (!inviteId.trim()) {
    return {
      workspaceId: null,
      role: null,
      error: 'Invite id is required.',
    };
  }

  try {
    const { data, error } = await client.rpc('pm_accept_workspace_invite', {
      p_invite_id: inviteId,
    });

    if (error) {
      return {
        workspaceId: null,
        role: null,
        error: error.message || 'Workspace invite accept failed.',
      };
    }

    if (
      !data ||
      typeof data.workspace_id !== 'string' ||
      !isWorkspaceRole(data.role)
    ) {
      return {
        workspaceId: null,
        role: null,
        error: 'Workspace invite accept returned malformed data.',
      };
    }

    return {
      workspaceId: data.workspace_id,
      role: data.role,
      error: null,
    };
  } catch (error) {
    return {
      workspaceId: null,
      role: null,
      error: error instanceof Error ? error.message : 'Workspace invite accept failed.',
    };
  }
}

export function canManageWorkspaceInvites(role: WorkspaceRole | null): boolean {
  return role !== null && canManageWorkspaceMembers(role);
}
