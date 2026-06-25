# F67 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F67 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Ready preview has two existing roots with counts 3 and 2 | Build dry run | Status is `ready`, two metadata-only plan items, summary says `5 artifact candidate(s)` |
| B2 Boundary | Ready preview has existing roots with no counts | Build dry run | Status is `ready`, plan items omit candidate counts, summary does not imply zero |
| B3 Blocked | Preview is blocked because no root exists | Build dry run | Status is `blocked`, no plan items, blocked reason is retained |
| B4 Unsupported | Preview is unsupported | Build dry run | Status is `unsupported`, no plan items, unsupported reason is retained |
| B5 Security | Preview object has filename-like, transcript, and secret-like fixture fields | Build dry run | Displayable JSON excludes those strings |
| B6 Integration | Detail model builds Session group from a counted runtime row | Build detail model | Session group details include preview summary and dry-run summary |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | F64-F66 preview behavior regresses | F64-F66 focused tests remain green |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F67-M01 | Primary workflow smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Passed: Session group renders preview and dry-run copy with console/page errors 0 |
| F67-M02 | Browser fallback | Count metadata is absent | Covered by focused test: dry run stays metadata-only and does not show false zero artifacts |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- F64/F65/F66/F67 focused regression tests.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Verification Results

- Red: focused F67 suite failed before implementation because `sessionImportDryRun` did not exist.
- Green: focused F67 suite passed 6 tests.
- Regression: F64/F65/F66/F67 suites passed 18 tests after updating F66 detail assertion to preserve preview copy while allowing F67 dry-run copy.
- Typecheck: passed.
- Docs check: passed.
- UI route health and browser smoke: passed.
- Baseline: passed with Vitest 1556 passed, 1 skipped; cargo check and build passed.
