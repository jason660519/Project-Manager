# PM System Installer Runbook

> Status: Draft for F48  
> Owner: Project Manager engineering  
> Last updated: 2026-06-04

## Purpose

The PM System Installer provisions and operates a self-hosted Project Manager backend stack powered by Supabase. It supports a self-hosted-first, connector-based, cloud-compatible product model.

The installer is for Workspace Owner/Admin setup and operations. General Users should connect to an existing workspace URL and should not install Docker or manage Supabase containers.

## Product Boundary

```text
PM Desktop / PM Web
  -> Backend Connector Profile
      -> local self-hosted Supabase
      -> LAN/VM self-hosted Supabase
      -> Supabase Cloud endpoint later
```

Project Manager should have one active backend connector profile. The app should not know whether that profile points to local Docker, a VM, or Supabase Cloud beyond the profile mode.

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
| `local-self-hosted` | Single-owner/local team development or personal PM backend. |
| `vm-self-hosted` | Team backend on a LAN server, Mac mini, NAS, or cloud VM. |
| `supabase-cloud` | Future managed profile for teams that do not want to operate containers. |

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
- deployment mode
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

Before install:

1. Detect Docker-compatible runtime.
2. If runtime is missing, return guided install state; do not silently install privileged system software.
3. Check required ports.
4. Detect existing stack and volumes.
5. Require explicit owner approval before mutation.

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
- `__tests__/pmSystemInstaller.plan.test.ts`

It models installer plans, backend profiles, doctor reports, backup/restore/upgrade plans, and maintenance policies. It does not call Docker, pull images, write secrets, or mutate host state.

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
