import type { WorkspaceRole } from './permissions';
import { canManageWorkspaceMembers } from '../supabase/rlsContracts';
import { getSupabaseBrowserClient } from './supabaseClient';

export const WORKSPACE_ASSIGNABLE_ROLES: WorkspaceRole[] = [
  'owner',
  'admin',
  'developer',
  'reviewer',
  'viewer',
  'user',
];

export interface AdminWorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface AdminWorkspaceMemberListResult {
  members: AdminWorkspaceMember[];
  error: string | null;
}

export interface AdminWorkspaceMemberUpdateResult {
  member: AdminWorkspaceMember | null;
  error: string | null;
}

export interface AdminWorkspaceMemberAddResult {
  member: AdminWorkspaceMember | null;
  error: string | null;
}

export interface AdminWorkspaceMemberRemoveResult {
  member: AdminWorkspaceMember | null;
  error: string | null;
}

type WorkspaceMemberRow = {
  id?: unknown;
  workspace_id?: unknown;
  user_id?: unknown;
  role?: unknown;
  created_at?: unknown;
};

type WorkspaceMemberQuery = {
  eq: (
    column: string,
    value: string,
  ) => WorkspaceMemberQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: WorkspaceMemberRow[] | null; error: { message?: string } | null }>;
};

type WorkspaceMemberSelect = {
  select: (columns: string) => WorkspaceMemberQuery;
};

export type WorkspaceMemberClient = {
  from: (table: 'workspace_memberships') => WorkspaceMemberSelect;
  rpc: (
    fn:
      | 'pm_update_workspace_member_role'
      | 'pm_add_workspace_member'
      | 'pm_remove_workspace_member',
    args: Record<string, string>,
  ) => Promise<{ data: WorkspaceMemberRow | null; error: { message?: string } | null }>;
};

const WORKSPACE_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WORKSPACE_ROLES = new Set<WorkspaceRole>([
  'owner',
  'admin',
  'developer',
  'reviewer',
  'viewer',
  'user',
]);

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === 'string' && WORKSPACE_ROLES.has(value as WorkspaceRole);
}

export function isWorkspaceUserId(value: string): boolean {
  return WORKSPACE_USER_ID_PATTERN.test(value.trim());
}

function normalizeAddedMemberRow(data: WorkspaceMemberRow | null): AdminWorkspaceMember | null {
  const members = normalizeWorkspaceMemberRows([data ?? {}]);
  return members[0] ?? null;
}

export function normalizeWorkspaceMemberRows(
  rows: WorkspaceMemberRow[] | null,
): AdminWorkspaceMember[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.user_id !== 'string' ||
      typeof row.created_at !== 'string' ||
      !isWorkspaceRole(row.role)
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        role: row.role,
        joinedAt: row.created_at,
      },
    ];
  });
}

export async function listWorkspaceMembers(
  client: WorkspaceMemberClient = getSupabaseBrowserClient() as unknown as WorkspaceMemberClient,
  workspaceId?: string | null,
): Promise<AdminWorkspaceMemberListResult> {
  try {
    const baseQuery = client
      .from('workspace_memberships')
      .select('id, workspace_id, user_id, role, created_at');
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('created_at', { ascending: true });

    if (error) {
      return {
        members: [],
        error: error.message || 'Workspace member lookup failed.',
      };
    }

    return {
      members: normalizeWorkspaceMemberRows(data),
      error: null,
    };
  } catch (error) {
    return {
      members: [],
      error: error instanceof Error ? error.message : 'Workspace member lookup failed.',
    };
  }
}

export function formatWorkspaceRoleLabel(role: WorkspaceRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'developer':
      return 'Developer';
    case 'reviewer':
      return 'Reviewer';
    case 'viewer':
      return 'Viewer';
    case 'user':
      return 'User';
    default:
      return role;
  }
}

export function listAssignableWorkspaceRoles(actorRole: WorkspaceRole): WorkspaceRole[] {
  if (actorRole === 'owner') {
    return WORKSPACE_ASSIGNABLE_ROLES;
  }

  return WORKSPACE_ASSIGNABLE_ROLES.filter((role) => role !== 'owner');
}

export function canEditWorkspaceMemberRole(
  actorRole: WorkspaceRole,
  actorUserId: string | null,
  member: AdminWorkspaceMember,
): boolean {
  if (!canManageWorkspaceMembers(actorRole)) {
    return false;
  }

  if (!actorUserId || actorUserId === member.userId) {
    return false;
  }

  if (actorRole === 'admin' && member.role === 'owner') {
    return false;
  }

  return true;
}

export async function updateWorkspaceMemberRole(
  membershipId: string,
  newRole: WorkspaceRole,
  client: WorkspaceMemberClient = getSupabaseBrowserClient() as unknown as WorkspaceMemberClient,
): Promise<AdminWorkspaceMemberUpdateResult> {
  if (!membershipId.trim()) {
    return {
      member: null,
      error: 'Membership id is required.',
    };
  }

  if (!isWorkspaceRole(newRole)) {
    return {
      member: null,
      error: 'Invalid workspace role.',
    };
  }

  try {
    const { data, error } = await client.rpc('pm_update_workspace_member_role', {
      p_membership_id: membershipId,
      p_new_role: newRole,
    });

    if (error) {
      return {
        member: null,
        error: error.message || 'Workspace member role update failed.',
      };
    }

    const members = normalizeWorkspaceMemberRows([data ?? {}]);
    if (members.length === 0) {
      return {
        member: null,
        error: 'Workspace member role update returned malformed data.',
      };
    }

    return {
      member: members[0],
      error: null,
    };
  } catch (error) {
    return {
      member: null,
      error: error instanceof Error ? error.message : 'Workspace member role update failed.',
    };
  }
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  client: WorkspaceMemberClient = getSupabaseBrowserClient() as unknown as WorkspaceMemberClient,
): Promise<AdminWorkspaceMemberAddResult> {
  const trimmedWorkspaceId = workspaceId.trim();
  const trimmedUserId = userId.trim();

  if (!trimmedWorkspaceId || !trimmedUserId) {
    return {
      member: null,
      error: 'Workspace id and user id are required.',
    };
  }

  if (!isWorkspaceUserId(trimmedUserId)) {
    return {
      member: null,
      error: 'User id must be a valid UUID.',
    };
  }

  if (!isWorkspaceRole(role)) {
    return {
      member: null,
      error: 'Invalid workspace role.',
    };
  }

  try {
    const { data, error } = await client.rpc('pm_add_workspace_member', {
      p_workspace_id: trimmedWorkspaceId,
      p_user_id: trimmedUserId,
      p_role: role,
    });

    if (error) {
      return {
        member: null,
        error: error.message || 'Workspace member add failed.',
      };
    }

    const member = normalizeAddedMemberRow(data);
    if (!member) {
      return {
        member: null,
        error: 'Workspace member add returned malformed data.',
      };
    }

    return {
      member,
      error: null,
    };
  } catch (error) {
    return {
      member: null,
      error: error instanceof Error ? error.message : 'Workspace member add failed.',
    };
  }
}

export async function removeWorkspaceMember(
  membershipId: string,
  client: WorkspaceMemberClient = getSupabaseBrowserClient() as unknown as WorkspaceMemberClient,
): Promise<AdminWorkspaceMemberRemoveResult> {
  if (!membershipId.trim()) {
    return {
      member: null,
      error: 'Membership id is required.',
    };
  }

  try {
    const { data, error } = await client.rpc('pm_remove_workspace_member', {
      p_membership_id: membershipId,
    });

    if (error) {
      return {
        member: null,
        error: error.message || 'Workspace member remove failed.',
      };
    }

    const member = normalizeAddedMemberRow(data);
    if (!member) {
      return {
        member: null,
        error: 'Workspace member remove returned malformed data.',
      };
    }

    return {
      member,
      error: null,
    };
  } catch (error) {
    return {
      member: null,
      error: error instanceof Error ? error.message : 'Workspace member remove failed.',
    };
  }
}
