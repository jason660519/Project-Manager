import { describe, expect, it, vi } from 'vitest';
import {
  formatSyncResourceTypeLabel,
  formatSyncStatusLabel,
  listSyncCursors,
  normalizeSyncCursorRows,
  type SyncCursorClient,
} from '../lib/auth/syncCursors';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizeSyncCursorRows>[0];
    error: { message?: string } | null;
  },
): SyncCursorClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
  };
}

describe('developer sync cursor query helpers', () => {
  it('normalizes valid sync cursor rows and drops malformed entries', () => {
    expect(
      normalizeSyncCursorRows([
        {
          id: 'cursor-1',
          workspace_id: 'workspace-1',
          project_id: 'project-1',
          resource_type: 'project_config',
          resource_key: 'alpha-config',
          local_revision: 'abc123',
          cloud_revision: 'def456',
          last_synced_at: '2026-06-21T12:00:00.000Z',
          sync_status: 'idle',
          updated_at: '2026-06-21T12:05:00.000Z',
          projects: { name: 'Alpha Project' },
        },
        {
          id: 'cursor-2',
          resource_type: 'invalid',
          resource_key: 'bad',
          sync_status: 'idle',
        },
      ]),
    ).toEqual([
      {
        id: 'cursor-1',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        projectName: 'Alpha Project',
        resourceType: 'project_config',
        resourceKey: 'alpha-config',
        localRevision: 'abc123',
        cloudRevision: 'def456',
        lastSyncedAt: '2026-06-21T12:00:00.000Z',
        syncStatus: 'idle',
        updatedAt: '2026-06-21T12:05:00.000Z',
      },
    ]);
  });

  it('loads sync cursors through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'cursor-1',
          workspace_id: 'workspace-1',
          project_id: null,
          resource_type: 'feature_manifest',
          resource_key: 'F47',
          local_revision: null,
          cloud_revision: 'rev-1',
          last_synced_at: null,
          sync_status: 'pending',
          updated_at: '2026-06-21T12:00:00.000Z',
          projects: null,
        },
      ],
      error: null,
    });

    await expect(listSyncCursors(client, 'workspace-1')).resolves.toEqual({
      cursors: [
        expect.objectContaining({
          resourceKey: 'F47',
          syncStatus: 'pending',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('sync_cursors');
  });

  it('returns a visible error when Supabase rejects the sync cursor query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table sync_cursors' },
    });

    await expect(listSyncCursors(client)).resolves.toEqual({
      cursors: [],
      error: 'permission denied for table sync_cursors',
    });
  });

  it('formats sync resource and status labels for the developer console', () => {
    expect(formatSyncResourceTypeLabel('project_config')).toBe('Project config');
    expect(formatSyncStatusLabel('conflict')).toBe('Conflict');
  });
});
