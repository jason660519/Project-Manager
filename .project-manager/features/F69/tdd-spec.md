# F69 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F69 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Approved request has target file under an allowlisted root and size <= max bytes | Build boundary result | Status is `ready`, response includes root path, byte length, max bytes, redaction flags, and no target filename/content |
| B2 Permission | Approved is false | Build boundary result | Status is `blocked`, no metadata, reason says approval is required |
| B3 Path escape | Target file is outside allowlisted root | Build boundary result | Status is `blocked`, reason says target is outside approved roots |
| B4 Size guard | Target file size exceeds max bytes | Build boundary result | Status is `blocked`, reason says target exceeds max bytes |
| B5 Missing target | Target path does not exist | Build boundary result | Status is `blocked`, reason says target metadata could not be read |
| B6 Bridge | TS wrapper is called | Wrapper invokes `read_agent_runtime_session_boundary` with typed request |
| B7 Capability | Default Tauri capability is checked | Command permission is listed |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | F64-F68 behavior regresses | F64-F68 focused tests remain green |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F69-M01 | Route smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Passed: existing preview/dry-run/approval copy remains visible with console/page errors 0 |
| F69-M02 | Native boundary smoke | Run focused Rust/TS tests | Passed: boundary blocks unsafe requests and returns metadata-only ready response |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- Focused Rust tests for native reader boundary.
- Focused TS tests for bridge/capability contract.
- F64/F65/F66/F67/F68/F69 focused regression tests.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Verification Results

- Red TS: F69 focused test failed before implementation because bridge/permission contract did not exist.
- Red Rust: focused Rust suite failed before implementation because request/helper did not exist.
- Green TS: focused F69 suite passed 2 tests.
- Green Rust: focused F69 Rust suite passed 4 tests.
- Regression TS: F64-F69 suites passed 27 tests.
- Regression Rust: Agent Runtime native suites passed 7 tests.
- Typecheck, docs check, cargo check, UI route health, and browser smoke: passed.
- Baseline: passed with Vitest 1565 passed, 1 skipped; cargo check and build passed.
