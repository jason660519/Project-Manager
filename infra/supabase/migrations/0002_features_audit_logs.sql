-- F48 slice 2: cloud feature metadata and audit trail.
-- Adds features + audit_logs with workspace-scoped RLS.
-- See docs/engineering/supabase-db-design-standard.md

insert into pm_system.schema_migrations (version)
values ('0002_features_audit_logs')
on conflict (version) do nothing;

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  feature_key text not null,
  title text not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'blocked', 'review', 'done', 'archived')),
  progress_percent numeric(5, 2)
    check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)),
  local_config_path text,
  solution_detail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (project_id, feature_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_features_workspace_id on public.features (workspace_id);
create index if not exists idx_features_project_id on public.features (project_id);
create index if not exists idx_features_workspace_created on public.features (workspace_id, created_at desc);
create index if not exists idx_audit_logs_workspace_id on public.audit_logs (workspace_id);
create index if not exists idx_audit_logs_workspace_created on public.audit_logs (workspace_id, created_at desc);
create index if not exists idx_audit_logs_actor_user_id on public.audit_logs (actor_user_id);

-- Row Level Security (same auth.uid() gate as 0001_pm_core.sql).
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise notice 'auth.uid() not found: leaving features/audit_logs without RLS. Wire Supabase auth, then enable RLS with policies before exposing authenticated clients.';
    return;
  end if;

  execute 'alter table public.features enable row level security';
  execute 'alter table public.audit_logs enable row level security';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'features' and policyname = 'pm_features_read_member'
  ) then
    execute $p$
      create policy pm_features_read_member on public.features
        for select using (
          exists (
            select 1 from public.workspace_memberships m
            where m.workspace_id = features.workspace_id and m.user_id = (select auth.uid())
          )
        )
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'pm_audit_logs_read_admin'
  ) then
    execute $p$
      create policy pm_audit_logs_read_admin on public.audit_logs
        for select using (
          exists (
            select 1 from public.workspace_memberships m
            where m.workspace_id = audit_logs.workspace_id
              and m.user_id = (select auth.uid())
              and m.role in ('owner', 'admin')
          )
        )
    $p$;
  end if;
end $$;
