import type { SyncCursorStatus, SyncResourceType } from '../supabase/cloudSchema';
import { getSupabaseBrowserClient } from './supabaseClient';

export interface DeveloperSyncCursor {
  id: string;
  workspaceId: string;
  projectId: string | null;
  projectName: string | null;
  resourceType: SyncResourceType;
  resourceKey: string;
  localRevision: string | null;
  cloudRevision: string | null;
  lastSyncedAt: string | null;
  syncStatus: SyncCursorStatus;
  updatedAt: string;
}

export interface DeveloperSyncCursorListResult {
  cursors: DeveloperSyncCursor[];
  error: string | null;
}

type SyncCursorRow = {
  id?: unknown;
  workspace_id?: unknown;
  project_id?: unknown;
  resource_type?: unknown;
  resource_key?: unknown;
  local_revision?: unknown;
  cloud_revision?: unknown;
  last_synced_at?: unknown;
  sync_status?: unknown;
  updated_at?: unknown;
  projects?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

type SyncCursorQuery = {
  eq: (
    column: string,
    value: string,
  ) => SyncCursorQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: SyncCursorRow[] | null; error: { message?: string } | null }>;
};

type SyncCursorSelect = {
  select: (columns: string) => SyncCursorQuery;
};

export type SyncCursorClient = {
  from: (table: 'sync_cursors') => SyncCursorSelect;
};

const RESOURCE_TYPES = new Set<SyncResourceType>([
  'project_config',
  'progress_sheet',
  'feature_manifest',
]);

const SYNC_STATUSES = new Set<SyncCursorStatus>(['idle', 'pending', 'conflict', 'error']);

function isResourceType(value: unknown): value is SyncResourceType {
  return typeof value === 'string' && RESOURCE_TYPES.has(value as SyncResourceType);
}

function isSyncStatus(value: unknown): value is SyncCursorStatus {
  return typeof value === 'string' && SYNC_STATUSES.has(value as SyncCursorStatus);
}

function readProjectName(
  projects: SyncCursorRow['projects'],
): string | null {
  if (!projects) return null;
  const row = Array.isArray(projects) ? projects[0] : projects;
  return typeof row?.name === 'string' ? row.name : null;
}

export function normalizeSyncCursorRows(rows: SyncCursorRow[] | null): DeveloperSyncCursor[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.resource_key !== 'string' ||
      !isResourceType(row.resource_type) ||
      !isSyncStatus(row.sync_status) ||
      typeof row.updated_at !== 'string'
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        projectId: typeof row.project_id === 'string' ? row.project_id : null,
        projectName: readProjectName(row.projects),
        resourceType: row.resource_type,
        resourceKey: row.resource_key,
        localRevision: typeof row.local_revision === 'string' ? row.local_revision : null,
        cloudRevision: typeof row.cloud_revision === 'string' ? row.cloud_revision : null,
        lastSyncedAt: typeof row.last_synced_at === 'string' ? row.last_synced_at : null,
        syncStatus: row.sync_status,
        updatedAt: row.updated_at,
      },
    ];
  });
}

export async function listSyncCursors(
  client: SyncCursorClient = getSupabaseBrowserClient() as unknown as SyncCursorClient,
  workspaceId?: string | null,
): Promise<DeveloperSyncCursorListResult> {
  try {
    const baseQuery = client
      .from('sync_cursors')
      .select(
        'id, workspace_id, project_id, resource_type, resource_key, local_revision, cloud_revision, last_synced_at, sync_status, updated_at, projects(name)',
      );
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('updated_at', { ascending: false });

    if (error) {
      return {
        cursors: [],
        error: error.message || 'Sync cursor lookup failed.',
      };
    }

    return {
      cursors: normalizeSyncCursorRows(data),
      error: null,
    };
  } catch (error) {
    return {
      cursors: [],
      error: error instanceof Error ? error.message : 'Sync cursor lookup failed.',
    };
  }
}

export function formatSyncResourceTypeLabel(resourceType: SyncResourceType): string {
  switch (resourceType) {
    case 'project_config':
      return 'Project config';
    case 'progress_sheet':
      return 'Progress sheet';
    case 'feature_manifest':
      return 'Feature manifest';
    default:
      return resourceType;
  }
}

export function formatSyncStatusLabel(status: SyncCursorStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'pending':
      return 'Pending';
    case 'conflict':
      return 'Conflict';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}
