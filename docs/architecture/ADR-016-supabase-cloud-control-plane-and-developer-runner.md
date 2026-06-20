# ADR-016: Supabase-compatible Control Plane and Developer Runner

> **Created Date**: 2026-06-04
> **Created By**: Codex
> **Last Modified**: 2026-06-21
> **Modified By**: Codex
> **Status**: Proposed
> **Decision Maker**: Jason

## Background

Project Manager is moving from a desktop-only local mission-control app toward a hybrid cloud product with authenticated Developer and general User experiences. The updated product direction needs:

- user login
- workspaces
- memberships and roles
- cloud project metadata
- solution detail URLs
- reports
- shared run metadata
- audit history
- a Developer Runner for local repo and agent execution

The older architecture treated Tauri/Rust as the primary secure backend and explicitly avoided a centralized database in MVP. That remains useful for local execution, but it is no longer sufficient for role-based workspace collaboration or a general User portal.

F55 adds an explicit local-first requirement: Supabase must be treated as a
compatible control-plane interface, not as a mandatory Supabase Cloud
dependency. Local files remain a valid backend mode, and teams may choose local
Docker Supabase, company self-hosted Supabase-compatible infrastructure, or
Supabase Cloud without changing the product model.

## Decision

Use a Supabase-compatible control plane for Project Manager's authenticated and
collaborative backend modes:

- Auth-compatible services own identity and session lifecycle.
- Postgres-compatible storage owns collaborative product state.
- Row Level Security or equivalent backend-enforced checks protect workspace-scoped rows.
- Storage and/or Realtime-compatible services may be used for report assets, large execution artifacts, and live state when their access model is defined.

Supported backend profile modes:

| Mode | Purpose |
| --- | --- |
| `local-files` | Default local-first mode. Uses `.project-manager/` files and does not require Docker, sign-in, or a network backend. |
| `local-docker-supabase` | Personal, PoC, restricted-network, or local team mode using a local Supabase-compatible Docker stack. |
| `self-hosted-supabase` | Company-owned Supabase-compatible infrastructure on a VM, LAN server, Kubernetes, or another managed internal environment. |
| `supabase-cloud` | Managed Supabase Cloud mode for SaaS collaboration. |

Reposition Rust/Tauri as the Developer Runner:

- local repo scan
- local file read/write/watch
- agent/CLI process spawn and kill
- stdout/stderr streaming
- IDE/terminal integration
- OS Keychain/local secure storage
- local SQLite/cache/offline queue
- runner pairing and machine status

Rust/Tauri should not be the ordinary CRUD backend for users, workspaces, roles, project metadata, reports, or general portal data.

Renderer-safe profile data may expose profile identity, label, mode, URL, and
anon key reference/value. Service-role keys, JWT secrets, and database
passwords must never be returned to renderer code; they belong in OS Keychain,
ops-only environment files, or server-only backend contexts.

## Rationale

Supabase-compatible services give the product the missing primitives needed for
Developer/User login and collaboration:

- Auth and session handling are already integrated with Postgres access control.
- Postgres provides relational workspace, membership, role, project, feature, report, and audit data modeling.
- Row Level Security can enforce per-user and per-workspace access at the database layer.
- Cloud state allows a general User to access project progress and reports without installing Docker, Tauri, or local developer tooling.

Rust still carries the differentiated product capability. Browsers and Supabase cannot safely execute local CLI tools, inspect local repositories, kill local processes, or integrate deeply with OS Keychain and local IDEs. The correct split is:

```text
Supabase-compatible backend = collaboration state and access control
Rust/Tauri = local hands for Developer execution
Git/project files = engineering artifacts and reviewable source-of-truth documents
```

## Evaluated Alternatives

### Keep Rust as the primary backend

Rejected for cloud collaboration. It would require building account management, sessions, workspace roles, database access patterns, invitations, and team portal behavior that Supabase already provides.

### Use a local Docker database as the default product store

Rejected as the default path. It is too heavy for general Users and makes cloud portal, team collaboration, device changes, and workspace permissions harder. It remains viable as `local-docker-supabase` for personal, PoC, restricted-network, or local team usage.

### Use project files only

Rejected for role-based cloud product state. Project files remain valuable for engineering artifacts, but they cannot cleanly own multi-user permissions, audit logs, auth sessions, or user portal access.

### Use Supabase for everything, including local execution

Rejected because local repo access, CLI execution, process control, and IDE integration require a local trusted runner.

## Data Ownership

| Data | Primary Owner | Notes |
| --- | --- | --- |
| Auth sessions | Supabase-compatible Auth when profile mode is not `local-files` | Do not create custom password storage. |
| Users/workspaces/memberships/roles | Supabase-compatible Postgres when profile mode is not `local-files` | Protected by RLS or backend policy checks. |
| Project metadata and solution URLs | Supabase-compatible Postgres for collaborative modes | Supports User Portal and reports. |
| Feature/task state | `.project-manager/` files first; Supabase-compatible Postgres during sync-enabled modes | Define sync precedence with project files before writeback. |
| Feature specs, TDD specs, dev logs | Git/project files | Cloud stores metadata and links. |
| Run metadata | Supabase-compatible Postgres for collaborative modes | Status, runner ID, duration, result summary. |
| Raw run logs | Object storage or local runner artifacts | Avoid unbounded Postgres rows. |
| Local runner token | OS Keychain/local secure store | Pairing metadata may exist in Supabase. |
| Offline queue/cache | Local SQLite or equivalent | Sync only idempotent operations. |

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Service-role credentials leak to browser | Never import service-role keys into client code; use only public anon key with RLS or privileged server-side paths. |
| RLS policies are incomplete | Create tests and seed fixtures for workspace membership, direct-route denial, and role changes. |
| Duplicate state between Supabase and `.project-manager/config.json` | Define migration precedence before cloud writeback; use local files as artifacts/import sources during transition. |
| Local-first users are forced into sign-in or Docker | Keep `local-files` as a first-class backend mode and test it without Docker or network prerequisites. |
| Rust feels unused | Treat Rust as Developer Runner, not product CRUD backend. Keep local execution flows explicit in the Developer Console. |
| General Users see Developer controls | Centralize permissions and route guards before building screens. |
| Local runner executes against wrong workspace/project | Pair runners to workspace and device records; require project-root approval and execution policy checks. |

## Consequences

- A future implementation must introduce Supabase client/session abstractions and route guards before broad UI work.
- Developer and general User routes should be split by capability, not by separate identity systems.
- Existing ADR-004 remains valid for local secrets and local AI-provider calls made by the Developer Runner, but it no longer applies to ordinary cloud product CRUD.
- Architecture docs and PRD text should be updated to remove contradictions between local-first MVP wording and the hybrid cloud direction.
- Backend profile normalization must preserve the four F55 modes:
  `local-files`, `local-docker-supabase`, `self-hosted-supabase`, and
  `supabase-cloud`.
- Self-hosted mode can be designed as Docker Compose, VM, Kubernetes, or another
  Supabase-compatible deployment with API, Postgres, storage, realtime, and
  runner components; it should not be forced as the default path.

## References

- Feature checkpoint: `.project-manager/features/F47/`
- Supabase Auth documentation: https://supabase.com/docs/guides/auth
- Supabase Row Level Security documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase SSR Auth documentation for Next.js: https://supabase.com/docs/guides/auth/server-side
