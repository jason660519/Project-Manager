# F65 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F65 exists with phase `completed` after green baseline |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Snapshot has child count for an existing `sessions-root` | Scan environment | Observation includes `childCount` and import preview candidate includes the same count |
| B2 Boundary | Snapshot omits child counts | Scan environment | Observation remains backward compatible with `childCount` undefined |
| B3 Abnormal | Session root count is present for a secret-bearing non-session path | Scan environment | Count is ignored because only `sessions-root` observations receive child counts |
| B4 Native | Temp session root has two first-level entries and one nested file | Build native snapshot from roots | Count is 2, not recursive, and no filenames or file contents are serialized |
| B5 UI | Agent Runtime detail renders Session import preview | Open detail model / route | Session detail can include artifact count without console errors |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Older browser fallback snapshots lack count metadata | F57/F64 focused tests remain green |
| C2 | Native scanner leaks filenames or content | Rust test asserts only count map is serialized |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F65-M01 | Primary workflow smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Session import preview still renders and can show counts when available |
| F65-M02 | Recovery state | Browser fallback snapshot lacks counts | Preview renders without blank state or false zero count |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- Focused Rust test for native shallow session root counting.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.
