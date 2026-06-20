import { describe, expect, it, vi } from 'vitest';
import {
  acceptWorkspaceInvite,
  inviteWorkspaceMemberByEmail,
  isWorkspaceEmail,
  listPendingWorkspaceInvites,
  normalizeWorkspaceEmail,
  normalizeWorkspaceInviteRows,
  type WorkspaceInviteClient,
} from '../lib/auth/workspaceInvites';

function inviteClientWithResult(
  result: {
    data: Parameters<typeof normalizeWorkspaceInviteRows>[0];
    error: { message?: string } | null;
  },
): WorkspaceInviteClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
    rpc: vi.fn(),
  };
}

describe('workspace invite helpers', () => {
  it('normalizes invite emails', () => {
    expect(normalizeWorkspaceEmail('  Teammate@Example.COM ')).toBe('teammate@example.com');
    expect(isWorkspaceEmail('teammate@example.com')).toBe(true);
    expect(isWorkspaceEmail('not-an-email')).toBe(false);
  });

  it('lists pending workspace invites for onboarding', async () => {
    const client = inviteClientWithResult({
      data: [
        {
          id: 'invite-1',
          workspace_id: 'workspace-1',
          email: 'teammate@example.com',
          role: 'developer',
          status: 'pending',
          invited_by_user_id: 'admin-user',
          created_at: '2026-06-21T12:00:00.000Z',
        },
        {
          id: 'invite-2',
          workspace_id: 'workspace-1',
          email: 'old@example.com',
          role: 'viewer',
          status: 'accepted',
          invited_by_user_id: 'admin-user',
          created_at: '2026-06-21T11:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(listPendingWorkspaceInvites(client)).resolves.toEqual({
      invites: [
        expect.objectContaining({
          email: 'teammate@example.com',
          status: 'pending',
        }),
      ],
      error: null,
    });
  });

  it('creates email invites through the audited RPC abstraction', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: {
          id: 'invite-1',
          workspace_id: 'workspace-1',
          email: 'teammate@example.com',
          role: 'viewer',
          status: 'pending',
          invited_by_user_id: 'admin-user',
          created_at: '2026-06-21T12:00:00.000Z',
        },
        error: null,
      })),
    } as unknown as WorkspaceInviteClient;

    await expect(
      inviteWorkspaceMemberByEmail('workspace-1', 'Teammate@Example.com', 'viewer', client),
    ).resolves.toEqual({
      invite: expect.objectContaining({
        email: 'teammate@example.com',
      }),
      error: null,
    });

    expect(client.rpc).toHaveBeenCalledWith('pm_invite_workspace_member', {
      p_workspace_id: 'workspace-1',
      p_email: 'teammate@example.com',
      p_role: 'viewer',
    });
  });

  it('accepts workspace invites through the audited RPC abstraction', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: {
          workspace_id: 'workspace-1',
          role: 'developer',
        },
        error: null,
      })),
    } as unknown as WorkspaceInviteClient;

    await expect(acceptWorkspaceInvite('invite-1', client)).resolves.toEqual({
      workspaceId: 'workspace-1',
      role: 'developer',
      error: null,
    });
  });
});
