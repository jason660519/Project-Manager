# F52 Feature Spec - Project Workflow Loop Engine

## Purpose

Create a cross-discipline Project Workflow Loop Engine that lets Project Manager
turn approved project work into bounded, auditable loops. The system should
compose project workflow templates, isolated node execution plans, structured
handoffs, evidence ledgers, scorecards, stop policies, and human approval gates.

F52 absorbs the useful parts of multi-agent graph orchestration and Loop
Engineering while correcting their failure modes: software-only pipelines,
unbounded autonomous execution, token-heavy monitoring, context drift,
self-review bias, and overbaking.

## Product Position

Project Workflow Loop Engine is a PM orchestration capability, not a coding-agent
runner. Software engineering is the first built-in template because it is easy to
verify with tests, worktrees, and PR gates. The public model must support any
project discipline where work can be decomposed, handed off, verified, approved,
and reported.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM, I want repeatable project loops so recurring work can be triaged, dispatched, verified, and reported without rebuilding prompts every time. |
| US-02 | As a discipline lead, I want each node to receive only the context it needs so specialists and AI agents do not carry unrelated global history. |
| US-03 | As an executive stakeholder, I want evidence-backed status and decision points so I can trust what the loop reports. |
| US-04 | As a safety owner, I want human approval gates before high-risk actions so autonomy does not bypass accountability. |
| US-05 | As a software user, I want a first Software Engineering Loop template that models analysis, implementation, tests, quality gate, human approval, and PR preparation. |

## Functional Requirements

- FR-1 Define a domain-neutral workflow template model with discipline, trigger,
  node definitions, handoff contracts, evidence requirements, scorecards, stop
  policy, approval policy, runtime hints, and template validation.
- FR-2 Define workflow run state with isolated node runs, dependencies, status,
  attempt counts, handoff artifacts, evidence ledger records, scorecard results,
  approvals, and next actions.
- FR-3 Provide a built-in Software Engineering Loop template using the generic
  model rather than software-only engine types.
- FR-4 Create runs in review-first / queued state without executing nodes.
- FR-5 Mark root nodes ready and keep dependent nodes queued until required
  upstream nodes succeed and required scorecards pass.
- FR-6 Block approval when required evidence, required scorecards, assignment
  readiness, or approval gates are unresolved.
- FR-7 Provide a loop decision package renderer that explains nodes, handoffs,
  scorecards, evidence gaps, approvals, stop policy, and human next action.
- FR-8 Detect overbaking risk through stop policy and scope lock: max attempts,
  max tokens or equivalent budget, and explicit allowed scope.
- FR-9 Keep persistent memory outside chat transcript by recording durable
  workflow-run artifacts and evidence summaries.
- FR-10 Avoid token-heavy polling by modeling workflow events and next actions;
  monitoring is event-driven in the core model.

## Acceptance Criteria

1. F52 exists in `.project-manager/config.json` with README, feature spec, TDD
   spec, test scenarios, and dev-log paths.
2. The engine exports a generic Project Workflow model whose types are not named
   as agent-only or software-only.
3. Tests prove the Software Engineering Loop is a built-in template but uses the
   same generic model expected by non-software domains.
4. Tests prove creating a run does not execute commands or spawn actors.
5. Tests prove node completion records structured handoff artifacts and evidence.
6. Tests prove missing required evidence or failed scorecards block downstream
   progress / approval.
7. Tests prove approval remains human-gated before high-risk actions such as PR
   preparation.
8. Focused tests pass: `npm run test -- __tests__/projectWorkflowEngine.test.ts`.
9. Before claiming completion, `npm run verify:baseline` passes.

## Open Decisions

- Future UI entry point: Development sheet, dedicated Workflow Loops view, or
  Dispatch Assistant details panel.
- Durable persistence location for workflow runs beyond in-memory model tests:
  reuse `.project-manager/workflow-runs/` or create
  `.project-manager/project-workflow-runs/`.
- Whether later durable persistence requires a schemaVersion bump.
