# F62 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F62 exists with phase `completed` after green baseline |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- |
| B1 Normal | An Agent Runtime integration row with command, capabilities, and path evidence | The detail model is built | It returns Agent Runtime, MCP, Skills, Session, and Cost groups with evidence counts and ready / missing states |
| B2 Boundary | An Agent Runtime row has missing optional paths and partial capability coverage | The detail model is built | Missing groups remain visible with `missing` state and no false ready label |
| B3 Abnormal | Snapshot diagnostics and tool warnings exist | The detail model is built | Warning and diagnostic messages are preserved for the read-only panel |
| B4 Permission / Security | A malformed payload includes `fileContents`, `rawSecret`, or token-like fields | The detail model is built | Displayable values do not contain the secret-like content |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing Integrations detail rows regress | Existing plugin / skills / command detail branches remain conditionally rendered |
| C2 | Agent Runtime rows become actionable by mistake | No new action callbacks or mutation buttons are added for F62 |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F62-M01 | Primary workflow smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Detail sheet shows Agent Runtime Evidence and all five readiness groups |
| F62-M02 | Recovery state | Inspect a row with missing evidence or diagnostics | The panel shows missing / warning state without crashing |
| F62-M03 | Security smoke | Inspect rendered detail content | No file contents or key-like values are visible |

## Required Verification

- Focused tests for changed behavior.
- `npm run typecheck` when TypeScript changes.
- `npm run docs:check` when docs or feature artifacts change.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` for UI route health.
- Browser smoke on `/integrations-hub/agent-runtime` after selecting a runtime row.
- `npm run verify:baseline` before claiming completion.
