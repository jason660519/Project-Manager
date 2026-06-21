-- F48 slice 6: cloud/local sync cursor bookkeeping (metadata only).
-- Tracks revision pointers for future writeback; does not store full project payloads.
-- See docs/engineering/supabase-db-design-standard.md and storage-and-schema.md

insert into pm_system.schema_migrations (version)
values ('0006_sync_cursors')
on conflict (version) do nothing;

create table if not exists public.sync_cursors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  resource_type text not null
    check (resource_type in ('project_config', 'progress_sheet', 'feature_manifest')),
  resource_key text not null,
  local_revision text,
  cloud_revision text,
  last_synced_at timestamptz,
  sync_status text not null default 'idle'
    check (sync_status in ('idle', 'pending', 'conflict', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, resource_type, resource_key)
);

create index if not exists idx_sync_cursors_workspace_id on public.sync_cursors (workspace_id);
create index if not exists idx_sync_cursors_project_id on public.sync_cursors (project_id);
create index if not exists idx_sync_cursors_workspace_status on public.sync_cursors (workspace_id, sync_status);

do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise notice 'auth.uid() not found: leaving sync_cursors without RLS. Wire Supabase auth, then enable RLS with policies before exposing authenticated clients.';
    return;
  end if;

  execute 'alter table public.sync_cursors enable row level security';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sync_cursors' and policyname = 'pm_sync_cursors_read_developer'
  ) then
    execute $p$
      create policy pm_sync_cursors_read_developer on public.sync_cursors
        for select using (
          exists (
            select 1 from public.workspace_memberships m
            where m.workspace_id = sync_cursors.workspace_id
              and m.user_id = (select auth.uid())
              and m.role in ('owner', 'admin', 'developer')
          )
        )
    $p$;
  end if;
end $$;
