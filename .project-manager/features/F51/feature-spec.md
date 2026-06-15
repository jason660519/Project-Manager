# F51 Feature Spec - Project Dispatch Assistant

## Purpose

Create the core Project Dispatch Assistant capability: a structured, cross-discipline
planning layer that turns raw project work into reviewable dispatch decision
packages. The assistant should help a PM or lead triage work, split it into
role-ready work packages, recommend actors, expose dependency / risk / approval
points, and prepare executive-ready summaries.

## Product Position

Project Dispatch Assistant is not a coding-agent prompt generator. It is the
product-level dispatch layer for project work across software, product,
architecture, structural, civil, MEP, construction, procurement, operations, QA,
and executive stakeholder contexts.

Software-agent dispatch remains a supported adapter, but not the domain boundary.
The generic dispatch target is an actor: human, AI agent, tool, review queue,
vendor, authority, client, or hybrid role.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM, I want raw project requests converted into role-ready work packages so that specialists can execute without reverse-engineering intent. |
| US-02 | As a lead, I want recommended human / AI / tool actors with reasons so that I can approve or edit assignments before dispatch. |
| US-03 | As an engineering manager, I want dependencies, risks, and approval gates surfaced before launch so that unsafe parallel work is visible. |
| US-04 | As an executive stakeholder, I want a concise dispatch summary covering status, risks, decisions needed, and next actions. |
| US-05 | As a software user, I still want existing agent dispatch work to fit as one discipline template, not as the only workflow. |

## Functional Requirements

- FR-1 Define a generic project dispatch model with project item kind, discipline,
  actor kind, actor profile, work package, actor assignment, dispatch risk,
  approval gate, and executive summary.
- FR-2 Provide a pure planner function that accepts a project item plus optional
  actor profiles and returns a structured dispatch plan.
- FR-3 The planner must preserve user-authored dependencies, risks, acceptance
  criteria, expected outputs, and approvals in the generated plan.
- FR-4 Actor recommendation must prefer matching discipline, required role, and
  actor kind, while allowing no-match plans to remain reviewable.
- FR-5 The plan must mark execution as `needs_review` by default. This slice must
  not auto-run actors.
- FR-6 Executive summary must be generated from structured plan fields, not from
  a freeform software-only prompt.
- FR-7 Software work and construction/structural/PM work must use the same public
  planner API.
- FR-8 `/dispatch <featureId>` in chat must return a structured Dispatch Decision
  Package for human review and must not spawn an agent process.
- FR-9 Human review edits must support changing work-package outputs, risks,
  approval requirements, and actor assignments while keeping the plan in
  `needs_review` until an explicit approval step exists.
- FR-10 Approval must be explicit and guarded: plans with assignment gaps or
  unresolved approval gates cannot move to `approved`; successful approval must
  still avoid automatic actor execution.

## Acceptance Criteria

1. `F51` exists in `.project-manager/config.json` with README, spec, TDD spec,
   test-scenarios, and dev-log paths.
2. Tests prove a structural/construction task produces a role-ready work package,
   approval gate, and executive summary without software vocabulary assumptions.
3. Tests prove a software feature task can still recommend an AI agent or human
   software actor through the same model.
4. Tests prove the planner keeps plans review-first (`needs_review`) and does not
   imply automatic execution.
5. Chat `/dispatch <id>` returns the Project Dispatch Assistant package and does
   not show the old dashboard-only handoff.
6. Tests prove human review edits create a new revision and do not auto-approve
   or auto-execute the plan.
7. Tests prove approval is blocked by assignment gaps / unresolved gates and that
   successful approval does not auto-execute actors.
8. `npm run test -- __tests__/projectDispatchAssistant.test.ts __tests__/chat.agent.test.ts` passes.
9. Before claiming completion, `npm run verify:baseline` passes.

## Open Decisions

- UI entry point: Development sheet inline action, dedicated Dispatch Assistant
  route, or chat command.
- Long-term naming: external product copy may use `Project Dispatch Assistant`;
  architecture docs may use `Multi-Actor, Multi-Discipline Dispatch Assistant`.
- Whether durable dispatch-plan persistence needs a future schemaVersion bump.
