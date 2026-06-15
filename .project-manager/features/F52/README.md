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

- Status: in_progress
- Progress: 5%
- Phase: development
- Category: PM Orchestration
- Created: 2026-06-15

## Scope

- `lib/project-workflows/projectWorkflowEngine.ts`
- `__tests__/projectWorkflowEngine.test.ts`
- `.project-manager/features/F52/`
- `.project-manager/config.json`

## Non-Goals

- No autonomous command execution in the first slice.
- No PR, commit, procurement order, authority submission, or vendor dispatch
  without explicit human approval.
- No UI route in the first slice; the first delivery is a tested core engine.
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
