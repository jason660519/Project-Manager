-- F48 slice 8: audited workspace membership role updates for Admin Console.
-- Uses security definer RPC so authenticated clients never need the service-role key.

insert into pm_system.schema_migrations (version)
values ('0008_workspace_membership_role_update')
on conflict (version) do nothing;

create or replace function public.pm_update_workspace_member_role(
  p_membership_id uuid,
  p_new_role text
)
returns public.workspace_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.workspace_memberships;
  v_previous_role text;
  v_actor_id uuid := (select auth.uid());
  v_owner_count integer;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_membership
  from public.workspace_memberships
  where id = p_membership_id;

  if not found then
    raise exception 'Membership not found';
  end if;

  if not public.pm_is_workspace_admin(v_membership.workspace_id) then
    raise exception 'Admin permission required';
  end if;

  if p_new_role not in ('owner', 'admin', 'developer', 'reviewer', 'viewer', 'user') then
    raise exception 'Invalid role: %', p_new_role;
  end if;

  if v_membership.user_id = v_actor_id then
    raise exception 'Cannot change your own workspace role';
  end if;

  if v_membership.role = 'owner' or p_new_role = 'owner' then
    if not exists (
      select 1
      from public.workspace_memberships m
      where m.workspace_id = v_membership.workspace_id
        and m.user_id = v_actor_id
        and m.role = 'owner'
    ) then
      raise exception 'Owner permission required for owner role changes';
    end if;
  end if;

  v_previous_role := v_membership.role;

  if v_previous_role = p_new_role then
    return v_membership;
  end if;

  if v_previous_role = 'owner' and p_new_role <> 'owner' then
    select count(*) into v_owner_count
    from public.workspace_memberships
    where workspace_id = v_membership.workspace_id
      and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'Cannot remove the last workspace owner';
    end if;
  end if;

  update public.workspace_memberships
  set role = p_new_role
  where id = p_membership_id
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
    'membership.role_changed',
    'workspace_membership',
    v_membership.id,
    jsonb_build_object(
      'target_user_id', v_membership.user_id,
      'previous_role', v_previous_role,
      'new_role', p_new_role
    )
  );

  return v_membership;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.pm_update_workspace_member_role(uuid, text) to authenticated;
  end if;
end $$;
