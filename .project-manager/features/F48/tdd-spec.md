# F48 TDD Specification

## Test Strategy

The first implementation must be test-first and side-effect free. Tests should validate installer decisions from mocked host state instead of invoking Docker or mutating the workstation.

## Suite A: Metadata and Artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F48 exists with status `in_progress`, phase `development`, and progress below 100. |
| A2 | Feature paths | README, feature spec, TDD spec, test scenarios, and dev log exist and are non-empty. |
| A3 | Dashboard notes | `feature.notes` is short descriptive text, not an artifact path. |

## Suite B: Installer Planning

| Case | Host state | Expected |
| --- | --- | --- |
| B1 | Docker-compatible runtime detected, required ports free | Plan includes pull images, generate env, start stack, run migrations, health check, create owner. |
| B2 | No Docker-compatible runtime detected | Plan returns `runtime_required` with guided install steps; no silent system install. |
| B3 | Required port is occupied | Plan returns `port_conflict` with conflicting port list and recovery action. |
| B4 | Existing installed stack detected | Plan prefers status/upgrade path instead of overwriting volumes. |
| B5 | Dry-run requested | Plan describes actions but contains no destructive operation. |

## Suite C: Connector Profile

| Case | Input | Expected |
| --- | --- | --- |
| C1 | Local self-hosted install result | Creates connector-safe profile with URL and anon key only. |
| C2 | VM self-hosted endpoint | Profile preserves custom domain/IP and deployment mode. |
| C3 | Supabase Cloud endpoint | Same connector shape works without self-hosted ops fields. |
| C4 | Service-role key present in ops context | Renderer-safe profile omits service-role key. |

## Suite D: Maintenance Commands

| Case | Command | Expected |
| --- | --- | --- |
| D1 | `status` | Reports runtime, service, port, schema, and health state. |
| D2 | `doctor` | Reports actionable diagnostics without claiming success on blocked checks. |
| D3 | `backup` | Produces plan for Postgres and storage backup with destination and retention. |
| D4 | `restore` | Requires explicit destructive confirmation and known backup source. |
| D5 | `upgrade` | Requires backup step before image pull/migration. |
| D6 | `logs` | Collects logs without exposing secrets. |

## Suite E: User Scenarios

| Case | Persona | Scenario | Expected |
| --- | --- | --- | --- |
| E1 | Workspace Owner | Runs one-click installer on machine with Docker | Backend profile generated and health check passes. |
| E2 | Workspace Owner | Runs installer without Docker | Guided install state; no hidden failure. |
| E3 | General User | Opens PM and enters workspace URL | User connects to existing backend; Docker is not required. |
| E4 | Developer | Connects PM Desktop to self-hosted backend | Developer can proceed to runner pairing only after auth/workspace checks. |
| E5 | Admin | Upgrades backend | Backup-before-upgrade policy is enforced. |

## Unit Test Backlog

- `pmSystemInstaller.plan.test.ts`
  - Docker available/free ports -> install plan.
  - Docker missing -> runtime-required plan.
  - Port conflict -> blocked plan.
  - Existing stack -> status/upgrade plan.
  - Dry-run -> no destructive operations.
- `pmBackendProfile.test.ts`
  - Profile generation for local, VM, cloud.
  - Renderer-safe profile strips service-role key.
- `pmSystemMaintenance.test.ts`
  - Command registry includes required commands.
  - Upgrade requires backup.
  - Restore requires confirmation.

## Manual Verification Candidates

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F48-M01 | Owner local install dry-run | Run installer in dry-run mode | Shows planned Docker/Supabase actions and exits without mutation. |
| F48-M02 | Missing Docker | Temporarily run in environment without Docker socket | Shows guided runtime install instructions. |
| F48-M03 | Port conflict | Occupy a required port, then run doctor | Doctor identifies conflict and recovery. |
| F48-M04 | General User connect | Open PM client and connect to existing backend URL | No Docker prompt appears. |

## Required Verification

- Focused tests for planning logic.
- `npm run typecheck` for TypeScript changes.
- `npm run docs:check` for feature artifacts and runbook/docs changes.
- `npm run verify:baseline` before claiming completion or shipping.
