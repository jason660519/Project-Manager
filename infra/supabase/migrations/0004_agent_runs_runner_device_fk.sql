-- F48 slice 4: canonical runner link on agent_runs.
-- runner_device_id is the FK; runner_id text remains a denormalized snapshot during transition.
-- See docs/engineering/supabase-db-design-standard.md §6.6

insert into pm_system.schema_migrations (version)
values ('0004_agent_runs_runner_device_fk')
on conflict (version) do nothing;

alter table public.agent_runs
  add column if not exists runner_device_id uuid references public.runner_devices(id) on delete set null;

create index if not exists idx_agent_runs_runner_device_id on public.agent_runs (runner_device_id);

create or replace function public.pm_enforce_agent_run_runner_workspace()
returns trigger
language plpgsql
as $$
begin
  if new.runner_device_id is not null and not exists (
    select 1
    from public.runner_devices rd
    where rd.id = new.runner_device_id
      and rd.workspace_id = new.workspace_id
  ) then
    raise exception 'runner_device_id must reference a runner_devices row in the same workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agent_runs_runner_workspace on public.agent_runs;

create trigger trg_agent_runs_runner_workspace
  before insert or update of runner_device_id, workspace_id
  on public.agent_runs
  for each row
  execute function public.pm_enforce_agent_run_runner_workspace();
