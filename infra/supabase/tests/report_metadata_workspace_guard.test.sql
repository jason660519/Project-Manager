-- Cross-workspace report_metadata guard (0005).

do $$
begin
  begin
    insert into public.report_metadata (
      workspace_id,
      project_id,
      report_key,
      title,
      report_type,
      status
    )
    values (
      'c0000000-0000-4000-8000-000000000002',
      'd0000000-0000-4000-8000-000000000001',
      'cross-workspace-invalid',
      'Invalid Cross Workspace Report',
      'general',
      'draft'
    );
    raise exception 'cross-workspace project_id insert should have failed';
  exception
    when others then
      if sqlerrm not like '%same workspace%' then
        raise;
      end if;
  end;

  raise notice 'report_metadata workspace guard passed.';
end $$;
