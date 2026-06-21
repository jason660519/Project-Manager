-- F48 slice 3: Developer Runner pairing metadata (cloud control plane).
-- Stores pairing + heartbeat status only — runner tokens stay in OS Keychain.
-- See docs/engineering/supabase-db-design-standard.md and lib/auth/runnerStatus.ts

insert into pm_system.schema_migrations (version)
values ('0003_runner_devices')
on conflict (version) do nothing;

create table if not exists public.runner_devices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  runner_id text not null,
  device_label text,
  paired_by_user_id uuid,
  status text not null default 'paired_offline'
    check (status in ('missing', 'paired_offline', 'project_blocked', 'ready', 'error')),
  last_seen_at timestamptz,
  approved_project_root text,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, runner_id)
);

create index if not exists idx_runner_devices_workspace_id on public.runner_devices (workspace_id);
create index if not exists idx_runner_devices_workspace_runner on public.runner_devices (workspace_id, runner_id);
create index if not exists idx_runner_devices_last_seen on public.runner_devices (workspace_id, last_seen_at desc);

do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise notice 'auth.uid() not found: leaving runner_devices without RLS. Wire Supabase auth, then enable RLS with policies before exposing authenticated clients.';
    return;
  end if;

  execute 'alter table public.runner_devices enable row level security';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'runner_devices' and policyname = 'pm_runner_devices_read_developer'
  ) then
    execute $p$
      create policy pm_runner_devices_read_developer on public.runner_devices
        for select using (
          exists (
            select 1 from public.workspace_memberships m
            where m.workspace_id = runner_devices.workspace_id
              and m.user_id = (select auth.uid())
              and m.role in ('owner', 'admin', 'developer')
          )
        )
    $p$;
  end if;
end $$;
