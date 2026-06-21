import { describe, expect, it, vi } from 'vitest';
import {
  addWorkspaceMember,
  canEditWorkspaceMemberRole,
  formatWorkspaceRoleLabel,
  isWorkspaceUserId,
  listAssignableWorkspaceRoles,
  listWorkspaceMembers,
  normalizeWorkspaceMemberRows,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMemberClient,
} from '../lib/auth/workspaceMembers';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizeWorkspaceMemberRows>[0];
    error: { message?: string } | null;
  },
): WorkspaceMemberClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
    rpc: vi.fn(),
  };
}

describe('admin workspace member query helpers', () => {
  it('normalizes valid member rows and drops malformed entries', () => {
    expect(
      normalizeWorkspaceMemberRows([
        {
          id: 'membership-1',
          workspace_id: 'workspace-1',
          user_id: 'user-1',
          role: 'admin',
          created_at: '2026-06-21T12:00:00.000Z',
        },
        {
          id: 'membership-2',
          workspace_id: 'workspace-1',
          user_id: 'user-2',
          role: 'invalid',
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ]),
    ).toEqual([
      {
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'admin',
        joinedAt: '2026-06-21T12:00:00.000Z',
      },
    ]);
  });

  it('loads workspace members through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'membership-1',
          workspace_id: 'workspace-1',
          user_id: 'user-1',
          role: 'developer',
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(listWorkspaceMembers(client, 'workspace-1')).resolves.toEqual({
      members: [
        expect.objectContaining({
          userId: 'user-1',
          role: 'developer',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('workspace_memberships');
  });

  it('returns a visible error when Supabase rejects the member query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table workspace_memberships' },
    });

    await expect(listWorkspaceMembers(client)).resolves.toEqual({
      members: [],
      error: 'permission denied for table workspace_memberships',
    });
  });

  it('formats workspace role labels for the admin console', () => {
    expect(formatWorkspaceRoleLabel('owner')).toBe('Owner');
    expect(formatWorkspaceRoleLabel('developer')).toBe('Developer');
  });

  it('limits assignable roles for admin actors', () => {
    expect(listAssignableWorkspaceRoles('owner')).toContain('owner');
    expect(listAssignableWorkspaceRoles('admin')).not.toContain('owner');
  });

  it('blocks self-edits and owner rows for admin actors', () => {
    const member = {
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner' as const,
      joinedAt: '2026-06-21T12:00:00.000Z',
    };

    expect(canEditWorkspaceMemberRole('admin', 'admin-user', member)).toBe(false);
    expect(canEditWorkspaceMemberRole('admin', 'admin-user', { ...member, role: 'developer' })).toBe(
      true,
    );
    expect(canEditWorkspaceMemberRole('admin', 'admin-user', { ...member, userId: 'admin-user' })).toBe(
      false,
    );
  });

  it('updates workspace member roles through the audited RPC abstraction', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: {
          id: 'membership-1',
          workspace_id: 'workspace-1',
          user_id: 'user-1',
          role: 'reviewer',
          created_at: '2026-06-21T12:00:00.000Z',
        },
        error: null,
      })),
    } as unknown as WorkspaceMemberClient;

    await expect(updateWorkspaceMemberRole('membership-1', 'reviewer', client)).resolves.toEqual({
      member: expect.objectContaining({
        role: 'reviewer',
      }),
      error: null,
    });

    expect(client.rpc).toHaveBeenCalledWith('pm_update_workspace_member_role', {
      p_membership_id: 'membership-1',
      p_new_role: 'reviewer',
    });
  });

  it('returns a visible error when the role update RPC fails', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: 'Owner permission required for owner role changes' },
      })),
    } as unknown as WorkspaceMemberClient;

    await expect(updateWorkspaceMemberRole('membership-1', 'owner', client)).resolves.toEqual({
      member: null,
      error: 'Owner permission required for owner role changes',
    });
  });

  it('validates Supabase auth user ids before add RPC calls', () => {
    expect(isWorkspaceUserId('a0000000-0000-4000-8000-000000000010')).toBe(true);
    expect(isWorkspaceUserId('not-a-uuid')).toBe(false);
  });

  it('adds workspace members through the audited RPC abstraction', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: {
          id: 'membership-2',
          workspace_id: 'workspace-1',
          user_id: 'a0000000-0000-4000-8000-000000000010',
          role: 'viewer',
          created_at: '2026-06-21T13:00:00.000Z',
        },
        error: null,
      })),
    } as unknown as WorkspaceMemberClient;

    await expect(
      addWorkspaceMember(
        'workspace-1',
        'a0000000-0000-4000-8000-000000000010',
        'viewer',
        client,
      ),
    ).resolves.toEqual({
      member: expect.objectContaining({
        userId: 'a0000000-0000-4000-8000-000000000010',
        role: 'viewer',
      }),
      error: null,
    });

    expect(client.rpc).toHaveBeenCalledWith('pm_add_workspace_member', {
      p_workspace_id: 'workspace-1',
      p_user_id: 'a0000000-0000-4000-8000-000000000010',
      p_role: 'viewer',
    });
  });

  it('returns a visible error when add inputs are invalid', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as unknown as WorkspaceMemberClient;

    await expect(addWorkspaceMember('', 'bad-id', 'viewer', client)).resolves.toEqual({
      member: null,
      error: 'Workspace id and user id are required.',
    });

    await expect(addWorkspaceMember('workspace-1', 'bad-id', 'viewer', client)).resolves.toEqual({
      member: null,
      error: 'User id must be a valid UUID.',
    });

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('returns a visible error when the add RPC fails', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: 'User is already a member of this workspace' },
      })),
    } as unknown as WorkspaceMemberClient;

    await expect(
      addWorkspaceMember(
        'workspace-1',
        'a0000000-0000-4000-8000-000000000010',
        'viewer',
        client,
      ),
    ).resolves.toEqual({
      member: null,
      error: 'User is already a member of this workspace',
    });
  });

  it('removes workspace members through the audited RPC abstraction', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: {
          id: 'membership-2',
          workspace_id: 'workspace-1',
          user_id: 'a0000000-0000-4000-8000-000000000010',
          role: 'viewer',
          created_at: '2026-06-21T13:00:00.000Z',
        },
        error: null,
      })),
    } as unknown as WorkspaceMemberClient;

    await expect(removeWorkspaceMember('membership-2', client)).resolves.toEqual({
      member: expect.objectContaining({
        userId: 'a0000000-0000-4000-8000-000000000010',
      }),
      error: null,
    });

    expect(client.rpc).toHaveBeenCalledWith('pm_remove_workspace_member', {
      p_membership_id: 'membership-2',
    });
  });

  it('returns a visible error when the remove RPC fails', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: 'Cannot remove your own workspace membership' },
      })),
    } as unknown as WorkspaceMemberClient;

    await expect(removeWorkspaceMember('membership-1', client)).resolves.toEqual({
      member: null,
      error: 'Cannot remove your own workspace membership',
    });
  });
});
