# PM System Installer Runbook

> Status: Draft for F48  
> Owner: Project Manager engineering  
> Last updated: 2026-06-04

## Purpose

The PM System Installer provisions and operates Supabase-compatible Project
Manager backend stacks. It supports a local-first, connector-based,
cloud-compatible product model where Supabase Cloud is one supported mode, not
the product boundary.

The installer is for Workspace Owner/Admin setup and operations. General Users should connect to an existing workspace URL and should not install Docker or manage Supabase containers.

## Product Boundary

```text
PM Desktop / PM Web
  -> Backend Connector Profile
      -> local files
      -> local Docker Supabase-compatible stack
      -> local self-hosted Supabase
      -> LAN/VM self-hosted Supabase
      -> Supabase Cloud endpoint
```

Project Manager should have one active backend connector profile. Product logic
should key off the profile mode and renderer-safe connection shape, not
hard-code assumptions that the backend is Supabase Cloud.

## Roles

| Role | Responsibility |
| --- | --- |
| Workspace Owner | Installs backend, creates first admin, shares workspace URL. |
| Admin/Ops | Runs status, doctor, backup, restore, upgrade, and logs. |
| Developer | Connects PM Desktop, signs in, pairs local runner, dispatches guarded work. |
| General User | Connects to workspace URL, signs in, views portal. No Docker requirement. |

## Supported Deployment Profiles

| Mode | Use |
| --- | --- |
| `local-files` | Default local-first mode using `.project-manager/` files. No Docker, sign-in, or network backend required. |
| `local-docker-supabase` | Single-owner, PoC, restricted-network, or local team backend running a Supabase-compatible Docker stack. |
| `self-hosted-supabase` | Company-owned Supabase-compatible backend on a LAN server, Mac mini, NAS, VM, Kubernetes, or other internal platform. |
| `supabase-cloud` | Managed Supabase Cloud profile for teams that do not want to operate containers. |

## Installer Commands

| Command | Purpose |
| --- | --- |
| `install` | Generate config, pull images, start stack, run migrations, create owner, health check. |
| `start` | Start existing backend stack. |
| `stop` | Stop services without deleting volumes. |
| `status` | Show service, port, profile, and schema status. |
| `doctor` | Diagnose runtime, ports, Auth, Postgres, migrations, Storage, Realtime, connector. |
| `backup` | Export Postgres and optionally Storage artifacts with manifest verification. |
| `restore` | Restore from a known backup with explicit destructive confirmation. |
| `upgrade` | Require verified backup, pull target images, run migrations, health check. |
| `logs` | Collect support logs with secret redaction. |

## Secret Boundary

Renderer-safe profile may contain:

- profile ID
- display label
- deployment mode: `local-files`, `local-docker-supabase`, `self-hosted-supabase`, or `supabase-cloud`
- Supabase URL
- Supabase anon key

Ops-only profile may contain:

- service-role key
- JWT secret
- database password
- compose project name
- ports
- schema version

Rules:

- Never expose service-role key, JWT secret, or database password to the renderer.
- Never commit generated secrets.
- Redact secrets in doctor/logs/support output.

## Preflight Requirements

Before install for `local-docker-supabase` or `self-hosted-supabase`:

1. Detect Docker-compatible runtime.
2. If runtime is missing, return guided install state; do not silently install privileged system software.
3. Check required ports.
4. Detect existing stack and volumes.
5. Require explicit owner approval before mutation.

`local-files` mode does not run installer preflight and must remain usable
without Docker, sign-in, or network access. `supabase-cloud` mode validates the
renderer-safe connector profile and does not provision local containers.

## Live-safe Preflight

`npm run pm-system -- doctor --dry-run` and `npm run pm-system -- install --dry-run` may perform safe local preflight checks:

- check whether `docker` or `podman` responds
- check whether required ports are available
- print blocked/pass diagnostics

These checks must not pull images, start containers, write env files, generate secrets, run migrations, or mutate volumes. Use `--skip-preflight` only for deterministic tests or docs examples where local machine state should not affect output.

## Doctor Status

Doctor status must not produce false success:

| Status | Meaning |
| --- | --- |
| `healthy` | All checks pass. |
| `degraded` | No blocking failures, but warnings require follow-up. |
| `failed` | Blocking failure; do not start, upgrade, or dispatch until resolved. |

## Backup Restore Upgrade Policy

- Backup writes a manifest and verifies it.
- Restore requires a known backup source and exact confirmation phrase.
- Upgrade requires a verified backup before pulling images or running migrations.
- Failed doctor checks block upgrade.

## Current Implementation

The first implementation slice is side-effect-free:

- `infra/supabase/pm-system-installer.ts`
- `infra/supabase/pm-system-preflight.mjs`
- `__tests__/pmSystemInstaller.plan.test.ts`
- `__tests__/pmSystemPreflight.test.ts`
- `__tests__/pmSystemCli.test.ts`

It models installer plans, backend profiles, doctor reports, backup/restore/upgrade plans, live-safe preflight, and maintenance policies. It does not pull images, start containers, write secrets, or mutate host state.

The dry-run step lists are defined once in `infra/supabase/pm-system-plans.mjs` and shared by both the typed planner and the runtime CLI (`scripts/pm-system.mjs`), so the CLI cannot drift from the tested plans.

## Manifest and Progress Sheet Layout

F55 keeps the local project manifest separate from discipline-specific progress
sheet configs:

```text
.project-manager/
├── config.json
└── progress-sheets/
    └── <sheetId>/
        └── config.json
```

`.project-manager/config.json` remains the project manifest and contains the
backend profile selection plus progress sheet references. Each progress sheet
config owns its template snapshot, columns, status/phase options, rows or row
sidecar pointers, archived fields, and sheet-level migration metadata.

Local Docker, self-hosted, and cloud profiles should sync or mirror this model;
they must not require every project to use the software-only Development
Progress columns.

## Known Gaps (Current Scaffold)

The `infra/supabase` compose scaffold is still gated before live authenticated
client use:

- Auth (GoTrue), REST (PostgREST), Storage, and Realtime services are declared
  in `docker-compose.pm-system.yml`, and `getRequiredPortChecks()` requires
  their local ports. `templates/kong.yml` still routes nothing, so data-plane
  API calls through `http://kong:8000` fail until Kong routes for `/auth/v1`,
  `/rest/v1`, `/storage/v1`, and `/realtime/v1` are added. Doctor and install
  dry-runs must report this as blocked instead of healthy.
- The Postgres entrypoint runs `/docker-entrypoint-initdb.d` scripts only on the
  **first** init of an empty volume. `0001_pm_core.sql` and `seed.sql` are
  mounted as top-level files so they execute on first init. Existing volumes use
  the compose `migrations` profile plan and require backup plus owner approval
  before execution.
- RLS is enabled together with membership-scoped read policies (never enabled with zero policies). Write paths currently rely on the service-role key until write policies are added.

## Verification

Focused verification:

```bash
npm run test -- --run __tests__/pmSystemInstaller.plan.test.ts
npm run typecheck
npm run docs:check
```

Full completion gate:

```bash
npm run verify:baseline
```
