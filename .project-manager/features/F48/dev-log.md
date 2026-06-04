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
