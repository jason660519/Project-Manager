-- F48 slice 9: audited workspace membership adds for Admin Console.
-- Stub for local/dev membership grants by Supabase auth user id; email invite flow lands later.

insert into pm_system.schema_migrations (version)
values ('0009_workspace_membership_add')
on conflict (version) do nothing;

create or replace function public.pm_add_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.workspace_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.workspace_memberships;
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.pm_is_workspace_admin(p_workspace_id) then
    raise exception 'Admin permission required';
  end if;

  if p_role not in ('owner', 'admin', 'developer', 'reviewer', 'viewer', 'user') then
    raise exception 'Invalid role: %', p_role;
  end if;

  if p_user_id = v_actor_id then
    raise exception 'Cannot add your own workspace membership';
  end if;

  if p_role = 'owner' then
    if not exists (
      select 1
      from public.workspace_memberships m
      where m.workspace_id = p_workspace_id
        and m.user_id = v_actor_id
        and m.role = 'owner'
    ) then
      raise exception 'Owner permission required to assign owner role';
    end if;
  end if;

  if exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = p_user_id
  ) then
    raise exception 'User is already a member of this workspace';
  end if;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (p_workspace_id, p_user_id, p_role)
  returning * into v_membership;

  insert into public.audit_logs (
    workspace_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_membership.workspace_id,
    v_actor_id,
    'membership.added',
    'workspace_membership',
    v_membership.id,
    jsonb_build_object(
      'target_user_id', v_membership.user_id,
      'role', v_membership.role
    )
  );

  return v_membership;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.pm_add_workspace_member(uuid, uuid, text) to authenticated;
  end if;
end $$;
