# F72 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F72 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | User action | Expected |
| --- | --- | --- |
| B1 Normal | Detail model receives a ready aggregate envelope | Session details include message count, role buckets, and tool-call count |
| B2 Boundary | Detail model has no aggregate envelope | Existing preview/dry-run/approval details remain unchanged |
| B3 Blocked | Aggregate result is blocked | Summary says envelope is blocked and keeps reasons metadata-only |
| B4 Permission | UI/mapper path is evaluated | No Tauri call, raw `invoke`, transcript content, filename, tool args, or secret appears in display output |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing F64-F71 Agent Runtime tests regress | Regression suite remains green |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F72-M01 | Route smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Existing Session import copy renders with console/page errors 0 |
| F72-M02 | Safe aggregate display | Inspect detail-model test output | Envelope copy contains counts only, not transcript content |

## Required Verification

- Focused tests for changed behavior.
- F64-F72 Agent Runtime regression tests.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Red / Green / Refactor Tracking

- Red: F72 focused test failed before implementation because `sessionEnvelopeSummary` helper did not exist.
- Green: F72 focused test passed 5 tests.
- Regression: F64-F72 Agent Runtime suites passed 36 tests.
- Baseline: `npm run verify:baseline` passed; Vitest 248 files, 1574 tests passed, 1 skipped; cargo check and build passed.
