# F68 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F68 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Ready dry run has two roots with aggregate count 5 and decision approved | Build approval | Status is `approved`, reader request has two root paths, mode `transcript_reader_pending`, count 5 |
| B2 Boundary | Ready dry run has no count metadata and decision approved | Build approval | Reader request count is `null` and summary does not imply zero |
| B3 Unapproved | Ready dry run exists but decision is not approved | Build approval | Status is `needs_approval`, no reader request, reason explains approval is required |
| B4 Blocked | Dry run is blocked | Build approval | Status is `blocked`, no reader request, blocked reason is retained |
| B5 Unsupported | Dry run is unsupported | Build approval | Status is `unsupported`, no reader request, unsupported reason is retained |
| B6 Security | Dry run object has filename-like, transcript, and secret-like fixture fields | Build approval | Displayable JSON excludes those strings |
| B7 Integration | Detail model builds Session group from a counted runtime row | Build detail model | Session group details include preview, dry-run, and approval-boundary summaries |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | F64-F67 behavior regresses | F64-F67 focused tests remain green |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F68-M01 | Primary workflow smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Passed: Session group renders preview, dry-run, and approval-boundary copy with console/page errors 0 |
| F68-M02 | Browser fallback | Count metadata is absent | Covered by focused test: approval boundary stays unknown-count and does not show false zero artifacts |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- F64/F65/F66/F67/F68 focused regression tests.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Verification Results

- Red: focused F68 suite failed before implementation because `sessionImportApproval` did not exist.
- Green: focused F68 suite passed 7 tests.
- Regression: F64/F65/F66/F67/F68 suites passed 25 tests after updating F67 detail assertion to preserve dry-run copy while allowing F68 approval copy.
- Typecheck: passed after narrowing `blockedStatusFor` return type.
- Docs check: passed.
- UI route health and browser smoke: passed.
- Baseline: passed with Vitest 1563 passed, 1 skipped; cargo check and build passed.
