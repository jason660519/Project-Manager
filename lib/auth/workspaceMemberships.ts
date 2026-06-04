import { getSupabaseBrowserClient } from './supabaseClient';
import type { WorkspaceRole } from './permissions';

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

export interface WorkspaceMembershipResult {
  memberships: WorkspaceMembership[];
  error: string | null;
}

type WorkspaceMembershipRow = {
  workspace_id?: unknown;
  role?: unknown;
  workspaces?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

type MembershipQuery = {
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: WorkspaceMembershipRow[] | null; error: { message?: string } | null }>;
};

type MembershipSelect = {
  select: (columns: string) => MembershipQuery;
};

export type WorkspaceMembershipClient = {
  from: (table: 'workspace_memberships') => MembershipSelect;
};

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

function getWorkspaceName(row: WorkspaceMembershipRow): string {
  const relation = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
  return typeof relation?.name === 'string' && relation.name.trim()
    ? relation.name
    : 'Unnamed workspace';
}

export function normalizeWorkspaceMembershipRows(
  rows: WorkspaceMembershipRow[] | null,
): WorkspaceMembership[] {
  return (rows ?? []).flatMap((row) => {
    if (typeof row.workspace_id !== 'string' || !isWorkspaceRole(row.role)) {
      return [];
    }

    return [
      {
        workspaceId: row.workspace_id,
        workspaceName: getWorkspaceName(row),
        role: row.role,
      },
    ];
  });
}

export async function listWorkspaceMemberships(
  client: WorkspaceMembershipClient = getSupabaseBrowserClient() as unknown as WorkspaceMembershipClient,
): Promise<WorkspaceMembershipResult> {
  try {
    const { data, error } = await client
      .from('workspace_memberships')
      .select('workspace_id, role, workspaces:workspaces(name)')
      .order('created_at', { ascending: true });

    if (error) {
      return {
        memberships: [],
        error: error.message || 'Workspace membership lookup failed.',
      };
    }

    return {
      memberships: normalizeWorkspaceMembershipRows(data),
      error: null,
    };
  } catch (error) {
    return {
      memberships: [],
      error: error instanceof Error ? error.message : 'Workspace membership lookup failed.',
    };
  }
}
