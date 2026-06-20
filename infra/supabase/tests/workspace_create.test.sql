-- Workspace create RPC integration assertions.

do $$
declare
  onboard_user constant uuid := 'a0000000-0000-4000-8000-000000000020';
  new_workspace public.workspaces;
  membership_count integer;
  audit_count integer;
begin
  perform set_config('request.jwt.claim.sub', onboard_user::text, true);
  execute 'set local role authenticated';

  new_workspace := public.pm_create_workspace('Onboard Test Workspace');

  if new_workspace.name <> 'Onboard Test Workspace' then
    raise exception 'workspace create: unexpected workspace name';
  end if;

  select count(*) into membership_count
  from public.workspace_memberships
  where workspace_id = new_workspace.id
    and user_id = onboard_user
    and role = 'owner';

  if membership_count <> 1 then
    raise exception 'workspace create: expected owner membership row';
  end if;

  select count(*) into audit_count
  from public.audit_logs
  where workspace_id = new_workspace.id
    and action = 'workspace.created';

  if audit_count <> 1 then
    raise exception 'workspace create: expected audit log row';
  end if;

  raise notice 'workspace create RPC integration tests passed.';
end $$;
