# F66 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F66 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Ready preview has two importable roots with child counts 3 and 2 | Build preview | Summary says `2 metadata-only root(s) ready with 5 artifact candidate(s).` |
| B2 Boundary | Ready preview has existing roots but no child counts | Build preview | Summary keeps root-only copy and does not imply zero artifacts |
| B3 Blocked | No session root exists | Build preview | Summary says preview is blocked and includes the blocked reason |
| B4 Security | Row includes filename-like, transcript, and secret-like fixture fields | Build preview | Displayable JSON excludes those strings |
| B5 Integration | Detail model builds Session group from a row with count metadata | Build detail model | Session group details include the shared count-aware summary |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | F64/F65 behavior regresses | F64/F65 focused tests remain green |
| C2 | UI duplicates preview logic | Detail model consumes preview summary directly |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F66-M01 | Primary workflow smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Passed: Session import preview detail renders with console/page errors 0 |
| F66-M02 | Browser fallback | Count metadata is absent | Covered by focused test: preview stays root-only and does not show false zero artifacts |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Verification Results

- Red: focused F66 suite failed before implementation because `summary` was missing.
- Green: focused F66 suite passed 5 tests.
- Regression: F64/F65/F66 suites passed 12 tests.
- Typecheck: passed.
- Docs check: passed.
- UI route health and browser smoke: passed.
- Baseline: passed with Vitest 1550 passed, 1 skipped; cargo check and build passed.
