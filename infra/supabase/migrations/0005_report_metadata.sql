-- F48 slice 5: User Portal report index (metadata + links only).
-- Report bodies live in static pages, Git, or Storage — not in Postgres rows.
-- See docs/engineering/supabase-db-design-standard.md §6.6 and F47.

insert into pm_system.schema_migrations (version)
values ('0005_report_metadata')
on conflict (version) do nothing;

create table if not exists public.report_metadata (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  feature_id uuid references public.features(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  report_key text not null,
  title text not null,
  report_type text not null default 'delivery_summary'
    check (report_type in ('delivery_summary', 'solution_detail', 'run_summary', 'milestone', 'general')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  summary text,
  content_url text,
  storage_path text,
  content_sha text,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, report_key)
);

create index if not exists idx_report_metadata_workspace_id on public.report_metadata (workspace_id);
create index if not exists idx_report_metadata_project_id on public.report_metadata (project_id);
create index if not exists idx_report_metadata_workspace_status on public.report_metadata (workspace_id, status);
create index if not exists idx_report_metadata_workspace_published on public.report_metadata (workspace_id, published_at desc);

create or replace function public.pm_enforce_report_metadata_workspace()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.workspace_id = new.workspace_id
  ) then
    raise exception 'project_id must belong to the same workspace as report_metadata.workspace_id';
  end if;

  if new.feature_id is not null and not exists (
    select 1 from public.features f
    where f.id = new.feature_id and f.workspace_id = new.workspace_id
  ) then
    raise exception 'feature_id must belong to the same workspace as report_metadata.workspace_id';
  end if;

  if new.agent_run_id is not null and not exists (
    select 1 from public.agent_runs r
    where r.id = new.agent_run_id and r.workspace_id = new.workspace_id
  ) then
    raise exception 'agent_run_id must belong to the same workspace as report_metadata.workspace_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_report_metadata_workspace on public.report_metadata;

create trigger trg_report_metadata_workspace
  before insert or update of workspace_id, project_id, feature_id, agent_run_id
  on public.report_metadata
  for each row
  execute function public.pm_enforce_report_metadata_workspace();

do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise notice 'auth.uid() not found: leaving report_metadata without RLS. Wire Supabase auth, then enable RLS with policies before exposing authenticated clients.';
    return;
  end if;

  execute 'alter table public.report_metadata enable row level security';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'report_metadata' and policyname = 'pm_report_metadata_read_member'
  ) then
    execute $p$
      create policy pm_report_metadata_read_member on public.report_metadata
        for select using (
          exists (
            select 1 from public.workspace_memberships m
            where m.workspace_id = report_metadata.workspace_id
              and m.user_id = (select auth.uid())
              and (
                report_metadata.status = 'published'
                or m.role in ('owner', 'admin', 'developer', 'reviewer')
              )
            )
        )
    $p$;
  end if;
end $$;
