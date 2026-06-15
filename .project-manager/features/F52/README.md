# F52 - Project Workflow Loop Engine

## Summary

Build the cross-discipline Project Workflow Loop Engine for Project Manager.
F52 turns approved project work into bounded, repeatable workflow loops with
isolated node context, structured handoffs, evidence ledgers, scorecards, and
human approval gates.

The first built-in template is a Software Engineering Loop, but the engine model
must stay domain-neutral for project management, architecture, construction,
structural, civil, MEP, procurement, QA, operations, legal, finance, vendors,
authorities, and client review queues.

## Current State

- Status: done
- Progress: 100%
- Phase: development
- Category: PM Orchestration
- Created: 2026-06-15

## Scope

- `lib/project-workflows/projectWorkflowEngine.ts`
- `lib/project-workflows/projectWorkflowRunStore.ts`
- `lib/project-workflows/index.ts`
- `lib/chat/chatAgent.ts`
- `__tests__/projectWorkflowEngine.test.ts`
- `__tests__/chat.agent.test.ts`
- `.project-manager/features/F52/`
- `.project-manager/config.json`

## Non-Goals

- No autonomous command execution in the first slice.
- No PR, commit, procurement order, authority submission, or vendor dispatch
  without explicit human approval.
- No dedicated UI route in this feature; F52 exposes the first product entry
  through the local chat `/workflow <featureId>` command.
- No schemaVersion bump unless durable project config shape changes beyond
  feature metadata.

## Risk Controls

- Loops require stop policy, attempt budget, and scope lock.
- Every node produces structured handoff artifacts, not freeform chat claims.
- Scorecards validate required evidence before downstream approval.
- Human approval gates block high-risk actions.
- Event-driven monitoring is preferred over token-heavy polling.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- Test scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completed Capability

- Domain-neutral workflow loop model.
- Software Engineering Loop as the first template, explicitly not the product
  boundary.
- Construction Quality Loop to prove cross-professional workflow support.
- Review-first workflow run state with no automatic actor or command execution.
- Structured handoff artifacts, evidence ledger, scorecards, workflow events,
  approval gates, and stop-policy blocking.
- Durable project workflow run sidecar helpers under
  `.project-manager/project-workflow-runs/`.
- Local chat `/workflow <featureId>` decision package entry.
