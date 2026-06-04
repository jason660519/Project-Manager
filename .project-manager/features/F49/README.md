# F49 - Development Dependency Graph Columns and Dispatch Guards

## Summary

Add dependency tracking to Project Dashboard > Development so users and AI schedulers can see which feature work must run first, which work is unblocked, and which rows are safe candidates for parallel dispatch. The first implementation should add upstream/downstream dependency data to the canonical feature model, surface it in the Development sheet, and prepare dispatch-time guard logic that prevents duplicate or unsafe scheduling.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Project Dashboard
- Owner: Codex
- Created: 2026-06-04

## Scope

- Add a stable dependency reference model to `Feature`.
- Persist editable upstream dependencies in project config.
- Derive downstream dependencies from the upstream graph instead of storing redundant reverse links.
- Add Development sheet columns for Upstream Dependencies and Downstream Dependencies.
- Include dependency tokens in search/sort where practical.
- Add focused graph and UI tests covering missing refs, cycles, self-dependencies, and dispatch-readiness guard behavior.
- Record verification evidence in `dev-log.md`.

## Non-Goals

- Full autonomous batch scheduler in the first slice.
- Automatic AI inference of dependencies during ingestion unless explicitly added later.
- Worktree creation, branch creation, or agent process isolation changes.
- Broad unrelated table refactors.
- Secret or credential storage.

## Key Design Direction

Only upstream dependencies should be persisted. Downstream dependencies are a derived reverse index. This keeps the graph single-source-of-truth and avoids drift where feature A says it depends on B but B's stored downstream list omits A.

Dependency refs should use human-readable feature IDs such as `F37`, with optional `projectId` for cross-project dashboards. The technical UUID table column remains row identity and should not be the dependency editing surface.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
