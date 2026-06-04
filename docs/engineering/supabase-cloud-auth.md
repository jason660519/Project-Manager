# Supabase Cloud Auth Runbook

> Status: Draft for F47  
> Owner: Project Manager engineering  
> Last updated: 2026-06-04

## Purpose

This runbook describes the first Supabase integration boundary for Project Manager's cloud workspace direction. It supports ADR-016 and F47.

Supabase owns cloud identity and collaborative product state. Rust/Tauri remains the Developer Runner for local repo access, process execution, OS Keychain, and local cache.

## Public Browser Configuration

Client-rendered code may use only public Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Rules:

- The anon key is acceptable in browser code only when Row Level Security policies are correct.
- Never expose service-role keys in browser code, static exports, feature artifacts, logs, screenshots, or test fixtures.
- Use mocked Supabase clients in unit tests unless a live integration test is explicitly marked and isolated.

## Minimum Cloud Tables

The first route-guard slice expects this conceptual data model:

| Table | Purpose |
| --- | --- |
| `workspaces` | Workspace identity and display name. |
| `workspace_memberships` | User-to-workspace membership with role. |
| `projects` | Cloud project metadata and solution detail URLs. |
| `features` | Cloud feature/task state during migration. |
| `agent_runs` | Run metadata, runner ID, status, duration, result summary. |
| `audit_logs` | Role changes, dispatch requests, runner pairing, and privileged actions. |

Raw execution logs should not be stored as unbounded Postgres rows. Store run metadata in Postgres and place large logs in object storage or local runner artifacts with retention rules.

## Membership Query Contract

The first client abstraction is `listWorkspaceMemberships()` in `lib/auth/workspaceMemberships.ts`.

Expected query shape:

```text
workspace_memberships
  workspace_id
  role
  workspaces(name)
```

Known roles:

- `owner`
- `admin`
- `developer`
- `reviewer`
- `viewer`
- `user`

Malformed rows and unknown roles are dropped client-side. RLS should also prevent a user from reading memberships that do not belong to them.

## Route Guard Boundary

Initial protected routes:

| Route | Required capability |
| --- | --- |
| `/developer` | `view:developer-console` |
| `/portal` | `view:portal` |
| `/admin` | `view:admin-console` |

Until Supabase session and membership checks are wired, routes must render explicit blocked states and withhold protected controls.

## Developer Runner Boundary

Developer dispatch requires both workspace permission and runner readiness.

The runner status model lives in `lib/auth/runnerStatus.ts` and distinguishes:

- `missing`
- `paired_offline`
- `project_blocked`
- `ready`
- `error`

Only `ready` allows dispatch.

## RLS Policy Requirements

Before connecting production data:

1. Enable RLS on workspace-owned tables.
2. Users may read only workspaces where they have membership.
3. General Users may read project progress, reports, and solution URLs only.
4. Developers may access project execution surfaces only when workspace/project permissions allow it.
5. Admin/Owner permissions are required for membership, settings, integration, and audit management.
6. All privileged writes must be auditable.

## Local Development

Supported local development modes:

| Mode | Use |
| --- | --- |
| Mocked clients | Unit tests and route-guard logic. |
| Shared dev Supabase project | Manual sign-in and route smoke. |
| Local Supabase CLI | Future integration testing when schema migrations exist. |

Do not require Docker for general User portal flows. Docker/local Supabase may be a developer convenience, not the default product dependency.

## Verification

Focused checks for F47:

```bash
npm run test -- --run __tests__/auth.supabase-role-routing.test.tsx __tests__/auth.workspaceMemberships.test.ts __tests__/auth.runnerStatus.test.ts
npm run typecheck
npm run verify:dev-issues -- --routes /login,/developer,/portal,/admin
```

Full completion still requires:

```bash
npm run verify:baseline
```
