# F65 - Agent Runtime Session Root Child Counts

## Summary

Add metadata-only child counts for Agent Runtime session roots. The scanner and
native snapshot will report how many first-level entries a session root contains
so import preview can show approximate artifact availability without reading
transcripts.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Extend `AgentRuntimeFilesystemSnapshot` with optional session root child counts.
- Attach `childCount` to `sessions-root` path observations.
- Show child counts in Session Import Preview root candidates.
- Add native metadata counting for first-level session root children only.
- Record Red / Green / Refactor and verification evidence in `dev-log.md`.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Reading session file contents, parsing transcript formats, recursive directory
  traversal, token/cost calculation, or importer execution.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
