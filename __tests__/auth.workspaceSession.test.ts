import { describe, expect, it, vi } from 'vitest';
import {
  resolveActiveWorkspaceMembership,
  resolveActiveWorkspaceSession,
} from '../lib/auth/workspaceSession';
import type { WorkspaceMembershipClient } from '../lib/auth/workspaceMemberships';

function membershipClientWithResult(result: {
  data: Array<{
    workspace_id: string;
    role: string;
    workspaces: { name: string };
  }>;
  error: { message?: string } | null;
}): WorkspaceMembershipClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => result),
      })),
    })),
  };
}

describe('workspace session resolver', () => {
  it('uses the preferred stored workspace when it matches a membership', async () => {
    const client = membershipClientWithResult({
      data: [
        {
          workspace_id: 'workspace-1',
          role: 'viewer',
          workspaces: { name: 'Portal Workspace' },
        },
        {
          workspace_id: 'workspace-2',
          role: 'developer',
          workspaces: { name: 'Engineering Workspace' },
        },
      ],
      error: null,
    });

    await expect(
      resolveActiveWorkspaceSession(client as never, 'workspace-2'),
    ).resolves.toEqual({
      workspaceId: 'workspace-2',
      workspaceName: 'Engineering Workspace',
      role: 'developer',
      memberships: expect.arrayContaining([
        expect.objectContaining({ workspaceId: 'workspace-1' }),
        expect.objectContaining({ workspaceId: 'workspace-2' }),
      ]),
      error: null,
    });
  });

  it('falls back to the first membership when the preferred workspace is stale', () => {
    expect(
      resolveActiveWorkspaceMembership(
        [
          {
            workspaceId: 'workspace-1',
            workspaceName: 'Portal Workspace',
            role: 'viewer',
          },
          {
            workspaceId: 'workspace-2',
            workspaceName: 'Engineering Workspace',
            role: 'developer',
          },
        ],
        'workspace-missing',
      ),
    ).toEqual({
      workspaceId: 'workspace-1',
      workspaceName: 'Portal Workspace',
      role: 'viewer',
    });
  });

  it('returns an empty session when no memberships exist', async () => {
    const client = membershipClientWithResult({
      data: [],
      error: null,
    });

    await expect(resolveActiveWorkspaceSession(client as never)).resolves.toEqual({
      workspaceId: null,
      workspaceName: null,
      role: null,
      memberships: [],
      error: null,
    });
  });
});
