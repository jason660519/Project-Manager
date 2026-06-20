-- Workspace email invite + accept RPC integration assertions.

do $$
declare
  alpha_workspace constant uuid := 'c0000000-0000-4000-8000-000000000001';
  admin_user constant uuid := 'b0000000-0000-4000-8000-000000000001';
  invite_user constant uuid := 'a0000000-0000-4000-8000-000000000020';
  invite_email constant text := 'onboard@example.test';
  new_invite public.workspace_invites;
  new_membership public.workspace_memberships;
  pending_count integer;
  audit_count integer;
begin
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  new_invite := public.pm_invite_workspace_member(alpha_workspace, invite_email, 'developer');

  if lower(new_invite.email) <> invite_email then
    raise exception 'workspace invite: unexpected invite email';
  end if;

  perform set_config('request.jwt.claim.sub', invite_user::text, true);
  perform set_config('request.jwt.claim.email', invite_email, true);
  execute 'set local role authenticated';

  select count(*) into pending_count
  from public.workspace_invites
  where id = new_invite.id
    and status = 'pending';

  if pending_count <> 1 then
    raise exception 'workspace invite: invitee must read pending invite';
  end if;

  new_membership := public.pm_accept_workspace_invite(new_invite.id);

  if new_membership.role <> 'developer' then
    raise exception 'workspace invite: expected developer membership';
  end if;

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  select count(*) into audit_count
  from public.audit_logs
  where workspace_id = alpha_workspace
    and action = 'membership.invite_accepted'
    and resource_id = new_membership.id;

  if audit_count <> 1 then
    raise exception 'workspace invite: expected invite accepted audit log';
  end if;

  raise notice 'workspace invite RPC integration tests passed.';
end $$;
