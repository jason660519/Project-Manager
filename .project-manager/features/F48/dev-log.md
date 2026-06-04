# F48 Dev Log - Self-hosted Supabase PM System Installer

## 2026-06-04 - Kickoff

### Context

The user requested implementation of a self-hosted-first Supabase deployment path for Project Manager. The desired product shape is:

- Workspace Owner/Admin can install a PM backend stack with a guided one-click installer.
- General Users connect to an existing workspace URL and do not manage Docker.
- PM Desktop/Web connects through a backend connector profile.
- Supabase remains third-party infrastructure that can be upgraded independently.
- Future deployments should support local machine, LAN/VM, and cloud provider VM setups, while remaining compatible with Supabase Cloud later.

### Feature Checkpoint

Created F48 with:

- Title: Self-hosted Supabase PM System Installer
- Category: Infrastructure/Installer
- Status: in_progress
- Progress: 10%
- Primary planned implementation: `infra/supabase/pm-system-installer.ts`
- Primary planned test: `__tests__/pmSystemInstaller.plan.test.ts`

### Design Decision

Use a self-hosted-first, connector-based, cloud-compatible architecture:

```text
PM Desktop / PM Web
  -> Backend Connector Profile
      -> local self-hosted Supabase
      -> LAN/VM self-hosted Supabase
      -> Supabase Cloud endpoint later
```

The first implementation slice should be pure planning logic. It should not call Docker, install system software, pull images, or mutate host state during unit tests.

### Planned Work

1. Implement installer planning model under `infra/supabase/`.
2. Add tests for Docker present/missing, port conflicts, existing stack, dry-run, and maintenance policies.
3. Add backend connector profile model that strips service-role fields from renderer-safe config.
4. Add PM System command registry for install/start/stop/status/doctor/backup/restore/upgrade/logs.
5. Add docs/runbook only after the planning model is stable.

### Coordination Note

F46 is owned by another engineer. F48 must avoid mobile remote files and F46 artifacts.

### Verification Log

- Completed: `npm run feature:kickoff -- --title "Self-hosted Supabase PM System Installer" ...`
- Completed: `jq '.features[] | select(.id=="F48")' .project-manager/config.json` confirmed metadata and canonical artifact paths.
- Completed: artifact non-empty checks for README, feature spec, TDD spec, test scenarios, and dev log.
- Completed: `npm run docs:check` passed.
- Completed: focused tests for the first implementation slice.
- Completed: `npm run typecheck` after TypeScript implementation.

## 2026-06-04 - Installer Planner Slice

### Implemented

- Added `infra/supabase/pm-system-installer.ts`.
- Added `__tests__/pmSystemInstaller.plan.test.ts`.
- Implemented side-effect-free planning for:
  - Docker-compatible runtime available
  - runtime missing
  - required port conflicts
  - existing stack detected
  - dry-run mode
- Implemented renderer-safe backend profile sanitizer that strips service-role and database password fields.
- Implemented PM System command registry:
  - install
  - start
  - stop
  - status
  - doctor
  - backup
  - restore
  - upgrade
  - logs
- Implemented maintenance policies requiring backup and confirmation before upgrade, and confirmation before restore.
- Updated F48 Development metadata to 30% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 9 tests).
- Passed: `npm run typecheck`.

## 2026-06-04 - Focused Verification Pass

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 9 tests).
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Not run: `npm run verify:baseline` because F48 is in progress at 30%; baseline remains mandatory before claiming completion or preparing commit/PR.

## 2026-06-04 - Backend Profile Pair Slice

### Implemented

- Added default PM backend port model for API gateway, Postgres, Studio, Storage, and Realtime.
- Added backend profile pair generation:
  - renderer-safe profile with URL and anon key only
  - ops-only profile with service-role key, JWT secret, database password, ports, compose project, and schema version
- Added ops env rendering for local install files.
- Added redacted ops env rendering for support/doctor output.
- Expanded `__tests__/pmSystemInstaller.plan.test.ts` to 12 tests.
- Updated F48 Development metadata to 40% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 12 tests).
- Passed: `npm run typecheck`.

## 2026-06-04 - Backend Doctor Report Slice

### Implemented

- Added PM backend doctor report model with:
  - healthy
  - degraded
  - failed
- Added doctor checks for runtime, ports, auth, Postgres, migrations, storage, realtime, and connector.
- Added helper to list blocking failed checks.
- Added helper to collect recovery actions.
- Expanded `__tests__/pmSystemInstaller.plan.test.ts` to 15 tests.
- Updated F48 Development metadata to 45% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 15 tests).
- Passed: `npm run typecheck`.

## 2026-06-04 - Backup Restore Upgrade Planner Slice

### Implemented

- Added backup planner with Postgres export, optional storage export, manifest writing, and manifest verification.
- Added restore planner requiring known backup source and exact destructive confirmation phrase.
- Added upgrade planner requiring verified backup before image pull/migration, and blocking upgrade when doctor status is failed.
- Expanded `__tests__/pmSystemInstaller.plan.test.ts` to 21 tests.
- Updated F48 Development metadata to 55% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 21 tests).
- Passed: `npm run typecheck`.

## 2026-06-04 - PM System Installer Runbook

### Implemented

- Added `docs/engineering/pm-system-installer.md`.
- Documented installer product boundary, deployment profiles, user roles, command set, secret boundaries, preflight checks, doctor status, and backup/restore/upgrade policy.
- Updated documentation site manifests through `npm run docs:site:sync`.
- Updated F48 Development metadata to 60% progress.

### Verification Log

- Passed: `npm run docs:check`.
- Passed: `npm run docs:site:sync`.

## 2026-06-04 - Focused Verification Pass 2

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 21 tests).
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Not run: `npm run verify:baseline` because F48 is still in progress at 60%; baseline remains mandatory before completion/commit/PR.

## 2026-06-04 - Self-hosted Stack Scaffold Slice

### Implemented

- Added self-hosted scaffold files:
  - `infra/supabase/docker-compose.pm-system.yml`
  - `infra/supabase/pm-system.env.example`
  - `infra/supabase/migrations/0001_pm_core.sql`
  - `infra/supabase/seed.sql`
- Added scaffold inventory and secret-audit helper in `infra/supabase/pm-system-installer.ts`.
- Added tests for scaffold inventory, no-real-secret guard, core PM tables, and RLS enablement.
- Expanded `__tests__/pmSystemInstaller.plan.test.ts` to 24 tests.
- Updated F48 Development metadata to 70% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 24 tests).
- Passed: `npm run typecheck`.

## 2026-06-04 - Dry-run CLI Response Slice

### Implemented

- Added `buildPmSystemCliResponse()` for dry-run-safe command responses.
- Covered command response behavior for:
  - install
  - doctor
  - backup
  - restore
  - upgrade
  - start
  - stop
  - status
  - logs
- Added tests for dry-run install output, doctor missing-runtime blocking, unsafe backup, unsafe restore, and upgrade-without-backup messaging.
- Expanded `__tests__/pmSystemInstaller.plan.test.ts` to 27 tests.
- Updated F48 Development metadata to 78% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 27 tests).
- Passed: `npm run typecheck`.

## 2026-06-04 - Dry-run CLI Wrapper Slice

### Implemented

- Added `scripts/pm-system.mjs`.
- Added `__tests__/pmSystemCli.test.ts`.
- CLI wrapper currently supports dry-run planning only and refuses live host mutation without `--dry-run`.
- `install --dry-run` prints the planned installer steps.
- `restore --dry-run` and `upgrade --dry-run` remain blocked until explicit safety inputs are implemented.
- Updated F48 Development metadata to 82% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts __tests__/pmSystemCli.test.ts` (2 files, 30 tests).
- Passed: `npm run typecheck`.
- Passed: `node scripts/pm-system.mjs install --dry-run`.

## 2026-06-04 - NPM Script Wiring

### Implemented

- Added package script: `npm run pm-system -- <command> --dry-run`.

### Verification Log

- Passed: `npm run pm-system -- install --dry-run`.
- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts __tests__/pmSystemCli.test.ts` (2 files, 30 tests).
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.

### Safety Note

The scaffold is intentionally not a production-ready Supabase stack yet. It creates a reviewable file boundary for the next implementation slice without pulling images, starting containers, or writing real secrets.

## 2026-06-04 - Scaffold Integrity Follow-up

### Implemented

- Added `infra/supabase/templates/kong.yml` placeholder because the compose scaffold mounts a Kong declarative config.
- Added `create extension if not exists pgcrypto;` to the initial migration before `gen_random_uuid()` defaults.
- Updated scaffold inventory and tests to include the Kong template and pgcrypto requirement.
- Updated F48 Development metadata to 72% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts` (1 file, 24 tests).
- Passed: `npm run typecheck`.

## 2026-06-04 - Code Review Fixes (high-effort `/code-review`)

### Context

Ran a high-effort review of the F48 installer commit and fixed the findings. Chose the "honest minimal-viable + fix real bugs" scope (not building the full Supabase stack).

### Implemented

- **Drift / dead-code (altitude):** extracted the canonical dry-run step lists into a shared, dependency-free `infra/supabase/pm-system-plans.mjs` (+ `pm-system-plans.d.mts` types). Both the typed planner and `scripts/pm-system.mjs` now import it, so the CLI can no longer drift from the tested plans.
- **Migration never executed:** compose mounted migrations into a nested sub-dir of `/docker-entrypoint-initdb.d` (which Postgres ignores). Now mounts `0001_pm_core.sql` and `seed.sql` as ordered top-level files. Documented that initdb runs first-init only and `upgrade` needs a real migration runner.
- **Secret-scan bypass:** `auditScaffoldContent` exempted an entire file if it contained any one placeholder. Rewrote to scan per-line so a real secret beside a placeholder is still caught.
- **Doctor false success:** the `ports` doctor check reported `pass` on empty/undefined port data. Now returns `warn` ("ports were not verified"), so doctor is never falsely `healthy`.
- **RLS deny-all:** the migration enabled RLS with zero policies. Added membership-scoped read policies guarded by `auth.uid()` presence (loud notice + RLS left off when auth absent), so tables are never silently deny-all.
- **Phantom services:** `getRequiredPortChecks()` reduced to the api/postgres/studio ports the compose actually starts; Storage/Realtime annotated as a reserved forward contract in env + docs. Honest WARNING comments added to the compose studio block and `kong.yml`.
- **Invalid URL:** `createPmBackendProfilePair` now throws on a scheme-less host instead of writing a broken `supabaseUrl`.
- **CLI backup divergence:** CLI backup dry-run now derives steps from the shared `backupSteps(includeStorage)` and honors `--no-storage`.
- Added regression tests for: 3-port required checks, scheme-less host rejection, RLS policies present, per-line secret scan, doctor not-healthy on unchecked ports.

### Verification Log

- Passed: `npm run typecheck`.
- Passed: `npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts __tests__/pmSystemCli.test.ts` (2 files, 34 tests).
- Passed: `npm run docs:site:sync` + `npm run docs:check`.
- Passed: `node scripts/pm-system.mjs {install,backup --no-storage,restore} --dry-run` exit codes (0/0/1) and unknown/no-flag (2).
- Pending: `npm run verify:baseline` (full gate) before commit/PR.
