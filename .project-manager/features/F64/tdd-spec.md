# F64 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F64 exists with phase `completed` after green baseline |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | Runtime supports sessions and has one existing `sessions-root` | Build preview | State is `ready`, importable root count is 1, candidate mode is `metadata_only` |
| B2 Boundary | Runtime supports sessions but all session roots are missing | Build preview | State is `blocked` with reason `No existing session root was detected.` |
| B3 Unsupported | Runtime has `sessions: false` | Build preview | State is `unsupported` with an explicit blocked reason |
| B4 Security | Row includes secret-bearing config path, file contents, raw secret, and transcript fixture fields | Build preview | Displayable JSON excludes the secret path and fixture strings |
| B5 Integration | Detail model builds a Session group | Build detail model from an Agent Runtime integration row | Session group details include import preview text from the shared preview contract |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | F63 summary regresses | F63 focused tests remain green |
| C2 | Detail panel becomes actionable | No new buttons, bridge calls, or mutation callbacks are added |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F64-M01 | Primary workflow smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Session group renders import preview detail with console/page errors 0 |
| F64-M02 | Recovery state | Inspect missing session evidence | Session group remains visible and blocked reason is explicit |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.
