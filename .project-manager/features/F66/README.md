# F66 - Agent Runtime Count Aware Session Preview Copy

## Summary

Show count-aware metadata in Agent Runtime Session Import Preview copy. When
F65 provides `childCount`, the preview should say how many artifact candidates
exist without listing filenames or reading transcripts.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add count-aware summary copy to `buildAgentRuntimeSessionImportPreview`.
- Reuse the summary in Agent Runtime detail Session group details.
- Keep missing-count browser fallback copy stable.
- Add focused tests before implementation and record verification evidence.

## Completion Evidence

- Focused F66 tests: 5 passed, 0 failed.
- F64/F65/F66 regression tests: 12 passed, 0 failed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: count-aware Session import preview rendered with console/page errors 0.
- Baseline: `npm run verify:baseline` passed.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Listing session filenames, opening files, parsing transcripts, importer
  execution, or cost calculation.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
