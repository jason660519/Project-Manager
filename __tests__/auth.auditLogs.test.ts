import { describe, expect, it, vi } from 'vitest';
import {
  formatAuditActionLabel,
  formatAuditMetadataPreview,
  listAuditLogs,
  normalizeAuditLogRows,
  type AuditLogClient,
} from '../lib/auth/auditLogs';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizeAuditLogRows>[0];
    error: { message?: string } | null;
  },
): AuditLogClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
  };
}

describe('admin audit log query helpers', () => {
  it('normalizes valid audit log rows and drops malformed entries', () => {
    expect(
      normalizeAuditLogRows([
        {
          id: 'audit-1',
          workspace_id: 'workspace-1',
          actor_user_id: 'user-1',
          action: 'runner.paired',
          resource_type: 'runner_device',
          resource_id: 'runner-device-1',
          metadata: { runner_id: 'runner-alpha' },
          created_at: '2026-06-21T12:00:00.000Z',
        },
        {
          id: 'audit-2',
          action: 'member.invited',
          resource_type: 'workspace_membership',
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ]),
    ).toEqual([
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
    ]);
  });

  it('loads audit logs through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'audit-1',
          workspace_id: 'workspace-1',
          actor_user_id: null,
          action: 'report.published',
          resource_type: 'report_metadata',
          resource_id: 'report-1',
          metadata: {},
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(listAuditLogs(client)).resolves.toEqual({
      entries: [
        expect.objectContaining({
          action: 'report.published',
          resourceType: 'report_metadata',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('audit_logs');
  });

  it('returns a visible error when Supabase rejects the audit log query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table audit_logs' },
    });

    await expect(listAuditLogs(client)).resolves.toEqual({
      entries: [],
      error: 'permission denied for table audit_logs',
    });
  });

  it('formats audit action labels for the admin console', () => {
    expect(formatAuditActionLabel('runner.paired')).toBe('Runner Paired');
    expect(formatAuditActionLabel('member_invited')).toBe('Member Invited');
  });

  it('returns null for empty metadata previews', () => {
    expect(formatAuditMetadataPreview({})).toBeNull();
    expect(formatAuditMetadataPreview({ runner_id: 'runner-alpha' })).toBe(
      '{"runner_id":"runner-alpha"}',
    );
  });

  it('formats membership audit metadata for the admin console', () => {
    expect(
      formatAuditMetadataPreview(
        { target_user_id: 'user-2', role: 'viewer' },
        { action: 'membership.added', resourceType: 'workspace_membership' },
      ),
    ).toBe('Added user-2 as viewer');

    expect(
      formatAuditMetadataPreview(
        { target_user_id: 'user-2', role: 'developer' },
        { action: 'membership.removed', resourceType: 'workspace_membership' },
      ),
    ).toBe('Removed user-2 (was developer)');

    expect(
      formatAuditMetadataPreview(
        {
          target_user_id: 'user-2',
          previous_role: 'developer',
          new_role: 'reviewer',
        },
        { action: 'membership.role_changed', resourceType: 'workspace_membership' },
      ),
    ).toBe('user-2: developer → reviewer');
  });

  it('formats invite and workspace audit metadata for the admin console', () => {
    expect(
      formatAuditMetadataPreview(
        { email: 'teammate@example.com', role: 'developer' },
        { action: 'membership.invited', resourceType: 'workspace_invite' },
      ),
    ).toBe('Invited teammate@example.com as developer');

    expect(
      formatAuditMetadataPreview(
        { name: 'Alpha Team' },
        { action: 'workspace.created', resourceType: 'workspace' },
      ),
    ).toBe('Created workspace "Alpha Team"');
  });

  it('formats runner audit metadata without raw JSON when action is known', () => {
    expect(
      formatAuditMetadataPreview(
        { runner_id: 'runner-alpha' },
        { action: 'runner.paired', resourceType: 'runner_device' },
      ),
    ).toBe('Runner runner-alpha');
  });
});
