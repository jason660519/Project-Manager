-- Audited workspace membership remove RPC integration assertions.
-- Run via: PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker

do $$
declare
  alpha_workspace constant uuid := 'c0000000-0000-4000-8000-000000000001';
  admin_user constant uuid := 'b0000000-0000-4000-8000-000000000001';
  invite_user constant uuid := 'a0000000-0000-4000-8000-000000000010';
  removed_membership public.workspace_memberships;
  invite_membership_id uuid;
  member_count integer;
  audit_count integer;
begin
  select id into invite_membership_id
  from public.workspace_memberships
  where workspace_id = alpha_workspace
    and user_id = invite_user;

  if invite_membership_id is null then
    raise exception 'membership remove: expected invite user membership from add test fixture';
  end if;

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  removed_membership := public.pm_remove_workspace_member(invite_membership_id);

  if removed_membership.user_id <> invite_user then
    raise exception 'membership remove: expected invite user id';
  end if;

  select count(*) into member_count
  from public.workspace_memberships
  where workspace_id = alpha_workspace
    and user_id = invite_user;

  if member_count <> 0 then
    raise exception 'membership remove: expected membership row deleted, saw %', member_count;
  end if;

  select count(*) into audit_count
  from public.audit_logs
  where workspace_id = alpha_workspace
    and action = 'membership.removed'
    and resource_id = invite_membership_id;

  if audit_count <> 1 then
    raise exception 'membership remove: expected audit log row';
  end if;

  perform set_config('request.jwt.claim.sub', invite_user::text, true);
  execute 'set local role authenticated';

  begin
    perform public.pm_remove_workspace_member(invite_membership_id);
    raise exception 'non-admin must not remove workspace members';
  exception
    when others then
      if position('Admin permission required' in sqlerrm) = 0
         and position('Membership not found' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  raise notice 'membership remove RPC integration tests passed.';
end $$;
