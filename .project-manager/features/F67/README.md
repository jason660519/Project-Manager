# F67 - Agent Runtime Session Import Dry Run Contract

## Summary

Create the first metadata-only session import dry-run contract for Agent
Runtime. The dry run turns an existing Session Import Preview into a reviewable
plan without reading transcript files, listing filenames, or touching secrets.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a pure TypeScript dry-run planner under `lib/agent-runtime`.
- Reuse F64-F66 preview data as input.
- Expose root-level import plan items, aggregate artifact candidate counts, and
  blocked reasons.
- Surface dry-run copy in the Agent Runtime detail Session group.
- Add focused tests before implementation and record verification evidence.

## Completion Evidence

- Focused F67 tests: 6 passed, 0 failed.
- F64/F65/F66/F67 regression tests: 18 passed, 0 failed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: preview and dry-run copy rendered with console/page errors 0.
- Baseline: `npm run verify:baseline` passed.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Reading transcript files, parsing session contents, listing session filenames,
  writing imported sessions, cost calculation, or invoking Tauri / filesystem /
  network APIs.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
