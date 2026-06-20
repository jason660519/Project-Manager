import type { WorkspaceRole } from '../auth/permissions';

/** Public tables that must always ship with RLS when auth.uid() is available. */
export const PM_RLS_PROTECTED_TABLES = [
  'workspaces',
  'workspace_memberships',
  'projects',
  'agent_runs',
  'features',
  'audit_logs',
  'runner_devices',
  'report_metadata',
  'sync_cursors',
  'workspace_invites',
] as const;

export type PmRlsProtectedTable = (typeof PM_RLS_PROTECTED_TABLES)[number];

/** Minimum SELECT policies expected once auth is wired (0001 + 0002). */
export const PM_RLS_SELECT_POLICIES: Readonly<
  Record<PmRlsProtectedTable, readonly string[]>
> = {
  workspaces: ['pm_workspaces_read_member'],
  workspace_memberships: ['pm_memberships_read_own', 'pm_memberships_read_admin'],
  projects: ['pm_projects_read_member'],
  agent_runs: ['pm_agent_runs_read_member'],
  features: ['pm_features_read_member'],
  audit_logs: ['pm_audit_logs_read_admin'],
  runner_devices: ['pm_runner_devices_read_developer'],
  report_metadata: ['pm_report_metadata_read_member'],
  sync_cursors: ['pm_sync_cursors_read_developer'],
  workspace_invites: ['pm_invites_read_admin', 'pm_invites_read_pending_self'],
};

export const PM_AUDIT_LOG_ADMIN_ROLES = new Set<WorkspaceRole>(['owner', 'admin']);

/** Human/client-generated keys that are unique per workspace, not globally. */
export const PM_WORKSPACE_SCOPED_EXTERNAL_KEYS = [
  'runner_id',
  'feature_key',
  'report_key',
  'resource_key',
] as const;

export type PmWorkspaceScopedExternalKey = (typeof PM_WORKSPACE_SCOPED_EXTERNAL_KEYS)[number];

export const PM_RUNNER_DEVICE_READ_ROLES = new Set<WorkspaceRole>([
  'owner',
  'admin',
  'developer',
]);

/** Roles that may read draft/archived reports; viewer/user see published only (RLS). */
export const PM_REPORT_DRAFT_READ_ROLES = new Set<WorkspaceRole>([
  'owner',
  'admin',
  'developer',
  'reviewer',
]);

export const PM_RLS_MEMBERSHIP_SCOPE_SQL = `exists (
  select 1 from public.workspace_memberships m
  where m.workspace_id = <table>.workspace_id
    and m.user_id = (select auth.uid())
)`;

export function isPmRlsProtectedTable(value: string): value is PmRlsProtectedTable {
  return (PM_RLS_PROTECTED_TABLES as readonly string[]).includes(value);
}

export function canReadAuditLogs(role: WorkspaceRole): boolean {
  return PM_AUDIT_LOG_ADMIN_ROLES.has(role);
}

export function canReadWorkspaceMembers(role: WorkspaceRole): boolean {
  return PM_AUDIT_LOG_ADMIN_ROLES.has(role);
}

export function canManageWorkspaceMembers(role: WorkspaceRole): boolean {
  return PM_AUDIT_LOG_ADMIN_ROLES.has(role);
}

export function canReadRunnerDevices(role: WorkspaceRole): boolean {
  return PM_RUNNER_DEVICE_READ_ROLES.has(role);
}

export function canReadSyncCursors(role: WorkspaceRole): boolean {
  return PM_RUNNER_DEVICE_READ_ROLES.has(role);
}

export function canReadDraftReports(role: WorkspaceRole): boolean {
  return PM_REPORT_DRAFT_READ_ROLES.has(role);
}
