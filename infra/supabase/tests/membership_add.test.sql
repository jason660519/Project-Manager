-- Audited workspace membership add RPC integration assertions.
-- Run via: PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker

do $$
declare
  alpha_workspace constant uuid := 'c0000000-0000-4000-8000-000000000001';
  admin_user constant uuid := 'b0000000-0000-4000-8000-000000000001';
  invite_user constant uuid := 'a0000000-0000-4000-8000-000000000010';
  new_membership public.workspace_memberships;
  member_count integer;
  audit_count integer;
begin
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  new_membership := public.pm_add_workspace_member(alpha_workspace, invite_user, 'viewer');

  if new_membership.user_id <> invite_user then
    raise exception 'membership add: expected invite user id';
  end if;

  select count(*) into member_count
  from public.workspace_memberships
  where workspace_id = alpha_workspace
    and user_id = invite_user;

  if member_count <> 1 then
    raise exception 'membership add: expected 1 new membership row, saw %', member_count;
  end if;

  select count(*) into audit_count
  from public.audit_logs
  where workspace_id = alpha_workspace
    and action = 'membership.added'
    and resource_id = new_membership.id;

  if audit_count <> 1 then
    raise exception 'membership add: expected audit log row';
  end if;

  begin
    perform public.pm_add_workspace_member(alpha_workspace, invite_user, 'user');
    raise exception 'membership add: duplicate membership must fail';
  exception
    when others then
      if position('already a member' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', invite_user::text, true);
  execute 'set local role authenticated';

  begin
    perform public.pm_add_workspace_member(alpha_workspace, 'a0000000-0000-4000-8000-000000000002', 'user');
    raise exception 'non-admin must not add workspace members';
  exception
    when others then
      if position('Admin permission required' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  raise notice 'membership add RPC integration tests passed.';
end $$;
