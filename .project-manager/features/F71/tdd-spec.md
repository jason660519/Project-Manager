# F71 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F71 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Approved JSON array with user/assistant/tool messages | Parse envelope | Status `ready`, message count and role counts returned, no text |
| B2 Object | Approved JSON object with `messages` array | Parse envelope | Counts are derived from the nested array |
| B3 Boundary | Unapproved request | Parse envelope | Status `blocked`, no envelope, approval reason retained |
| B4 Security | Content contains secrets, prompts, tool args, and filename-like strings | Serialize response | None of those strings appear |
| B5 Bridge | TS wrapper is called outside Tauri | Wrapper returns blocked redacted response |
| B6 Capability | Default Tauri capability is checked | Command permission is listed |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | F64-F70 behavior regresses | F64-F70 focused tests remain green |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F71-M01 | Route smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Passed: existing session import copy remains visible with console/page errors 0 |
| F71-M02 | Native parser smoke | Run focused Rust/TS tests | Passed: redacted parser returns aggregate metadata only |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- Focused Rust tests for native redacted envelope parser.
- Focused TS tests for bridge/capability contract.
- F64-F71 focused regression tests.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Verification Results

- Red TS: F71 focused test failed before implementation because bridge/permission contract did not exist.
- Red Rust: focused Rust suite failed before implementation because envelope parser helper did not exist.
- Green TS: focused F71 suite passed 2 tests.
- Green Rust: focused F71 Rust suite passed 3 tests.
- Regression TS: F64-F71 suites passed 31 tests.
- Regression Rust: Agent Runtime native suites passed 13 tests.
- Typecheck, docs check, cargo check, UI route health, and browser smoke: passed.
- Baseline: `npm run verify:baseline` passed; Vitest 247 files, 1569 tests passed, 1 skipped; cargo check and build passed.
