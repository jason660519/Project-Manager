-- F48 slice 11: authenticated workspace creation for onboarding.

insert into pm_system.schema_migrations (version)
values ('0011_workspace_create')
on conflict (version) do nothing;

create or replace function public.pm_create_workspace(
  p_name text
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
  v_actor_id uuid := (select auth.uid());
  v_name text := nullif(btrim(p_name), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if v_name is null then
    raise exception 'Workspace name is required';
  end if;

  if char_length(v_name) > 200 then
    raise exception 'Workspace name must be 200 characters or fewer';
  end if;

  insert into public.workspaces (name)
  values (v_name)
  returning * into v_workspace;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (v_workspace.id, v_actor_id, 'owner');

  insert into public.audit_logs (
    workspace_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_workspace.id,
    v_actor_id,
    'workspace.created',
    'workspace',
    v_workspace.id,
    jsonb_build_object('name', v_workspace.name)
  );

  return v_workspace;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.pm_create_workspace(text) to authenticated;
  end if;
end $$;
