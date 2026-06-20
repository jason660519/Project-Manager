-- Portal feature reads for progress aggregation (member-scoped RLS).
-- Run via: PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker

do $$
declare
  alpha_workspace constant uuid := 'c0000000-0000-4000-8000-000000000001';
  beta_workspace constant uuid := 'c0000000-0000-4000-8000-000000000002';
  developer_user constant uuid := 'a0000000-0000-4000-8000-000000000001';
  beta_viewer constant uuid := 'a0000000-0000-4000-8000-000000000002';
  alpha_project constant uuid := 'd0000000-0000-4000-8000-000000000001';
  active_feature_count integer;
  deleted_feature_count integer;
  beta_feature_count integer;
begin
  perform set_config('request.jwt.claim.sub', developer_user::text, true);
  execute 'set local role authenticated';

  select count(*) into active_feature_count
  from public.features
  where workspace_id = alpha_workspace
    and project_id = alpha_project
    and deleted_at is null;

  if active_feature_count <> 4 then
    raise exception 'portal features read: expected 4 active alpha features, saw %', active_feature_count;
  end if;

  select count(*) into deleted_feature_count
  from public.features
  where workspace_id = alpha_workspace
    and deleted_at is not null;

  if deleted_feature_count <> 1 then
    raise exception 'portal features read: expected 1 soft-deleted alpha feature, saw %', deleted_feature_count;
  end if;

  perform set_config('request.jwt.claim.sub', beta_viewer::text, true);
  execute 'set local role authenticated';

  select count(*) into beta_feature_count
  from public.features
  where workspace_id = alpha_workspace;

  if beta_feature_count <> 0 then
    raise exception 'portal features read: beta viewer must not read alpha features, saw %', beta_feature_count;
  end if;

  raise notice 'portal features read integration tests passed.';
end $$;
