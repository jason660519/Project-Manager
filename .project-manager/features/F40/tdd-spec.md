# F40 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F40 exists with phase `development` unless intentionally changed |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | User action | Expected |
| --- | --- | --- |
| B1 | User opens the affected route or workflow | Existing state and navigation remain visible |
| B2 | User hits an empty/loading/error state | The state is explicit and recoverable |
| B3 | User repeats the core workflow | No duplicate side effects or stale UI state |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing routes or sheets regress | Focused tests or manual smoke cover affected routes |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F40-M01 | Primary workflow smoke | Open the affected route or workflow | It renders without blank state or hidden failure |
| F40-M02 | Recovery state | Trigger or inspect a fallback state | The UI explains what happened and what to do next |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
