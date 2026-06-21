-- Multi-workspace membership + workspace_id scoping assertions.
-- Mirrors the browser workspace picker: RLS allows all member workspaces, client queries filter by workspace_id.
-- Run via: PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker

do $$
declare
  alpha_workspace constant uuid := 'c0000000-0000-4000-8000-000000000001';
  beta_workspace constant uuid := 'c0000000-0000-4000-8000-000000000002';
  dual_member constant uuid := 'a0000000-0000-4000-8000-000000000099';
  visible_memberships integer;
  visible_projects integer;
  scoped_projects integer;
  visible_reports integer;
  scoped_reports integer;
  visible_runners integer;
  scoped_runners integer;
  visible_runs integer;
  scoped_runs integer;
  visible_audit_logs integer;
  scoped_audit_logs integer;
  visible_sync_cursors integer;
  scoped_sync_cursors integer;
  scoped_memberships integer;
begin
  perform set_config('request.jwt.claim.sub', dual_member::text, true);
  execute 'set local role authenticated';

  select count(*) into visible_memberships from public.workspace_memberships;
  if visible_memberships <> 3 then
    raise exception 'dual member: expected 3 membership rows (own alpha + beta admin roster), saw %', visible_memberships;
  end if;

  select count(*) into scoped_memberships
  from public.workspace_memberships
  where workspace_id = alpha_workspace;
  if scoped_memberships <> 1 then
    raise exception 'dual member alpha scope: expected 1 own membership, saw %', scoped_memberships;
  end if;

  select count(*) into scoped_memberships
  from public.workspace_memberships
  where workspace_id = beta_workspace;
  if scoped_memberships <> 2 then
    raise exception 'dual member beta scope: expected 2 memberships as beta admin, saw %', scoped_memberships;
  end if;

  select count(*) into visible_projects from public.projects;
  if visible_projects <> 2 then
    raise exception 'dual member: expected 2 projects across member workspaces, saw %', visible_projects;
  end if;

  select count(*) into scoped_projects
  from public.projects
  where workspace_id = alpha_workspace;
  if scoped_projects <> 1 then
    raise exception 'dual member alpha scope: expected 1 project, saw %', scoped_projects;
  end if;

  select count(*) into scoped_projects
  from public.projects
  where workspace_id = beta_workspace;
  if scoped_projects <> 1 then
    raise exception 'dual member beta scope: expected 1 project, saw %', scoped_projects;
  end if;

  select count(*) into visible_reports from public.report_metadata;
  if visible_reports <> 3 then
    raise exception 'dual member: expected 3 reports across member workspaces, saw %', visible_reports;
  end if;

  select count(*) into scoped_reports
  from public.report_metadata
  where workspace_id = alpha_workspace;
  if scoped_reports <> 2 then
    raise exception 'dual member alpha scope: expected 2 reports, saw %', scoped_reports;
  end if;

  select count(*) into scoped_reports
  from public.report_metadata
  where workspace_id = beta_workspace;
  if scoped_reports <> 1 then
    raise exception 'dual member beta scope: expected 1 report, saw %', scoped_reports;
  end if;

  select count(*) into visible_runners from public.runner_devices;
  if visible_runners <> 2 then
    raise exception 'dual member: expected 2 runner devices across member workspaces, saw %', visible_runners;
  end if;

  select count(*) into scoped_runners
  from public.runner_devices
  where workspace_id = alpha_workspace;
  if scoped_runners <> 1 then
    raise exception 'dual member alpha scope: expected 1 runner device, saw %', scoped_runners;
  end if;

  select count(*) into scoped_runners
  from public.runner_devices
  where workspace_id = beta_workspace;
  if scoped_runners <> 1 then
    raise exception 'dual member beta scope: expected 1 runner device, saw %', scoped_runners;
  end if;

  select count(*) into visible_runs from public.agent_runs;
  if visible_runs <> 2 then
    raise exception 'dual member: expected 2 agent runs across member workspaces, saw %', visible_runs;
  end if;

  select count(*) into scoped_runs
  from public.agent_runs
  where workspace_id = alpha_workspace;
  if scoped_runs <> 1 then
    raise exception 'dual member alpha scope: expected 1 agent run, saw %', scoped_runs;
  end if;

  select count(*) into scoped_runs
  from public.agent_runs
  where workspace_id = beta_workspace;
  if scoped_runs <> 1 then
    raise exception 'dual member beta scope: expected 1 agent run, saw %', scoped_runs;
  end if;

  select count(*) into visible_audit_logs from public.audit_logs;
  if visible_audit_logs <> 1 then
    raise exception 'dual member: expected 1 admin-visible audit log (beta only), saw %', visible_audit_logs;
  end if;

  select count(*) into scoped_audit_logs
  from public.audit_logs
  where workspace_id = alpha_workspace;
  if scoped_audit_logs <> 0 then
    raise exception 'dual member alpha scope: developer role must not read alpha audit logs';
  end if;

  select count(*) into scoped_audit_logs
  from public.audit_logs
  where workspace_id = beta_workspace;
  if scoped_audit_logs <> 1 then
    raise exception 'dual member beta scope: expected 1 audit log, saw %', scoped_audit_logs;
  end if;

  select count(*) into visible_sync_cursors from public.sync_cursors;
  if visible_sync_cursors <> 2 then
    raise exception 'dual member: expected 2 sync cursors across member workspaces, saw %', visible_sync_cursors;
  end if;

  select count(*) into scoped_sync_cursors
  from public.sync_cursors
  where workspace_id = alpha_workspace;
  if scoped_sync_cursors <> 1 then
    raise exception 'dual member alpha scope: expected 1 sync cursor, saw %', scoped_sync_cursors;
  end if;

  select count(*) into scoped_sync_cursors
  from public.sync_cursors
  where workspace_id = beta_workspace;
  if scoped_sync_cursors <> 1 then
    raise exception 'dual member beta scope: expected 1 sync cursor, saw %', scoped_sync_cursors;
  end if;

  raise notice 'RLS workspace scope integration tests passed.';
end $$;
