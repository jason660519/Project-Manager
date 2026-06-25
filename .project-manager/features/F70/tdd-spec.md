# F70 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F70 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Approved in-root JSON object file under max bytes | Read redacted content | Status `ready`, structural metadata returned, content/name redacted |
| B2 Boundary | Approved JSON array file under max bytes | Read redacted content | `looksLikeJsonArray` true and no content returned |
| B3 Permission | Approved is false | Read redacted content | Status `blocked`, no structure, approval reason retained |
| B4 Size guard | File exceeds max bytes | Read redacted content | Status `blocked`, no content returned |
| B5 Security | File contains filename-like text, prompts, and secrets | Serialize response | Displayable JSON excludes those strings |
| B6 Bridge | TS wrapper is called outside Tauri | Wrapper returns blocked redacted response |
| B7 Capability | Default Tauri capability is checked | Command permission is listed |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | F64-F69 behavior regresses | F64-F69 focused tests remain green |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F70-M01 | Route smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Passed: existing preview/dry-run/approval copy remains visible with console/page errors 0 |
| F70-M02 | Native reader smoke | Run focused Rust/TS tests | Passed: redacted reader blocks unsafe requests and returns structural metadata only |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- Focused Rust tests for native redacted reader.
- Focused TS tests for bridge/capability contract.
- F64-F70 focused regression tests.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Verification Results

- Red TS: F70 focused test failed before implementation because bridge/permission contract did not exist.
- Red Rust: focused Rust suite failed before implementation because redacted reader helper did not exist.
- Green TS: focused F70 suite passed 2 tests.
- Green Rust: focused F70 Rust suite passed 3 tests.
- Regression TS: F64-F70 suites passed 29 tests.
- Regression Rust: Agent Runtime native suites passed 10 tests.
- Typecheck, docs check, cargo check, UI route health, and browser smoke: passed.
- Baseline: passed with Vitest 1567 passed, 1 skipped; cargo check and build passed.
