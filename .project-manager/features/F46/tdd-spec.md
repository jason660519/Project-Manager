# F46 TDD Specification

## Testing Strategy

F46 has two testing layers:

1. Kickoff/documentation verification: prove the Development sheet metadata and artifacts exist before implementation.
2. Product behavior tests for future slices: prove mobile-originated voice/text requests become safe, typed, policy-checked desktop actions.

The high-risk behavior is not transcription itself. The high-risk behavior is accidentally treating a phone transcript as authority to run local desktop commands. Tests should therefore focus on intent normalization, policy gates, confirmation, audit, and recovery states.

## Suite A: Metadata and Artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F46 exists with status `in_progress`, phase `development`, and progress `10`. |
| A2 | F46 paths | README, feature spec, TDD spec, test scenarios, and dev log files exist and are non-empty. |
| A3 | Dashboard notes | `feature.notes` is short descriptive text, not an artifact path. |
| A4 | Implementation pointer | F46 points to the planned ADR path until code implementation begins. |

## Suite B: Intent Parser Unit Tests

Focused test candidate: `__tests__/mobileVoiceRemoteControl.intent.test.ts`

| Case | User Input | Expected Intent | Notes |
| --- | --- | --- | --- |
| B1 | `status` | `{ type: 'get_project_status' }` | Generic project status. |
| B2 | `F41 status` | `{ type: 'get_feature_status', featureId: 'F41' }` | Feature id extraction preserves uppercase ID. |
| B3 | `today report` | `{ type: 'daily_report', rangeDays: 1 }` | Short reporting phrase. |
| B4 | `last week report` | `{ type: 'daily_report', rangeDays: 7 }` | Default daily report range. |
| B5 | `run F41 verification` | `{ type: 'run_gate', gate: 'verify_baseline' }` or guarded run proposal | Must not execute during parse. |
| B6 | `run feature F46` | `{ type: 'run_feature', featureId: 'F46', mode: 'dry_run' | 'live' }` | Mode defaults must be explicit. |
| B7 | `stop the current run` | `{ type: 'stop_run' }` | Resolver later maps to active run. |
| B8 | `delete my project folder` | parse failure or blocked high-risk intent | No arbitrary shell passthrough. |
| B9 | Empty transcript | parse failure with recoverable message | UI asks user to try again. |
| B10 | Ambiguous feature name | needs clarification | No guessed execution target. |

## Suite C: Policy Evaluation Integration Tests

| Case | Intent | Policy State | Expected |
| --- | --- | --- | --- |
| C1 | `get_project_status` | Any paired active device | Allowed read-only response. |
| C2 | `daily_report` | Any paired active device with report scope | Allowed read-only response. |
| C3 | `run_feature` | `tool:run_command` blocked | Blocked, no spawn. |
| C4 | `run_feature` | guarded + command exposed + boundary allowed | Returns `needs_confirmation`, no spawn before approval. |
| C5 | `run_gate verify_baseline` | browser mode | Dry-run-only response; no live spawn. |
| C6 | `stop_run` | active run belongs to current desktop session | Sends cancel/kill through existing bridge path. |
| C7 | `stop_run` | no active run | Recoverable no-op response. |
| C8 | Unknown intent type | Any state | Reject fail-closed. |

## Suite D: Pairing and Device Authorization Tests

| Case | State | Expected |
| --- | --- | --- |
| D1 | Pairing token expired | Phone cannot register; Desktop shows expired state. |
| D2 | Device active | Read-only intents accepted for allowed scopes. |
| D3 | Device revoked | All requests blocked with revoked-device state. |
| D4 | Device lacks `guarded_run_request` scope | Run requests blocked before policy evaluation. |
| D5 | Duplicate device registration | Stable device id is reused or rejected deterministically, never duplicated silently. |
| D6 | Desktop offline | Mobile shows offline/retry, not success. |

## Suite E: Audit and Event Correlation Tests

| Case | Trigger | Expected |
| --- | --- | --- |
| E1 | Read-only status request | Audit event includes device id, transcript/text, intent, result state. |
| E2 | Guarded command approved | Audit event includes policy decision, confirmation timestamp, and run reference. |
| E3 | Agent emits stdout/stderr/exit | Mobile/desktop result stream correlates by `spawnToken`, never PID only. |
| E4 | Command blocked | Audit records blocked reason and no run reference. |
| E5 | Transcript corrected before submit | Audit preserves raw and corrected transcript. |

## Suite F: Mobile UI and Recovery State Tests

| Case | User Path | Expected |
| --- | --- | --- |
| F1 | First launch before pairing | Pairing screen explains Desktop QR/code requirement. |
| F2 | Recording with partial transcript | Partial transcript updates without committing an intent. |
| F3 | Transcript correction | User can edit final text before submit. |
| F4 | Guarded approval card | Shows action, project, feature/gate, command/cwd if known, and policy state. |
| F5 | Blocked command | Shows blocked reason and no success copy. |
| F6 | Completed run | Activity feed shows completion, duration/result, and desktop log/session reference. |
| F7 | Failed run | Activity feed shows failure category and preserved logs. |
| F8 | Lost connection mid-run | Mobile shows reconnecting/stale state while Desktop keeps canonical run state. |

## Manual Verification Plan

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| F46-M01 | Development sheet handoff | Open Project Dashboard > Development > F46 | Artifact links open and describe mobile voice remote control. |
| F46-M02 | Telegram Phase 0 status | Configure Telegram channel, start polling, send `/status` | Recent Activity shows inbound message; reply summarizes project status. |
| F46-M03 | Guarded run request | From phone request `run F41 verification` | Desktop/mobile show confirmation before live execution. |
| F46-M04 | Blocked dangerous command | From phone request a destructive shell-like action | System blocks and explains no arbitrary command execution. |
| F46-M05 | Result streaming | Approve a safe dry-run/guarded task | Result references logs/session and preserves failure details if failed. |
| F46-M06 | Revocation | Revoke paired device then submit a command | Request fails closed and is auditable. |
| F46-M07 | Disconnected desktop | Phone sends command when Desktop gateway is offline | Mobile shows offline/retry state, not a false success. |

## Required Verification Before Claiming Complete

- `npm run docs:check` for kickoff artifacts.
- `jq`/shell metadata checks for F46 config and non-empty artifacts.
- Once TypeScript implementation begins: `npm run typecheck`.
- Once gateway/bridge implementation begins: targeted unit tests plus `cargo check --manifest-path src-tauri/Cargo.toml`.
- Before saying complete or 100%: `npm run verify:baseline` and UI/browser smoke for changed routes per `verify-before-complete`.
