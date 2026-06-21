## Summary

<!-- What changed and why (1–3 sentences). -->

## Test plan

- [ ] `npm run verify:baseline`
- [ ] Manual smoke on changed UI routes (Chrome/Safari/Tauri — not Cursor embedded browser alone)
- [ ] `npm run verify:dev-issues -- --routes <changed-routes>` when UI/routing changed

## Supabase / Postgres schema changes

Complete this section when the PR touches `infra/supabase/migrations/**`, RLS policies, or cloud row shapes.
Reference: [`docs/engineering/supabase-db-design-standard.md`](docs/engineering/supabase-db-design-standard.md) §15.

- [ ] Migration file added under `infra/supabase/migrations/`
- [ ] RLS enabled + policies for new/changed `public` tables
- [ ] `pm_system.schema_migrations` version row inserted in the migration
- [ ] Types/queries updated in `lib/` (and tests)
- [ ] No service-role key or DB password in client-reachable code
- [ ] Data ownership matches [ADR-016](docs/architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md) (no duplicating file-owned content in Postgres)
- [ ] Indexes added for new FK / filter columns
- [ ] [storage-and-schema.md](docs/engineering/storage-and-schema.md) or [supabase-db-design-standard.md](docs/engineering/supabase-db-design-standard.md) updated when ownership rules change
- [ ] ADR opened for breaking or strategic schema decisions
- [ ] RLS contract tests added or updated (`__tests__/supabase.migrations.rls-contract.test.ts`)
- [ ] Optional live Postgres check: `PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls`

## Documentation

- [ ] Updated relevant engineering docs when command signatures, persisted shapes, or verification requirements changed
- [ ] `npm run docs:check` passes for bilingual doc edits
