-- F48 slice 7: owner/admin may list workspace memberships for Admin Console.
-- Complements pm_memberships_read_own (self row only) without opening cross-workspace reads.
-- Uses a security definer helper to avoid RLS infinite recursion on workspace_memberships.

insert into pm_system.schema_migrations (version)
values ('0007_workspace_memberships_admin_read')
on conflict (version) do nothing;

create or replace function public.pm_is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.pm_is_workspace_admin(uuid) to authenticated;
  end if;
end $$;

do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise notice 'auth.uid() not found: skipping pm_memberships_read_admin policy.';
    return;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_memberships' and policyname = 'pm_memberships_read_admin'
  ) then
    execute $p$
      create policy pm_memberships_read_admin on public.workspace_memberships
        for select using (public.pm_is_workspace_admin(workspace_id))
    $p$;
  end if;
end $$;
