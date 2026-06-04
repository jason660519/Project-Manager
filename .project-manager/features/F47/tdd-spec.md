# F47 TDD Specification

## Test Strategy

Start with role routing and permission boundaries before implementing broad Supabase CRUD. The first tests should prove that users with different workspace roles land in different surfaces and cannot see or invoke capabilities outside their role.

## Suite A: Metadata and Artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F47 exists with phase `development`, status `in_progress`, and progress below 100. |
| A2 | Feature paths | README, feature spec, TDD spec, test scenarios, and dev log exist and are non-empty. |
| A3 | Dashboard notes | `feature.notes` is short descriptive text and not an artifact path. |

## Suite B: Auth Session and Login Routing

| Case | User state | Expected |
| --- | --- | --- |
| B1 | No Supabase session opens `/login` | Login entry renders with workspace-safe messaging and no privileged actions. |
| B2 | Authenticated Developer selects workspace | User is routed to Developer Console entry. |
| B3 | Authenticated general User selects workspace | User is routed to User Portal entry. |
| B4 | Authenticated user has no workspace membership | Blocked state explains missing membership and offers recovery path. |
| B5 | Supabase session loading | Loading state is explicit and does not briefly expose privileged Developer UI. |
| B6 | Supabase auth error | Error state explains what failed and preserves current route intent. |

## Suite C: Permission Boundaries

| Case | User role | Attempt | Expected |
| --- | --- | --- | --- |
| C1 | General User | Open Developer route directly | Access denied state; no agent, keys, runner, or raw log controls render. |
| C2 | General User | View project progress/report/solution URL | Allowed when workspace/project permission grants read access. |
| C3 | Developer | Dispatch agent without paired runner | Blocked state says runner is missing/offline; no false success. |
| C4 | Developer | Dispatch agent with denied project permission | Blocked state explains project permission denial. |
| C5 | Developer | Open key/settings surface | Allowed only for explicit permission; raw secret values never render. |
| C6 | Admin/Owner | Open member management route | Route is reserved for admin role; non-admin users are blocked. |

## Suite D: Runner Pairing and Execution

| Case | Runner state | Expected |
| --- | --- | --- |
| D1 | No runner paired | Developer Console shows `Runner not connected` and pairing CTA. |
| D2 | Runner paired but offline | Dispatch disabled; UI explains last seen time and recovery. |
| D3 | Runner online but project root not approved | Dispatch blocked until project access is granted. |
| D4 | Runner online and execution policy allows task | Prompt preview and guarded dispatch path are available. |
| D5 | Runner starts command | Run metadata is created in cloud DB and logs stream through the selected transport. |
| D6 | Runner fails mid-run | Cloud run status becomes failed/degraded and logs/artifacts are preserved. |

## Suite E: Storage and Sync Integrity

| Case | Risk | Expected |
| --- | --- | --- |
| E1 | Same feature exists in cloud and local config | Sync strategy defines precedence before writeback. |
| E2 | Network unavailable during local runner action | Operation queues locally only if idempotent and visibly marked pending. |
| E3 | Raw logs grow large | DB stores metadata/summary; raw log location is externalized. |
| E4 | Role changes while session is active | Next permission refresh removes newly forbidden capabilities. |
| E5 | User switches workspace | Route state and cached project data reset to the selected workspace boundary. |

## Unit Test Backlog

- `auth.supabase-role-routing.test.tsx`: mocked Supabase session and membership result routes user to Developer Console, User Portal, or blocked state.
- `auth.permissions.test.ts`: role/permission matrix prevents User from execution, keys, runner, and admin capabilities.
- `runner.status.test.ts`: maps paired/offline/blocked/ready runner states to dispatch availability and status labels.
- `storage.ownership.test.ts`: validates storage-owner metadata for cloud DB, local runner cache, and project files once implemented.

## Integration Test Backlog

- Login route render test with session loading, unauthenticated, authenticated Developer, authenticated User, and no-membership states.
- Developer direct-route guard test for missing runner and denied project permission.
- User Portal route test that verifies reports and solution URLs render without privileged controls.

## E2E Candidate Backlog

- New user signs in, selects workspace, lands in User Portal, opens a solution detail URL.
- Developer signs in, selects workspace, sees runner offline state, pairs runner, and reaches dispatch preview.
- General User attempts direct `/developer` URL and receives a blocked state.
- Admin changes a member from Developer to User; restricted controls disappear after refresh.

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F47-M01 | General User portal smoke | Sign in as User and open portal routes | Progress, reports, and solution URLs render; no execution controls appear. |
| F47-M02 | Developer runner blocked state | Sign in as Developer without runner | Developer Console explains missing runner and disables dispatch. |
| F47-M03 | Direct-route permission guard | Paste a Developer route as User | Access denied state renders without exposing privileged data. |
| F47-M04 | Network degraded state | Simulate Supabase request failure | UI explains failure, preserves route intent, and avoids false success. |

## Required Verification For This Planning Slice

- `jq '.features[] | select(.id=="F47")' .project-manager/config.json`
- `test -s` for all F47 artifact files
- `npm run docs:check`

Full `npm run verify:baseline` is required before claiming implementation complete, but this kickoff slice is not the product implementation.
