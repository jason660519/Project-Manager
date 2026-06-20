-- F48 slice 10: audited workspace membership removals for Admin Console.

insert into pm_system.schema_migrations (version)
values ('0010_workspace_membership_remove')
on conflict (version) do nothing;

create or replace function public.pm_remove_workspace_member(
  p_membership_id uuid
)
returns public.workspace_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.workspace_memberships;
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

  if v_membership.user_id = v_actor_id then
    raise exception 'Cannot remove your own workspace membership';
  end if;

  if v_membership.role = 'owner' then
    if not exists (
      select 1
      from public.workspace_memberships m
      where m.workspace_id = v_membership.workspace_id
        and m.user_id = v_actor_id
        and m.role = 'owner'
    ) then
      raise exception 'Owner permission required to remove owner membership';
    end if;

    select count(*) into v_owner_count
    from public.workspace_memberships
    where workspace_id = v_membership.workspace_id
      and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'Cannot remove the last workspace owner';
    end if;
  end if;

  delete from public.workspace_memberships
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
    'membership.removed',
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
    grant execute on function public.pm_remove_workspace_member(uuid) to authenticated;
  end if;
end $$;
