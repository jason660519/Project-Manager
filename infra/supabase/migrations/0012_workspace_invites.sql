-- F48 slice 12: email workspace invites (pending rows + accept RPC; no outbound mail in Postgres).

insert into pm_system.schema_migrations (version)
values ('0012_workspace_invites')
on conflict (version) do nothing;

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null
    check (role in ('owner', 'admin', 'developer', 'reviewer', 'viewer', 'user')),
  invited_by_user_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists idx_workspace_invites_workspace_id
  on public.workspace_invites (workspace_id);

create unique index if not exists idx_workspace_invites_pending_email
  on public.workspace_invites (workspace_id, lower(email))
  where status = 'pending';

create or replace function public.pm_auth_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (select u.email from auth.users u where u.id = (select auth.uid()))
  );
$$;

create or replace function public.pm_invite_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_role text
)
returns public.workspace_invites
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite public.workspace_invites;
  v_actor_id uuid := (select auth.uid());
  v_email text := lower(btrim(p_email));
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.pm_is_workspace_admin(p_workspace_id) then
    raise exception 'Admin permission required';
  end if;

  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Valid email is required';
  end if;

  if p_role not in ('owner', 'admin', 'developer', 'reviewer', 'viewer', 'user') then
    raise exception 'Invalid role: %', p_role;
  end if;

  if p_role = 'owner' then
    if not exists (
      select 1
      from public.workspace_memberships m
      where m.workspace_id = p_workspace_id
        and m.user_id = v_actor_id
        and m.role = 'owner'
    ) then
      raise exception 'Owner permission required to invite owner role';
    end if;
  end if;

  if exists (
    select 1
    from public.workspace_memberships m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id
      and lower(u.email) = v_email
  ) then
    raise exception 'User is already a member of this workspace';
  end if;

  if exists (
    select 1
    from public.workspace_invites i
    where i.workspace_id = p_workspace_id
      and lower(i.email) = v_email
      and i.status = 'pending'
  ) then
    raise exception 'A pending invite already exists for this email';
  end if;

  insert into public.workspace_invites (workspace_id, email, role, invited_by_user_id)
  values (p_workspace_id, v_email, p_role, v_actor_id)
  returning * into v_invite;

  insert into public.audit_logs (
    workspace_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_invite.workspace_id,
    v_actor_id,
    'membership.invited',
    'workspace_invite',
    v_invite.id,
    jsonb_build_object(
      'email', v_invite.email,
      'role', v_invite.role
    )
  );

  return v_invite;
end;
$$;

create or replace function public.pm_accept_workspace_invite(
  p_invite_id uuid
)
returns public.workspace_memberships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite public.workspace_invites;
  v_membership public.workspace_memberships;
  v_actor_id uuid := (select auth.uid());
  v_actor_email text := public.pm_auth_email();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if v_actor_email is null then
    raise exception 'Signed-in account email is required to accept an invite';
  end if;

  select * into v_invite
  from public.workspace_invites
  where id = p_invite_id;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite is no longer pending';
  end if;

  if lower(v_invite.email) <> lower(v_actor_email) then
    raise exception 'Invite email does not match signed-in account';
  end if;

  if exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = v_invite.workspace_id
      and m.user_id = v_actor_id
  ) then
    raise exception 'You are already a member of this workspace';
  end if;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_actor_id, v_invite.role)
  returning * into v_membership;

  update public.workspace_invites
  set status = 'accepted',
      accepted_at = now()
  where id = v_invite.id;

  insert into public.audit_logs (
    workspace_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_invite.workspace_id,
    v_actor_id,
    'membership.invite_accepted',
    'workspace_membership',
    v_membership.id,
    jsonb_build_object(
      'invite_id', v_invite.id,
      'email', v_invite.email,
      'role', v_membership.role
    )
  );

  return v_membership;
end;
$$;

do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise notice 'auth.uid() not found: leaving workspace_invites without RLS.';
    return;
  end if;

  execute 'alter table public.workspace_invites enable row level security';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_invites' and policyname = 'pm_invites_read_admin'
  ) then
    execute $p$
      create policy pm_invites_read_admin on public.workspace_invites
        for select using (public.pm_is_workspace_admin(workspace_id))
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_invites' and policyname = 'pm_invites_read_pending_self'
  ) then
    execute $p$
      create policy pm_invites_read_pending_self on public.workspace_invites
        for select using (
          status = 'pending'
          and lower(email) = lower(public.pm_auth_email())
        )
    $p$;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.pm_auth_email() to authenticated;
    grant execute on function public.pm_invite_workspace_member(uuid, text, text) to authenticated;
    grant execute on function public.pm_accept_workspace_invite(uuid) to authenticated;
  end if;
end $$;
