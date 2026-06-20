-- Cross-workspace runner_device guard for agent_runs (0004).
-- Appended after rls_membership.test.sql in integration runs.

do $$
begin
  begin
    insert into public.agent_runs (
      workspace_id,
      project_id,
      runner_id,
      runner_device_id,
      status
    )
    values (
      'c0000000-0000-4000-8000-000000000002',
      'd0000000-0000-4000-8000-000000000002',
      'fixture-runner-alpha',
      'a1000000-0000-4000-8000-000000000001',
      'queued'
    );
    raise exception 'cross-workspace runner_device_id insert should have failed';
  exception
    when others then
      if sqlerrm not like '%same workspace%' then
        raise;
      end if;
  end;

  raise notice 'agent_runs runner_device workspace guard passed.';
end $$;
