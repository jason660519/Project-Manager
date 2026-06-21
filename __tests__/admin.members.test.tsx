import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMembersPanel } from '../app/admin/AdminMembersPanel';

vi.mock('../lib/auth/workspaceMembers', () => ({
  addWorkspaceMember: vi.fn(),
  canEditWorkspaceMemberRole: vi.fn(),
  formatWorkspaceRoleLabel: (value: string) => value,
  listAssignableWorkspaceRoles: () => ['admin', 'developer', 'reviewer', 'viewer', 'user'],
  listWorkspaceMembers: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  updateWorkspaceMemberRole: vi.fn(),
}));

vi.mock('../lib/auth/workspaceInvites', () => ({
  inviteWorkspaceMemberByEmail: vi.fn(),
  listWorkspaceInvites: vi.fn(),
}));

import {
  addWorkspaceMember,
  canEditWorkspaceMemberRole,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '../lib/auth/workspaceMembers';
import { inviteWorkspaceMemberByEmail, listWorkspaceInvites } from '../lib/auth/workspaceInvites';

describe('AdminMembersPanel', () => {
  beforeEach(() => {
    vi.mocked(listWorkspaceInvites).mockResolvedValue({ invites: [], error: null });
  });

  it('loads and renders workspace members for admin roles', async () => {
    vi.mocked(canEditWorkspaceMemberRole).mockReturnValue(false);
    vi.mocked(listWorkspaceMembers).mockResolvedValue({
      members: [
        {
          id: 'membership-1',
          workspaceId: 'workspace-1',
          userId: 'user-1',
          role: 'developer',
          joinedAt: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    render(
      <AdminMembersPanel workspaceRole="admin" workspaceId="workspace-1" actorUserId="admin-user" />,
    );

    await waitFor(() => {
      expect(screen.getByText('user-1')).toBeInTheDocument();
    });
  });

  it('does not query members for developer roles', async () => {
    render(
      <AdminMembersPanel workspaceRole="developer" workspaceId="workspace-1" actorUserId="dev-user" />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading members/i)).not.toBeInTheDocument();
    });

    expect(listWorkspaceMembers).not.toHaveBeenCalled();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listWorkspaceMembers).mockResolvedValue({
      members: [],
      error: 'permission denied for table workspace_memberships',
    });

    render(
      <AdminMembersPanel workspaceRole="admin" workspaceId="workspace-1" actorUserId="admin-user" />,
    );

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table workspace_memberships/i)).toBeInTheDocument();
    });
  });

  it('updates member roles through the audited RPC helper', async () => {
    vi.mocked(canEditWorkspaceMemberRole).mockReturnValue(true);
    vi.mocked(listWorkspaceMembers).mockResolvedValue({
      members: [
        {
          id: 'membership-1',
          workspaceId: 'workspace-1',
          userId: 'user-1',
          role: 'developer',
          joinedAt: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });
    vi.mocked(updateWorkspaceMemberRole).mockResolvedValue({
      member: {
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'reviewer',
        joinedAt: '2026-06-21T12:00:00.000Z',
      },
      error: null,
    });

    render(
      <AdminMembersPanel workspaceRole="admin" workspaceId="workspace-1" actorUserId="admin-user" />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Role for user-1')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Role for user-1'), {
      target: { value: 'reviewer' },
    });

    await waitFor(() => {
      expect(updateWorkspaceMemberRole).toHaveBeenCalledWith('membership-1', 'reviewer');
    });
  });

  it('adds members through the audited add RPC helper', async () => {
    vi.mocked(canEditWorkspaceMemberRole).mockReturnValue(false);
    vi.mocked(listWorkspaceMembers).mockResolvedValue({
      members: [],
      error: null,
    });
    vi.mocked(addWorkspaceMember).mockResolvedValue({
      member: {
        id: 'membership-2',
        workspaceId: 'workspace-1',
        userId: 'a0000000-0000-4000-8000-000000000010',
        role: 'viewer',
        joinedAt: '2026-06-21T13:00:00.000Z',
      },
      error: null,
    });

    render(
      <AdminMembersPanel workspaceRole="admin" workspaceId="workspace-1" actorUserId="admin-user" />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Supabase user id/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Supabase user id/i), {
      target: { value: 'a0000000-0000-4000-8000-000000000010' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add member/i }));

    await waitFor(() => {
      expect(addWorkspaceMember).toHaveBeenCalledWith(
        'workspace-1',
        'a0000000-0000-4000-8000-000000000010',
        'viewer',
      );
    });

    await waitFor(() => {
      expect(screen.getByText('a0000000-0000-4000-8000-000000000010')).toBeInTheDocument();
    });
  });

  it('removes members through the audited remove RPC helper', async () => {
    vi.mocked(canEditWorkspaceMemberRole).mockReturnValue(true);
    vi.mocked(listWorkspaceMembers).mockResolvedValue({
      members: [
        {
          id: 'membership-1',
          workspaceId: 'workspace-1',
          userId: 'user-1',
          role: 'developer',
          joinedAt: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });
    vi.mocked(removeWorkspaceMember).mockResolvedValue({
      member: {
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'developer',
        joinedAt: '2026-06-21T12:00:00.000Z',
      },
      error: null,
    });

    render(
      <AdminMembersPanel workspaceRole="admin" workspaceId="workspace-1" actorUserId="admin-user" />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Remove user-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Remove user-1'));

    await waitFor(() => {
      expect(removeWorkspaceMember).toHaveBeenCalledWith('membership-1');
    });

    await waitFor(() => {
      expect(screen.queryByText('user-1')).not.toBeInTheDocument();
    });
  });

  it('creates email invites through the audited invite RPC helper', async () => {
    vi.mocked(canEditWorkspaceMemberRole).mockReturnValue(false);
    vi.mocked(listWorkspaceMembers).mockResolvedValue({ members: [], error: null });
    vi.mocked(listWorkspaceInvites).mockResolvedValue({ invites: [], error: null });
    vi.mocked(inviteWorkspaceMemberByEmail).mockResolvedValue({
      invite: {
        id: 'invite-1',
        workspaceId: 'workspace-1',
        email: 'teammate@example.com',
        role: 'viewer',
        status: 'pending',
        invitedByUserId: 'admin-user',
        createdAt: '2026-06-21T13:00:00.000Z',
        acceptedAt: null,
      },
      error: null,
    });

    render(
      <AdminMembersPanel workspaceRole="admin" workspaceId="workspace-1" actorUserId="admin-user" />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'teammate@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create email invite/i }));

    await waitFor(() => {
      expect(inviteWorkspaceMemberByEmail).toHaveBeenCalledWith(
        'workspace-1',
        'teammate@example.com',
        'viewer',
      );
    });
  });
});
