-- F48 PM System initial schema scaffold.
-- This migration is intentionally minimal and should be expanded before live use.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'developer', 'reviewer', 'viewer', 'user')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  solution_detail_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  runner_id text,
  status text not null default 'queued',
  summary text,
  created_at timestamptz not null default now()
);

-- Row Level Security.
--
-- RLS is enabled together with membership-scoped policies so the tables are
-- never left in a silent "RLS enabled, zero policies = deny-all" state. We only
-- do this when the Supabase auth schema is present (auth.uid()); on a bare
-- Postgres without auth wired, we emit a loud NOTICE and leave RLS OFF rather
-- than silently denying every authenticated query. Writes are expected to go
-- through the service-role key (which bypasses RLS) until write policies are
-- added in a later slice.
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise notice 'auth.uid() not found: leaving PM tables without RLS. Wire Supabase auth, then enable RLS with policies before exposing authenticated clients.';
    return;
  end if;

  execute 'alter table public.workspaces enable row level security';
  execute 'alter table public.workspace_memberships enable row level security';
  execute 'alter table public.projects enable row level security';
  execute 'alter table public.agent_runs enable row level security';

  execute $p$
    create policy pm_memberships_read_own on public.workspace_memberships
      for select using (user_id = (select auth.uid()))
  $p$;
  execute $p$
    create policy pm_workspaces_read_member on public.workspaces
      for select using (
        exists (
          select 1 from public.workspace_memberships m
          where m.workspace_id = workspaces.id and m.user_id = (select auth.uid())
        )
      )
  $p$;
  execute $p$
    create policy pm_projects_read_member on public.projects
      for select using (
        exists (
          select 1 from public.workspace_memberships m
          where m.workspace_id = projects.workspace_id and m.user_id = (select auth.uid())
        )
      )
  $p$;
  execute $p$
    create policy pm_agent_runs_read_member on public.agent_runs
      for select using (
        exists (
          select 1 from public.workspace_memberships m
          where m.workspace_id = agent_runs.workspace_id and m.user_id = (select auth.uid())
        )
      )
  $p$;
end $$;
