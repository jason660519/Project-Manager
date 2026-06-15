# F52 TDD Specification

## Suite A: Metadata and Artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F52 exists with phase `development`, status `in_progress`, and progress below 100. |
| A2 | Feature paths | README, feature spec, TDD spec, test scenarios, and dev log exist and are non-empty. |
| A3 | Dashboard notes | Notes describe Project Workflow Loop Engine as cross-discipline, not software-only. |

## Suite B: Template Model

| Case | Behavior | Expected |
| --- | --- | --- |
| B1 | Built-in software template | Template validates as a Project Workflow template and is marked as a software example, not the engine boundary. |
| B2 | Domain-neutral fields | Nodes use actor kinds, handoff contracts, scorecards, approval gates, and runtime hints without requiring software-only roles. |
| B3 | Stop policy | Template includes scope lock, max attempts, and budget guard to prevent overbaking. |

## Suite C: Run State Machine

| Case | Behavior | Expected |
| --- | --- | --- |
| C1 | Create run | Root nodes are ready, dependent nodes are queued, and no execution command is run. |
| C2 | Complete node with evidence | Handoff artifacts and evidence ledger records are stored; downstream dependencies can become ready. |
| C3 | Missing evidence | Required evidence remains missing, scorecard fails, and downstream nodes stay blocked or queued. |
| C4 | Approval gate | Human approval is required before high-risk actions; approval is blocked while evidence / scorecards are unresolved. |

## Suite D: Rendering

| Case | Behavior | Expected |
| --- | --- | --- |
| D1 | Decision package | Rendered output lists loop status, nodes, handoff contracts, evidence gaps, scorecards, stop policy, approvals, and next action. |
| D2 | Persistent memory | Rendered output names evidence ledger / handoff artifacts as durable memory outside chat transcript. |

## Required Verification

- RED/GREEN focused cycle:
  `npm run test -- __tests__/projectWorkflowEngine.test.ts`
- Metadata/docs check:
  `npm run docs:check`
- Completion gate:
  `npm run verify:baseline`
