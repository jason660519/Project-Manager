# F47 Test Scenarios

## Purpose

Map real user paths for the Supabase Auth, cloud database, role routing, and Developer Runner architecture. These scenarios should drive the first implementation tests and prevent the product from accidentally exposing Developer-only capabilities to general Users.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F47-S01 | Visitor opens `/login` with no session | Login page exposes privileged app state or redirects unpredictably | Login render test with no session | Browser smoke for `/login` | Candidate | User request |
| F47-S02 | General User signs in and opens project portal | User cannot find progress, reports, or solution URLs | Role-routing test to `/portal`; portal render test | Sign in as User and open progress/report pages | Candidate | PRD role split |
| F47-S03 | Developer signs in and opens Developer Console | Developer cannot see runner state before dispatch | Role-routing test to `/developer`; runner status render test | Sign in as Developer and inspect runner status | Candidate | Developer workflow |
| F47-S04 | General User pastes a Developer route | User sees agent dispatch, keys, runner controls, or raw logs | Permission guard test for direct route | Direct URL smoke as User | Candidate | Security boundary |
| F47-S05 | Developer has no paired runner | UI allows dispatch and implies success | Runner status test maps `missing` to blocked dispatch | Developer dispatch attempt without runner | Candidate | Runner pairing |
| F47-S06 | Developer runner is paired but offline | User cannot recover or understand failure | Runner status test maps `offline` to disabled action and recovery copy | Offline runner smoke | Candidate | Degraded execution |
| F47-S07 | Developer lacks project permission | Command executes against unauthorized repo | Permission policy test denies project access | Attempt dispatch on unauthorized project | Candidate | Workspace ACL |
| F47-S08 | Workspace membership is missing | App loops or lands in blank dashboard | Membership guard test renders blocked state | Authenticated user with no workspace | Candidate | Auth edge case |
| F47-S09 | Admin changes a Developer to User | Old Developer controls remain visible after refresh | Permission refresh test invalidates cached role | Role change then reload | Candidate | Team admin |
| F47-S10 | Supabase request fails | UI says action succeeded or loses route intent | Error-state test for auth/query failure | Network degraded smoke | Candidate | Cloud dependency |
| F47-S11 | Solution detail URL exists on project pain point | General User cannot navigate to explanation page | Portal project detail test renders clickable URL | Open solution URL from portal | Candidate | Updated PRD |
| F47-S12 | Large run log is produced | DB stores raw unbounded log rows | Storage ownership test verifies metadata/log separation | Run long task and inspect log artifact strategy | Candidate | Storage design |

## Persona Coverage

| Persona | Required Paths |
| --- | --- |
| General User / Viewer | Login, workspace selection, project progress, reports, solution URLs, denied Developer direct route. |
| Reviewer / PM | Login, requirements review, report review, comment/approval path if implemented, no runner access. |
| Developer | Login, project connection, runner status, prompt preview, dispatch, run log, blocked state recovery. |
| Admin / Owner | Membership role assignment, integration visibility, audit log review, billing placeholder when available. |
| Future Maintainer | Reads F47 artifacts, sees storage ownership and ADR requirements before coding. |

## No-Fake-Data Rules

- Do not invent production Supabase credentials, service role keys, or workspace IDs.
- Test fixtures may use deterministic fake UUIDs and mocked Supabase clients.
- Do not store real user emails, tokens, GitHub tokens, API keys, or private repo names in committed fixtures.
- Runner pairing tests should use synthetic pairing codes and fake device IDs.

## Acceptance Scenario Detail

### F47-S02: General User Portal

1. User signs in through Supabase Auth.
2. User selects a workspace where membership role is `user`, `viewer`, or `reviewer`.
3. App routes to User Portal.
4. User opens project progress and a solution detail URL.
5. UI never renders agent dispatch, API key, runner, local file, or raw log controls.

Expected result: The user can understand project state and reports without access to execution capabilities.

### F47-S03: Developer Console

1. Developer signs in through Supabase Auth.
2. Developer selects a workspace with Developer permission.
3. App routes to Developer Console.
4. Console shows runner status before any dispatch action.
5. If runner is missing/offline, dispatch remains blocked.

Expected result: Developer knows what local execution capability exists before sending work to an agent.

### F47-S04: Direct Route Guard

1. General User signs in.
2. User manually enters `/developer`, `/keys`, `/settings`, or future agent route.
3. App checks workspace membership and capability.
4. App renders an explicit access-denied state.

Expected result: No privileged data or controls render during loading, failure, or denial.

### F47-S10: Supabase Failure

1. Authenticated user opens the app.
2. Supabase membership/project query fails.
3. UI shows a recoverable cloud error state.
4. Existing route intent is preserved so retry can continue after recovery.

Expected result: The app does not fall back into a misleading local-only dashboard.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification. User-role and permission scenarios must be added before shipping any route that changes auth or runner behavior.
