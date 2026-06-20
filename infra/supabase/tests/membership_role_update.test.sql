-- Audited membership role update RPC integration assertions.
-- Run via: PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker

do $$
declare
  alpha_workspace constant uuid := 'c0000000-0000-4000-8000-000000000001';
  developer_user constant uuid := 'a0000000-0000-4000-8000-000000000001';
  admin_user constant uuid := 'b0000000-0000-4000-8000-000000000001';
  target_membership_id uuid;
  updated_role text;
  audit_count integer;
begin
  select id into target_membership_id
  from public.workspace_memberships
  where workspace_id = alpha_workspace
    and user_id = developer_user;

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  perform public.pm_update_workspace_member_role(target_membership_id, 'reviewer');

  select role into updated_role
  from public.workspace_memberships
  where id = target_membership_id;

  if updated_role <> 'reviewer' then
    raise exception 'admin role update: expected reviewer, saw %', updated_role;
  end if;

  select count(*) into audit_count
  from public.audit_logs
  where workspace_id = alpha_workspace
    and action = 'membership.role_changed'
    and resource_id = target_membership_id;

  if audit_count < 1 then
    raise exception 'admin role update: expected audit log row';
  end if;

  perform set_config('request.jwt.claim.sub', developer_user::text, true);
  execute 'set local role authenticated';

  begin
    perform public.pm_update_workspace_member_role(target_membership_id, 'developer');
    raise exception 'non-admin must not call membership role update RPC';
  exception
    when others then
      if position('Admin permission required' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';
  perform public.pm_update_workspace_member_role(target_membership_id, 'developer');

  raise notice 'membership role update RPC integration tests passed.';
end $$;
