import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminAuditLogsPanel } from '../app/admin/AdminAuditLogsPanel';

vi.mock('../lib/auth/auditLogs', () => ({
  formatAuditActionLabel: (value: string) => value,
  formatAuditMetadataPreview: (
    metadata: Record<string, unknown>,
    context?: { action?: string; resourceType?: string },
  ) => {
    if (context?.action === 'membership.role_changed') {
      return 'user-2: developer → reviewer';
    }
    return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
  },
  listAuditLogs: vi.fn(),
}));

import { listAuditLogs } from '../lib/auth/auditLogs';

describe('AdminAuditLogsPanel', () => {
  it('loads and renders audit entries for admin roles', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue({
      entries: [
        {
          id: 'audit-1',
          workspaceId: 'workspace-1',
          actorUserId: 'user-1',
          action: 'runner.paired',
          resourceType: 'runner_device',
          resourceId: 'runner-device-1',
          metadata: { runner_id: 'runner-alpha' },
          createdAt: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<AdminAuditLogsPanel workspaceRole="admin" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('runner.paired')).toBeInTheDocument();
    });

    expect(screen.getByText('runner_device')).toBeInTheDocument();
    expect(screen.getByText(/runner-alpha/)).toBeInTheDocument();
  });

  it('does not query audit logs for developer roles', async () => {
    render(<AdminAuditLogsPanel workspaceRole="developer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading audit history/i)).not.toBeInTheDocument();
    });

    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue({
      entries: [],
      error: 'permission denied for table audit_logs',
    });

    render(<AdminAuditLogsPanel workspaceRole="owner" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table audit_logs/i)).toBeInTheDocument();
    });
  });

  it('renders membership audit metadata previews', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue({
      entries: [
        {
          id: 'audit-2',
          workspaceId: 'workspace-1',
          actorUserId: 'admin-user',
          action: 'membership.role_changed',
          resourceType: 'workspace_membership',
          resourceId: 'membership-1',
          metadata: {
            target_user_id: 'user-2',
            previous_role: 'developer',
            new_role: 'reviewer',
          },
          createdAt: '2026-06-21T13:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<AdminAuditLogsPanel workspaceRole="admin" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('user-2: developer → reviewer')).toBeInTheDocument();
    });
  });
});
