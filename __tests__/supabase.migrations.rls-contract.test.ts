import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PM_RLS_PROTECTED_TABLES,
  PM_RLS_SELECT_POLICIES,
  PM_WORKSPACE_SCOPED_EXTERNAL_KEYS,
  canReadAuditLogs,
  canReadDraftReports,
  canReadRunnerDevices,
  canReadSyncCursors,
  canReadWorkspaceMembers,
  canManageWorkspaceMembers,
} from '../lib/supabase/rlsContracts';

const MIGRATIONS_DIR = join(process.cwd(), 'infra/supabase/migrations');

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function combinedMigrations(): string {
  return listMigrationFiles().map(readMigration).join('\n');
}

describe('Supabase migration RLS contracts', () => {
  it('includes the expected numbered migration files', () => {
    expect(listMigrationFiles()).toEqual([
      '0001_pm_core.sql',
      '0002_features_audit_logs.sql',
      '0003_runner_devices.sql',
      '0004_agent_runs_runner_device_fk.sql',
      '0005_report_metadata.sql',
      '0006_sync_cursors.sql',
      '0007_workspace_memberships_admin_read.sql',
      '0008_workspace_membership_role_update.sql',
      '0009_workspace_membership_add.sql',
      '0010_workspace_membership_remove.sql',
      '0011_workspace_create.sql',
      '0012_workspace_invites.sql',
    ]);
  });

  it('declares RLS on every protected public table when auth is wired', () => {
    const sql = combinedMigrations();

    for (const table of PM_RLS_PROTECTED_TABLES) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('creates the expected membership-scoped SELECT policies', () => {
    const sql = combinedMigrations();

    for (const table of PM_RLS_PROTECTED_TABLES) {
      for (const policy of PM_RLS_SELECT_POLICIES[table]) {
        expect(sql).toContain(`create policy ${policy} on public.${table}`);
      }
    }
  });

  it('gates RLS setup on auth.uid() instead of silently enabling deny-all policies', () => {
    const sql = combinedMigrations();
    expect(sql).toContain("to_regprocedure('auth.uid()')");
  });

  it('adds features and audit_logs with workspace scope and audit columns', () => {
    const sql = readMigration('0002_features_audit_logs.sql');

    expect(sql).toContain('create table if not exists public.features');
    expect(sql).toContain('workspace_id uuid not null references public.workspaces(id)');
    expect(sql).toContain('feature_key text not null');
    expect(sql).toContain('deleted_at timestamptz');
    expect(sql).toContain('create table if not exists public.audit_logs');
    expect(sql).toContain('actor_user_id uuid');
    expect(sql).toContain('resource_type text not null');
    expect(sql).toContain('metadata jsonb not null default');
    expect(sql).toContain("values ('0002_features_audit_logs')");
  });

  it('restricts audit log reads to owner/admin roles in policy SQL', () => {
    const sql = readMigration('0002_features_audit_logs.sql');
    expect(sql).toContain("m.role in ('owner', 'admin')");
    expect(canReadAuditLogs('developer')).toBe(false);
    expect(canReadAuditLogs('admin')).toBe(true);
  });

  it('adds runner_devices with developer-scoped read RLS', () => {
    const sql = readMigration('0003_runner_devices.sql');

    expect(sql).toContain('create table if not exists public.runner_devices');
    expect(sql).toContain('runner_id text not null');
    expect(sql).toContain('paired_by_user_id uuid');
    expect(sql).toContain("check (status in ('missing', 'paired_offline', 'project_blocked', 'ready', 'error'))");
    expect(sql).toContain('create policy pm_runner_devices_read_developer');
    expect(sql).toContain("m.role in ('owner', 'admin', 'developer')");
    expect(sql).toContain("values ('0003_runner_devices')");
    expect(canReadRunnerDevices('developer')).toBe(true);
    expect(canReadRunnerDevices('viewer')).toBe(false);
  });

  it('documents workspace-scoped external keys and enforces runner_device FK on agent_runs', () => {
    expect(PM_WORKSPACE_SCOPED_EXTERNAL_KEYS).toContain('runner_id');
    expect(PM_WORKSPACE_SCOPED_EXTERNAL_KEYS).toContain('feature_key');

    const migration = readMigration('0004_agent_runs_runner_device_fk.sql');
    expect(migration).toContain('add column if not exists runner_device_id uuid references public.runner_devices(id)');
    expect(migration).toContain('pm_enforce_agent_run_runner_workspace');
    expect(migration).toContain('trg_agent_runs_runner_workspace');
    expect(migration).toContain("values ('0004_agent_runs_runner_device_fk')");
  });

  it('adds report_metadata for User Portal index rows with published-vs-draft RLS', () => {
    expect(PM_WORKSPACE_SCOPED_EXTERNAL_KEYS).toContain('report_key');

    const migration = readMigration('0005_report_metadata.sql');
    expect(migration).toContain('create table if not exists public.report_metadata');
    expect(migration).toContain('unique (workspace_id, report_key)');
    expect(migration).toContain('content_url text');
    expect(migration).toContain('storage_path text');
    expect(migration).toContain("check (status in ('draft', 'published', 'archived'))");
    expect(migration).toContain('create policy pm_report_metadata_read_member');
    expect(migration).toContain("report_metadata.status = 'published'");
    expect(migration).toContain("m.role in ('owner', 'admin', 'developer', 'reviewer')");
    expect(migration).toContain('pm_enforce_report_metadata_workspace');
    expect(migration).toContain("values ('0005_report_metadata')");
    expect(canReadDraftReports('developer')).toBe(true);
    expect(canReadDraftReports('viewer')).toBe(false);
  });

  it('adds sync_cursors for local/cloud revision bookkeeping with developer-scoped RLS', () => {
    const migration = readMigration('0006_sync_cursors.sql');

    expect(migration).toContain('create table if not exists public.sync_cursors');
    expect(migration).toContain('unique (workspace_id, resource_type, resource_key)');
    expect(migration).toContain("check (resource_type in ('project_config', 'progress_sheet', 'feature_manifest'))");
    expect(migration).toContain('create policy pm_sync_cursors_read_developer');
    expect(migration).toContain("values ('0006_sync_cursors')");
    expect(canReadSyncCursors('developer')).toBe(true);
    expect(canReadSyncCursors('viewer')).toBe(false);
  });

  it('adds admin-scoped membership reads for Admin Console roster', () => {
    const migration = readMigration('0007_workspace_memberships_admin_read.sql');

    expect(migration).toContain('create policy pm_memberships_read_admin');
    expect(migration).toContain('create or replace function public.pm_is_workspace_admin');
    expect(migration).toContain("values ('0007_workspace_memberships_admin_read')");
    expect(canReadWorkspaceMembers('admin')).toBe(true);
    expect(canReadWorkspaceMembers('developer')).toBe(false);
  });

  it('adds audited membership role updates through a security definer RPC', () => {
    const migration = readMigration('0008_workspace_membership_role_update.sql');

    expect(migration).toContain('create or replace function public.pm_update_workspace_member_role');
    expect(migration).toContain("'membership.role_changed'");
    expect(migration).toContain('grant execute on function public.pm_update_workspace_member_role');
    expect(migration).toContain("values ('0008_workspace_membership_role_update')");
    expect(canManageWorkspaceMembers('admin')).toBe(true);
    expect(canManageWorkspaceMembers('developer')).toBe(false);
  });

  it('adds audited membership adds through a security definer RPC', () => {
    const migration = readMigration('0009_workspace_membership_add.sql');

    expect(migration).toContain('create or replace function public.pm_add_workspace_member');
    expect(migration).toContain("'membership.added'");
    expect(migration).toContain('grant execute on function public.pm_add_workspace_member');
    expect(migration).toContain("values ('0009_workspace_membership_add')");
  });

  it('adds audited membership removals through a security definer RPC', () => {
    const migration = readMigration('0010_workspace_membership_remove.sql');

    expect(migration).toContain('create or replace function public.pm_remove_workspace_member');
    expect(migration).toContain("'membership.removed'");
    expect(migration).toContain('grant execute on function public.pm_remove_workspace_member');
    expect(migration).toContain("values ('0010_workspace_membership_remove')");
  });

  it('adds authenticated workspace creation through a security definer RPC', () => {
    const migration = readMigration('0011_workspace_create.sql');

    expect(migration).toContain('create or replace function public.pm_create_workspace');
    expect(migration).toContain("'workspace.created'");
    expect(migration).toContain("values ('0011_workspace_create')");
  });

  it('adds email workspace invites with accept RPC and invite RLS', () => {
    const migration = readMigration('0012_workspace_invites.sql');

    expect(migration).toContain('create table if not exists public.workspace_invites');
    expect(migration).toContain('create or replace function public.pm_invite_workspace_member');
    expect(migration).toContain('create or replace function public.pm_accept_workspace_invite');
    expect(migration).toContain("'membership.invited'");
    expect(migration).toContain('pm_invites_read_admin');
    expect(migration).toContain("values ('0012_workspace_invites')");
  });

  it('ships multi-workspace RLS integration fixtures for workspace picker scoping', () => {
    const seed = readFileSync(join(process.cwd(), 'infra/supabase/tests/fixtures/rls_seed.sql'), 'utf8');
    const scopeTest = readFileSync(
      join(process.cwd(), 'infra/supabase/tests/rls_workspace_scope.test.sql'),
      'utf8',
    );

    expect(seed).toContain('a0000000-0000-4000-8000-000000000099');
    expect(seed).toContain('fixture-runner-beta');
    expect(seed).toContain('Portal Progress Blocked');
    expect(seed).toContain('Soft Deleted Fixture');
    expect(seed).toContain('01000000-0000-4000-8000-000000000001');
    expect(scopeTest).toContain('dual member alpha scope');
    expect(scopeTest).toContain('workspace_id = alpha_workspace');
  });
});
