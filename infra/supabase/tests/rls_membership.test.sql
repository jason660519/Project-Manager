-- Membership-scoped RLS integration assertions.
-- Run via: npm run test:supabase-rls -- --integration
-- Requires auth.uid() stub (helpers/auth_uid_stub.sql) and fixtures/rls_seed.sql.

do $$
declare
  visible_projects integer;
  visible_other_workspace_projects integer;
  visible_features integer;
  visible_audit_logs integer;
  visible_memberships integer;
  visible_runner_devices integer;
  visible_agent_runs integer;
  visible_reports integer;
begin
  -- Developer member of workspace Alpha only.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  execute 'set local role authenticated';

  select count(*) into visible_projects from public.projects;
  if visible_projects <> 1 then
    raise exception 'member alpha: expected 1 project, saw %', visible_projects;
  end if;

  select count(*) into visible_other_workspace_projects
  from public.projects
  where workspace_id = 'c0000000-0000-4000-8000-000000000002';
  if visible_other_workspace_projects <> 0 then
    raise exception 'member alpha: must not read beta workspace projects';
  end if;

  select count(*) into visible_features from public.features;
  if visible_features <> 5 then
    raise exception 'member alpha: expected 5 features (including soft-deleted), saw %', visible_features;
  end if;

  select count(*) into visible_audit_logs from public.audit_logs;
  if visible_audit_logs <> 0 then
    raise exception 'developer member must not read audit_logs (admin-only policy)';
  end if;

  select count(*) into visible_memberships from public.workspace_memberships;
  if visible_memberships <> 1 then
    raise exception 'member alpha: expected 1 own membership row, saw %', visible_memberships;
  end if;

  select count(*) into visible_runner_devices from public.runner_devices;
  if visible_runner_devices <> 1 then
    raise exception 'developer alpha: expected 1 runner device, saw %', visible_runner_devices;
  end if;

  select count(*) into visible_agent_runs from public.agent_runs;
  if visible_agent_runs <> 1 then
    raise exception 'developer alpha: expected 1 agent run, saw %', visible_agent_runs;
  end if;

  select count(*) into visible_reports from public.report_metadata;
  if visible_reports <> 2 then
    raise exception 'developer alpha: expected 2 reports (draft + published), saw %', visible_reports;
  end if;

  -- Admin member of workspace Alpha can read audit logs in that workspace only.
  perform set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
  execute 'set local role authenticated';

  select count(*) into visible_audit_logs from public.audit_logs;
  if visible_audit_logs <> 1 then
    raise exception 'admin alpha: expected 1 audit log, saw %', visible_audit_logs;
  end if;

  select count(*) into visible_memberships from public.workspace_memberships;
  if visible_memberships <> 3 then
    raise exception 'admin alpha: expected 3 alpha workspace memberships, saw %', visible_memberships;
  end if;

  select count(*) into visible_memberships
  from public.workspace_memberships
  where workspace_id = 'c0000000-0000-4000-8000-000000000002';
  if visible_memberships <> 0 then
    raise exception 'admin alpha: must not read beta workspace memberships';
  end if;

  select count(*) into visible_other_workspace_projects
  from public.projects
  where workspace_id = 'c0000000-0000-4000-8000-000000000002';
  if visible_other_workspace_projects <> 0 then
    raise exception 'admin alpha: must not read beta workspace projects';
  end if;

  -- Viewer in workspace Beta cannot read Alpha rows by direct table scan.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  execute 'set local role authenticated';

  select count(*) into visible_projects from public.projects;
  if visible_projects <> 1 then
    raise exception 'viewer beta: expected 1 project, saw %', visible_projects;
  end if;

  select count(*) into visible_other_workspace_projects
  from public.projects
  where id = 'd0000000-0000-4000-8000-000000000001';
  if visible_other_workspace_projects <> 0 then
    raise exception 'viewer beta: must not read alpha project by id guess';
  end if;

  select count(*) into visible_runner_devices from public.runner_devices;
  if visible_runner_devices <> 0 then
    raise exception 'viewer beta: must not read runner_devices (developer-only policy)';
  end if;

  select count(*) into visible_reports from public.report_metadata;
  if visible_reports <> 1 then
    raise exception 'viewer beta: expected 1 published report in beta workspace, saw %', visible_reports;
  end if;

  select count(*) into visible_reports
  from public.report_metadata
  where id = 'c1000000-0000-4000-8000-000000000001';
  if visible_reports <> 0 then
    raise exception 'viewer beta: must not read alpha draft report by id guess';
  end if;

  raise notice 'RLS membership integration tests passed.';
end $$;
