# F77 - Agent Runtime Native Redacted Session Target Lister

## Summary

Add a native metadata-only session target lister for Agent Runtime roots. The
lister returns internal target paths for follow-up parsing while display labels
and summaries remain redacted.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23

## Scope

- Add a Rust Tauri command to list approved session target candidates.
- Add a typed bridge wrapper and non-Tauri fallback.
- Add Tauri permission and default capability entry.
- Return redacted candidate labels and aggregate metadata only.
- Add focused tests for bridge/capability wiring and native behavior.

## Non-Goals

- Transcript reading or parsing.
- Filename display in UI.
- Recursive large indexer.
- Persistence.
- UI selector wiring beyond existing F76 consumption shape.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Red: TS focused test failed because wrapper/permission were missing; Rust focused test failed because request/helper were missing.
- Green: focused F77 TS tests passed, 2 passed / 0 failed; focused Rust tests passed, 2 passed / 0 failed.
- Regression: F64-F77 Agent Runtime tests passed, 47 passed / 0 failed.
- Static checks: `npm run typecheck`, `npm run docs:check`, and `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- UI route health: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed with Next dev Issues 0.
- Browser smoke: Playwright Chromium opened Agent Runtime parser panel with console/page errors 0 and sensitive fixture strings absent.
- Baseline: `npm run verify:baseline` passed; Vitest 253 files, 1596 passed, 1 skipped; cargo check passed; build passed.
