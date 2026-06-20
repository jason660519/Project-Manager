import { getSupabaseBrowserClient } from './supabaseClient';

export interface AdminAuditLogEntry {
  id: string;
  workspaceId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuditLogListResult {
  entries: AdminAuditLogEntry[];
  error: string | null;
}

type AuditLogRow = {
  id?: unknown;
  workspace_id?: unknown;
  actor_user_id?: unknown;
  action?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  metadata?: unknown;
  created_at?: unknown;
};

type AuditLogQuery = {
  eq: (
    column: string,
    value: string,
  ) => AuditLogQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: AuditLogRow[] | null; error: { message?: string } | null }>;
};

type AuditLogSelect = {
  select: (columns: string) => AuditLogQuery;
};

export type AuditLogClient = {
  from: (table: 'audit_logs') => AuditLogSelect;
};

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function normalizeAuditLogRows(rows: AuditLogRow[] | null): AdminAuditLogEntry[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.action !== 'string' ||
      typeof row.resource_type !== 'string' ||
      typeof row.created_at !== 'string'
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        actorUserId: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: typeof row.resource_id === 'string' ? row.resource_id : null,
        metadata: normalizeMetadata(row.metadata),
        createdAt: row.created_at,
      },
    ];
  });
}

export async function listAuditLogs(
  client: AuditLogClient = getSupabaseBrowserClient() as unknown as AuditLogClient,
  workspaceId?: string | null,
): Promise<AdminAuditLogListResult> {
  try {
    const baseQuery = client
      .from('audit_logs')
      .select('id, workspace_id, actor_user_id, action, resource_type, resource_id, metadata, created_at');
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('created_at', { ascending: false });

    if (error) {
      return {
        entries: [],
        error: error.message || 'Audit log lookup failed.',
      };
    }

    return {
      entries: normalizeAuditLogRows(data),
      error: null,
    };
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error.message : 'Audit log lookup failed.',
    };
  }
}

export function formatAuditActionLabel(action: string): string {
  return action
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatMembershipAuditMetadataPreview(
  action: string,
  metadata: Record<string, unknown>,
): string | null {
  const targetUserId = readMetadataString(metadata, 'target_user_id');
  const role = readMetadataString(metadata, 'role');
  const previousRole = readMetadataString(metadata, 'previous_role');
  const newRole = readMetadataString(metadata, 'new_role');

  switch (action) {
    case 'membership.added':
      if (targetUserId && role) {
        return `Added ${targetUserId} as ${role}`;
      }
      break;
    case 'membership.removed':
      if (targetUserId && role) {
        return `Removed ${targetUserId} (was ${role})`;
      }
      if (targetUserId) {
        return `Removed ${targetUserId}`;
      }
      break;
    case 'membership.role_changed':
      if (targetUserId && previousRole && newRole) {
        return `${targetUserId}: ${previousRole} → ${newRole}`;
      }
      if (targetUserId && newRole) {
        return `${targetUserId} → ${newRole}`;
      }
      if (role) {
        return `Role changed to ${role}`;
      }
      break;
    case 'membership.invited': {
      const email = readMetadataString(metadata, 'email');
      if (email && role) {
        return `Invited ${email} as ${role}`;
      }
      if (email) {
        return `Invited ${email}`;
      }
      break;
    }
    case 'membership.invite_accepted': {
      const email = readMetadataString(metadata, 'email');
      if (email && role) {
        return `${email} accepted invite as ${role}`;
      }
      if (email) {
        return `${email} accepted invite`;
      }
      break;
    }
    default:
      break;
  }

  return null;
}

export function formatAuditMetadataPreview(
  metadata: Record<string, unknown>,
  context?: { action?: string; resourceType?: string },
): string | null {
  const keys = Object.keys(metadata);
  if (keys.length === 0) {
    return null;
  }

  const action = context?.action ?? '';
  if (action === 'workspace.created') {
    const name = readMetadataString(metadata, 'name');
    if (name) {
      return `Created workspace "${name}"`;
    }
  }

  if (action.startsWith('membership.')) {
    const membershipPreview = formatMembershipAuditMetadataPreview(action, metadata);
    if (membershipPreview) {
      return membershipPreview;
    }
  }

  const runnerId = readMetadataString(metadata, 'runner_id');
  if (runnerId && (action === 'runner.paired' || context?.resourceType === 'runner_device')) {
    return `Runner ${runnerId}`;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}
