# F49 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F49 exists with phase `development` unless intentionally changed |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Dependency graph utilities

| Case | Input | Expected |
| --- | --- | --- |
| B1 | Feature A has upstream B | Downstream index for B includes A |
| B2 | Feature A has upstream B and C | A is blocked if any hard upstream dependency is incomplete |
| B3 | Feature A has only soft incomplete upstream dependencies | A is warning-only, not blocked |
| B4 | Feature A depends on itself | Graph reports self-dependency and dispatch state is blocked |
| B5 | A depends on B and B depends on A | Graph reports a cycle and dispatch state is blocked |
| B6 | A depends on missing F99 | Graph reports missing ref and UI can show malformed dependency |
| B7 | Two dashboard projects both have F01 | Namespaced refs resolve to the intended project when `projectId` is present |
| B8 | Feature with no upstream deps and no active run | Dispatch readiness is `ready` |

## Suite C: Development sheet behavior

| Case | User action | Expected |
| --- | --- | --- |
| C1 | User opens Project Dashboard > Development | Upstream and downstream dependency columns render without breaking existing table layout |
| C2 | User enters `F37, F42` as upstream dependencies | Feature patch stores structured refs, not a raw string |
| C3 | User enters current row id as upstream dependency | Save is rejected or flagged as blocked; no silent self-dependency persists |
| C4 | User searches `F37` | Rows depending on or depended on by F37 remain discoverable |
| C5 | User hides dependency columns and resets view | Hidden column recovery and default widths remain valid |
| C6 | Legacy table preferences have old Development width count | Read normalization prevents width-column misalignment |
| C7 | Custom row appears in Development | Dependency columns show unavailable state instead of writing unsupported custom-row fields |

## Suite D: Dispatch guard behavior

| Case | Risk | Expected |
| --- | --- | --- |
| D1 | User opens Dispatch on feature blocked by incomplete hard upstream | Modal shows blocked state and primary dispatch is disabled or requires explicit override |
| D2 | User opens Dispatch on feature with incomplete soft upstream | Modal shows warning but dispatch remains possible |
| D3 | User opens Dispatch for a feature already running | Duplicate dispatch is blocked |
| D4 | User opens Dispatch where dependency graph has a cycle | Dispatch is blocked with repair hint |
| D5 | User opens Dispatch in browser mode | Dry-run behavior remains explicit; dependency guard still evaluates locally |

## Suite E: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| E1 | Existing Development columns regress | Existing Progress, Status, document links, P/W/E chips, and Dispatch controls still render |
| E2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| E3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F49-M01 | Development sheet smoke | Open `/project-progress-dashboard?phase=development` | Dependency columns render; no blank table or hidden runtime failure |
| F49-M02 | Dependency edit smoke | Edit a feature upstream dependency, reload config or route | Structured dependency persists and downstream column updates |
| F49-M03 | Blocked dispatch smoke | Try dispatching a feature with incomplete hard upstream | The UI explains the blocker before any agent command runs |
| F49-M04 | Missing dependency smoke | Add or inspect a missing dependency ref | The row shows a repairable missing-ref state |
| F49-M05 | Width preference smoke | Resize or hide dependency columns, reload, reset view | Preferences behave and reset restores columns |

## Required Verification

- `npm run test -- --run __tests__/projectProgress.dependencies.test.tsx`
- `npm run test -- --run __tests__/progressDashboard.SheetTabs.test.tsx` if table preferences or sheet behavior changes
- `npm run typecheck`
- `npm run table:sheet:audit -- --write` if column/table metadata changes
- `npm run docs:check` when docs or feature artifacts change
- Manual browser smoke for `/project-progress-dashboard?phase=development`
