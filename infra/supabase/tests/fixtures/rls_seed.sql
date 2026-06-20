-- Deterministic RLS fixture data. No real emails, tokens, or customer records.
-- UUIDs are stable so integration tests can assert membership boundaries.

insert into public.workspaces (id, name)
values
  ('c0000000-0000-4000-8000-000000000001', 'RLS Workspace Alpha'),
  ('c0000000-0000-4000-8000-000000000002', 'RLS Workspace Beta')
on conflict (id) do nothing;

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'developer'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'viewer'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000099', 'developer'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000099', 'admin')
on conflict (workspace_id, user_id) do nothing;

insert into auth.users (id, email)
values
  ('a0000000-0000-4000-8000-000000000001', 'developer-alpha@example.test'),
  ('b0000000-0000-4000-8000-000000000001', 'admin-alpha@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'viewer-beta@example.test'),
  ('a0000000-0000-4000-8000-000000000099', 'dual-member@example.test')
on conflict (id) do update set email = excluded.email;

insert into public.projects (id, workspace_id, name, solution_detail_url)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'Alpha Project',
    'https://example.test/alpha'
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000002',
    'Beta Project',
    'https://example.test/beta'
  )
on conflict (id) do nothing;

insert into public.features (
  id,
  workspace_id,
  project_id,
  feature_key,
  title,
  status,
  local_config_path
)
values
  (
    'e0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'F01',
    'RLS Fixture Feature',
    'in_progress',
    '.project-manager/features/F01'
  )
on conflict (id) do nothing;

insert into public.features (
  id,
  workspace_id,
  project_id,
  feature_key,
  title,
  status,
  progress_percent,
  local_config_path,
  updated_at
)
values
  (
    'e0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'F02',
    'Portal Progress Planned',
    'planned',
    0,
    '.project-manager/features/F02',
    '2026-06-20T12:00:00.000Z'
  ),
  (
    'e0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'F03',
    'Portal Progress Done',
    'done',
    100,
    '.project-manager/features/F03',
    '2026-06-21T08:00:00.000Z'
  ),
  (
    'e0000000-0000-4000-8000-000000000004',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'F04',
    'Portal Progress Blocked',
    'blocked',
    15,
    '.project-manager/features/F04',
    '2026-06-21T09:00:00.000Z'
  ),
  (
    'e0000000-0000-4000-8000-000000000099',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'F99',
    'Soft Deleted Fixture',
    'planned',
    null,
    '.project-manager/features/F99',
    '2026-06-19T12:00:00.000Z'
  )
on conflict (id) do nothing;

update public.features
set deleted_at = '2026-06-19T13:00:00.000Z'
where id = 'e0000000-0000-4000-8000-000000000099';

insert into public.audit_logs (
  id,
  workspace_id,
  actor_user_id,
  action,
  resource_type,
  resource_id,
  metadata
)
values
  (
    'f0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'membership.role_changed',
    'workspace_membership',
    null,
    '{"role":"admin"}'::jsonb
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'runner.paired',
    'runner_device',
    null,
    '{"runner_id":"fixture-runner"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.runner_devices (
  id,
  workspace_id,
  runner_id,
  device_label,
  paired_by_user_id,
  status,
  last_seen_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'fixture-runner-alpha',
    'RLS Dev Mac',
    'b0000000-0000-4000-8000-000000000001',
    'ready',
    now()
  )
on conflict (id) do nothing;

insert into public.runner_devices (
  id,
  workspace_id,
  runner_id,
  device_label,
  paired_by_user_id,
  status,
  last_seen_at
)
values
  (
    'a1000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000002',
    'fixture-runner-beta',
    'RLS Beta Runner',
    'a0000000-0000-4000-8000-000000000099',
    'paired_offline',
    now()
  )
on conflict (id) do nothing;

insert into public.agent_runs (
  id,
  workspace_id,
  project_id,
  runner_id,
  runner_device_id,
  status,
  summary
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'fixture-runner-alpha',
    'a1000000-0000-4000-8000-000000000001',
    'queued',
    'RLS fixture agent run'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000002',
    'fixture-runner-beta',
    'a1000000-0000-4000-8000-000000000002',
    'succeeded',
    'RLS beta workspace completed run'
  )
on conflict (id) do nothing;

insert into public.report_metadata (
  id,
  workspace_id,
  project_id,
  feature_id,
  agent_run_id,
  report_key,
  title,
  report_type,
  status,
  summary,
  content_url,
  published_at,
  created_by
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'alpha-delivery-draft',
    'Alpha Delivery Draft',
    'delivery_summary',
    'draft',
    'Draft summary for developer eyes only.',
    null,
    null,
    'a0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    null,
    null,
    'alpha-delivery-published',
    'Alpha Delivery Published',
    'delivery_summary',
    'published',
    'Published delivery summary for portal readers.',
    'https://example.test/reports/alpha-delivery',
    now(),
    'b0000000-0000-4000-8000-000000000001'
  ),
  (
    'c2000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000002',
    null,
    null,
    'beta-milestone-published',
    'Beta Milestone Published',
    'milestone',
    'published',
    'Portal-visible milestone in beta workspace.',
    'https://example.test/reports/beta-milestone',
    now(),
    'a0000000-0000-4000-8000-000000000002'
  )
on conflict (id) do nothing;

insert into public.sync_cursors (
  id,
  workspace_id,
  project_id,
  resource_type,
  resource_key,
  local_revision,
  cloud_revision,
  sync_status,
  metadata
)
values
  (
    '01000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'project_config',
    'alpha-config',
    'local-rev-1',
    'cloud-rev-1',
    'idle',
    '{"source":"rls-fixture"}'::jsonb
  ),
  (
    '01000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000002',
    'progress_sheet',
    'beta-progress',
    'local-rev-2',
    'cloud-rev-2',
    'pending',
    '{"source":"rls-fixture"}'::jsonb
  )
on conflict (id) do nothing;
