# F68 - Agent Runtime Session Import Approval Boundary

## Summary

Add an explicit approval boundary between F67 metadata-only dry runs and any
future transcript reader execution. F68 produces an approval-gated reader
request contract, but still does not read transcript files.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a pure TypeScript approval helper under `lib/agent-runtime`.
- Require a ready dry run and explicit user approval before producing a reader
  request.
- Keep blocked, unsupported, and unapproved states explicit.
- Surface approval-boundary copy in the Agent Runtime detail Session group.
- Add focused tests before implementation and record verification evidence.

## Completion Evidence

- Focused F68 tests: 7 passed, 0 failed.
- F64/F65/F66/F67/F68 regression tests: 25 passed, 0 failed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: preview, dry-run, and approval-boundary copy rendered with console/page errors 0.
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
