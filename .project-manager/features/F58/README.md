# F58 - Agent Runtime Tauri Snapshot Builder

## Summary

Add the read-only Tauri/Rust snapshot builder that feeds F57's pure
`lib/agent-runtime` scanner. The command reports only path existence and command
availability for known agent tools; it never parses secret-bearing files and
never writes external agent configuration.

## Current State

- Status: done
- Progress: 100%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23
- Completed: 2026-06-23

## Scope

- Add `build_agent_runtime_snapshot` Tauri command.
- Add typed bridge wrapper `buildAgentRuntimeSnapshot()`.
- Add capability entry for the new command.
- Add feature-folder TS tests for browser fallback and exported bridge shape.
- Add Rust unit tests for snapshot helper behavior.

## Non-Goals

- No UI.
- No external config writes.
- No parsing API keys, OAuth caches, env files, or settings contents.
- No MCP sync, skills sync, session parsing, or cost extraction.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
- Test: `tests/agentRuntimeSnapshotBridge.test.ts`

## Verification

- `npm test -- --run .project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts` - 1 passed, 0 failed.
- `cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot` - 2 passed, 0 failed.
- `npm run typecheck` - passed.
- `npm run verify:baseline` - passed; Vitest 1517 passed / 1 skipped, Cargo check passed, static build passed.
- Manual UI smoke: not applicable; this feature has no UI or route changes.
