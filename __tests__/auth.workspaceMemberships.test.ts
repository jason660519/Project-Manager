import { describe, expect, it, vi } from 'vitest';
import {
  listWorkspaceMemberships,
  normalizeWorkspaceMembershipRows,
  type WorkspaceMembershipClient,
} from '../lib/auth/workspaceMemberships';

function clientWithResult(
  result: Awaited<ReturnType<WorkspaceMembershipClient['from']>> extends never ? never : {
    data: Parameters<typeof normalizeWorkspaceMembershipRows>[0];
    error: { message?: string } | null;
  },
): WorkspaceMembershipClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => result),
      })),
    })),
  };
}

describe('workspace membership query helpers', () => {
  it('normalizes valid memberships and drops malformed rows', () => {
    expect(
      normalizeWorkspaceMembershipRows([
        {
          workspace_id: 'workspace-1',
          role: 'developer',
          workspaces: { name: 'Engineering' },
        },
        {
          workspace_id: 'workspace-2',
          role: 'user',
          workspaces: [{ name: 'Stakeholders' }],
        },
        {
          workspace_id: 'workspace-3',
          role: 'superuser',
          workspaces: { name: 'Invalid role' },
        },
        {
          workspace_id: 42,
          role: 'admin',
          workspaces: { name: 'Invalid id' },
        },
      ]),
    ).toEqual([
      {
        workspaceId: 'workspace-1',
        workspaceName: 'Engineering',
        role: 'developer',
      },
      {
        workspaceId: 'workspace-2',
        workspaceName: 'Stakeholders',
        role: 'user',
      },
    ]);
  });

  it('returns memberships from the Supabase workspace_memberships table', async () => {
    const client = clientWithResult({
      data: [
        {
          workspace_id: 'workspace-admin',
          role: 'admin',
          workspaces: { name: 'Admin workspace' },
        },
      ],
      error: null,
    });

    await expect(listWorkspaceMemberships(client)).resolves.toEqual({
      memberships: [
        {
          workspaceId: 'workspace-admin',
          workspaceName: 'Admin workspace',
          role: 'admin',
        },
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('workspace_memberships');
  });

  it('returns a visible error instead of throwing when Supabase rejects the query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table workspace_memberships' },
    });

    await expect(listWorkspaceMemberships(client)).resolves.toEqual({
      memberships: [],
      error: 'permission denied for table workspace_memberships',
    });
  });
});
