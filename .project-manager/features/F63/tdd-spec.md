# F63 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F63 exists with phase `completed` after green baseline |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Runtime supports sessions and cost, and at least one `sessions-root` exists | Build summary | Session state is `ready`, cost state is `evidence_available`, and counts match path evidence |
| B2 Boundary | Runtime supports sessions/cost but no `sessions-root` exists | Build summary | Session state is `missing`, cost state is `missing_session_evidence`, and reason is explicit |
| B3 Unsupported | Runtime has `cost: false` | Build summary | Cost state is `unsupported` even if session roots exist |
| B4 Security | Row includes secret-bearing paths or malformed secret-like fixture fields | Build summary | Displayable JSON does not contain secret fixture strings or transcript contents |
| B5 Integration | Detail model builds Session and Cost groups | Build detail model from an Agent Runtime integration row | Session/Cost summaries come from the shared helper instead of ad hoc group wording |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing Agent Runtime scanner rows regress | F57/F60/F62 focused tests remain green where affected |
| C2 | Helper starts reading files | No filesystem, bridge, or Tauri imports are introduced |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F63-M01 | Primary workflow smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Session and Cost groups still render without blank state or hidden failure |
| F63-M02 | Recovery state | Inspect a runtime missing session evidence | Cost group says session evidence is missing rather than implying cost is ready |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` if detail model wording changes route output.
- `npm run verify:baseline` before marking complete.
