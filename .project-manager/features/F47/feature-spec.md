# F47: Supabase Cloud Auth and Developer Runner Storage Architecture

## Purpose

Project Manager now needs authenticated cloud workspace behavior for Developer and general User roles. The prior desktop-first architecture is still valuable for local execution, but it should no longer own account, workspace, project metadata, role, report, or collaboration state.

This feature defines the first implementation-ready architecture for:

- Supabase Auth as the identity provider.
- Supabase Postgres as the primary cloud database.
- Supabase Storage/Realtime as optional follow-on infrastructure for report assets and live run state.
- Rust/Tauri as the Developer Runner and local secure execution layer.
- Role-based web routes for Developer Console and User Portal.

## Background

Local evidence reviewed before kickoff:

- `docs/product/project-manager-prd.md` still contains older English local-first wording, while the Chinese PRD now says `Hybrid Cloud + Local-First` and references a database field for solution detail URLs.
- `docs/product/target-audience.md` includes Team plan direction, shared config, and run history.
- `docs/architecture/ADR-004-api-call-security.md` and `docs/architecture/architecture-overview.md` still frame Rust as the secure API-call path for AI calls.
- Current app routes are shell-first and do not yet have login, cloud session, workspace, or role gates.

The product direction requires a new architecture decision: Supabase should own cloud identity and collaborative product state, while Rust/Tauri should be repositioned as a paired runner that performs local operations unavailable to a browser.

## Product Model

### Cloud Control Plane

Supabase-backed cloud state should own:

- users
- workspaces
- workspace memberships
- roles and permission grants
- projects and project metadata
- requirements and feature records
- solution detail URLs
- reports and report metadata
- integration records
- agent run metadata
- audit logs

Large raw execution logs should not be stored directly as unbounded DB rows. Store metadata in Postgres and put large artifacts in object storage, compressed files, or local runner artifacts with retention rules.

### Developer Runner

Rust/Tauri should own local machine capabilities:

- repo scan
- local file read/write/watch within approved project roots
- agent/CLI spawn and kill
- stdout/stderr streaming
- IDE and terminal integration
- OS Keychain access
- local SQLite/cache/offline queue
- runner pairing and device status

### Project Artifacts

Git/project-local files remain useful for engineering source-of-truth artifacts:

- feature specs
- TDD specs
- dev logs
- test scenarios
- repo-local configs
- generated reports that should be reviewable in git

Cloud DB stores their metadata, URLs, status, and permissions. It should not replace every project artifact on day one.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a general User, I want to sign in and see project progress, requirements, reports, and solution detail pages without installing a local runner. |
| US-02 | As a Developer, I want to sign in to the same workspace and access feature management, project connections, runner status, agent dispatch, and execution logs. |
| US-03 | As a Developer, I want to pair my local Desktop Runner to a cloud workspace so cloud-dispatched tasks execute on the correct machine with explicit consent. |
| US-04 | As an Admin/Owner, I want users and developers to be governed by workspace roles so command execution and secrets are never exposed to the wrong audience. |
| US-05 | As a future engineer, I want the Supabase/Rust boundary documented so implementation does not drift into duplicate backends. |

## Functional Requirements

1. Add or plan a unified `/login` entrypoint backed by Supabase Auth.
2. Route authenticated users by workspace role:
   - Developer -> Developer Console.
   - User/Viewer/Reviewer -> User Portal.
   - Admin/Owner -> Admin Console when available.
3. General User views must not expose command execution, API keys, raw secret state, or local runner controls.
4. Developer views must show runner availability, pairing state, project access, and execution policy before dispatch.
5. Missing Supabase session, missing workspace membership, missing project access, missing runner, and denied execution policy must all render explicit blocked states.
6. The feature must define storage ownership so future migrations do not duplicate the same state in `.project-manager/config.json`, Supabase, and local DB without precedence rules.
7. Add an ADR or ADR update before landing implementation that supersedes or narrows older local-first/Rust-only API assumptions.

## Technical Requirements

1. Use Supabase Auth for identity and session lifecycle.
2. Use Supabase Postgres as canonical cloud product state for collaborative entities.
3. Prefer Row Level Security or backend-enforced workspace membership checks for role-scoped data.
4. Keep service-role credentials and privileged Supabase keys out of client-rendered code.
5. Keep Rust/Tauri commands for local-only capabilities and runner operations, not ordinary cloud CRUD.
6. Add a small auth/session abstraction before wiring components directly to Supabase clients.
7. Add route/permission helpers before scattering role checks through UI components.
8. Keep existing local desktop flows working until cloud migration has explicit compatibility behavior.

## Proposed Storage Ownership

| Data | Primary Store | Secondary Store | Notes |
| --- | --- | --- | --- |
| User account/session | Supabase Auth | Browser session storage managed by Supabase client | No custom password storage. |
| Workspace/member/role | Supabase Postgres | None | RLS/backend policy boundary. |
| Project metadata | Supabase Postgres | Local cache | Cloud owns collaboration view. |
| Feature/task status | Supabase Postgres | Project files during migration | Define sync precedence before migration. |
| Feature artifact markdown | Git/project files | Supabase metadata + URL | Keep source-reviewable docs. |
| Solution detail URL | Supabase Postgres | Generated static page route | Required by updated PRD. |
| Run metadata | Supabase Postgres | Local cache | DB stores status/duration/runner IDs. |
| Raw run logs | Object storage or local artifact | DB summary | Avoid unbounded log rows. |
| Local runner token | OS Keychain/local secure store | Supabase runner record | Never expose raw token in UI. |
| Offline queue | Local SQLite | Supabase after sync | Requires idempotent operations. |

## Acceptance Criteria

1. F47 appears in Project Dashboard > Development with canonical artifact paths.
2. Feature artifacts define Supabase, Auth, DB, role, and Rust/Tauri runner boundaries.
3. Test scenarios cover Developer, general User, Admin/Owner, missing membership, missing runner, denied permissions, and degraded network state.
4. Follow-up implementation has a clear first slice: auth abstraction, login route, role routing, and blocked-state UI.
5. Dev log records the PRD conflict and the need for an ADR update before implementation lands.

## Open Decisions

1. Auth provider packaging: pure Supabase Auth or Supabase Auth with an additional app backend for privileged workflows.
2. Whether to use Supabase Edge Functions for runner dispatch orchestration or a separate backend service later.
3. Whether Desktop Runner communicates through Supabase Realtime, polling, or a dedicated runner gateway.
4. Whether `.project-manager/config.json` remains a sync artifact, import source, or local-only compatibility layer after cloud migration.
5. Exact role names for MVP: `developer` and `user` only, or include `owner`, `admin`, `reviewer`, and `viewer` immediately.
