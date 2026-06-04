# F47 Dev Log - Supabase Cloud Auth and Developer Runner Storage Architecture

## 2026-06-04 - Kickoff

### Context

The user clarified that the updated PRD direction is no longer purely local-first. The product now needs Developer and general User login behavior, cloud-managed project state, and a storage system suitable for workspace/team usage.

Reviewed local sources before planning:

- `docs/product/project-manager-prd.md`
- `docs/product/target-audience.md`
- `docs/product/user-scenarios.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/README.md`
- `DESIGN.md`
- `CLAUDE.md`
- repo and company file/table/design standards

Important finding: the current docs contain a product/architecture tension. Some English PRD and architecture text still says local-first/no centralized backend/Rust API security, while the Chinese PRD and current user direction point to Hybrid Cloud + Local-First with database-backed fields and role-based collaboration.

### Feature Checkpoint

Created F47 with:

- Title: Supabase Cloud Auth and Developer Runner Storage Architecture
- Category: Architecture/Auth
- Status: in_progress
- Progress: 10%
- Primary planned implementation: `app/login/page.tsx`
- Primary planned test: `__tests__/auth.supabase-role-routing.test.tsx`

### Design Decision

Use Supabase as the cloud control plane:

- Supabase Auth for identity.
- Supabase Postgres for workspace, membership, role, project metadata, feature state, reports, solution URLs, run metadata, and audit logs.
- Optional Supabase Storage/Realtime or later backend services for large report/log artifacts and live runner coordination.

Reposition Rust/Tauri as the Developer Runner:

- local repo scan
- local command execution
- process lifecycle
- stdout/stderr streaming
- OS Keychain/local secure storage
- local cache/offline queue
- runner pairing

This keeps Rust valuable without forcing it to duplicate ordinary cloud CRUD.

### Planned Work

1. Add or update an ADR that supersedes or narrows local-first and Rust-only API assumptions.
2. Introduce auth/session and permission abstractions before UI components directly call Supabase.
3. Add `/login` and role-based route guards.
4. Split post-login surfaces into Developer Console and User Portal.
5. Add explicit blocked states for missing session, missing workspace membership, denied role, missing runner, offline runner, and Supabase failure.
6. Add focused tests from `tdd-spec.md` and `test-scenarios.md`.

### Development Notes For Next Engineer

- Do not place Supabase service-role credentials in client code.
- Do not store real credentials or tokens in feature artifacts or fixtures.
- Avoid making Rust/Tauri the main CRUD backend for users, workspaces, projects, or roles.
- Keep existing desktop/local project behavior available during migration until cloud precedence is explicitly defined.
- Any implementation that changes architecture assumptions should include an ADR update before landing.

### Verification Log

- Completed: `npm run feature:kickoff -- --title "Supabase Cloud Auth and Developer Runner Storage Architecture" ...`
- Completed: `jq '.features[] | select(.id=="F47")' .project-manager/config.json` confirmed F47 metadata, canonical artifact paths, implementation path, and test path.
- Completed: artifact non-empty checks for README, feature spec, TDD spec, test scenarios, and dev log.
- Completed: `npm run docs:check` passed.
- Not run: `npm run verify:baseline` because this is the pre-implementation feature kickoff/documentation slice, not the completed product implementation.

## 2026-06-04 - First Implementation Slice

### Implemented

- Added `docs/architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md`.
- Added Supabase public browser client guard in `lib/auth/supabaseClient.ts`.
- Added role/capability routing helpers in `lib/auth/permissions.ts`.
- Added `/login` route with `app/login/page.tsx` and `app/login/LoginEntry.tsx`.
- Added focused test coverage in `__tests__/auth.supabase-role-routing.test.tsx`.
- Installed official Supabase client packages: `@supabase/ssr` and `@supabase/supabase-js`.
- Updated F47 Development metadata to 30% progress.

### Verification Log

- Passed: `npm run test -- --run __tests__/auth.supabase-role-routing.test.tsx` (1 file, 4 tests).
- Passed: `npm run docs:check`.
- Passed: `npm run docs:site:sync`.
- Passed: Browser smoke for `http://localhost:43187/login` using the existing dev server on port 43187. The route rendered the heading, Developer Console, User Portal, Admin Console, and enabled GitHub sign-in because this environment already has public Supabase config.
- Passed: `npm run verify:dev-issues -- --routes /login` reported `PASS /login ... Next dev Issues: 0`.
- Failed: `npm run typecheck` due to pre-existing unrelated mobile remote test error: `__tests__/telegramRouter.mobileRemote.test.ts(42,9): Type '"cursor"' is not assignable to type 'IDEId'. Did you mean '"Cursor"'?`
- Not run: `npm run verify:baseline` because `typecheck` is currently blocked by the unrelated error above.

### Follow-Ups

1. Fix or coordinate the existing mobile remote `IDEId` casing error so full typecheck can run.
2. Add Supabase env documentation and decide whether local development uses a real Supabase project, local Supabase CLI, or mocked fixtures.
3. Add workspace membership query abstraction and route guards for `/developer`, `/portal`, and `/admin`.
4. Add runner pairing state model and blocked-state tests.
