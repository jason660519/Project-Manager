# F69 - Agent Runtime Session Reader Boundary

## Summary

Add the first Rust-side session reader boundary for Agent Runtime. The boundary
validates an approved reader request, confirms a target is inside an allowlisted
session root, enforces a max-byte guard, and returns redacted metadata only.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a Tauri command for session reader boundary validation.
- Add a typed bridge wrapper and capability permission entry.
- Return metadata-only results: allowed root, byte length, max bytes, and
  redaction flags.
- Never return transcript contents, snippets, target filenames, raw secrets, or
  parsed messages.
- Add focused tests before implementation and record verification evidence.

## Completion Evidence

- Focused F69 TS tests: 2 passed, 0 failed.
- Focused F69 Rust tests: 4 passed, 0 failed.
- F64-F69 TS regression tests: 27 passed, 0 failed.
- Agent Runtime Rust regression tests: 7 passed, 0 failed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: existing session import copy rendered with console/page errors 0.
- Baseline: `npm run verify:baseline` passed.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Transcript parsing, session table import, cost calculation, listing directory
  contents, returning target filenames, returning file contents, or using the
  Anthropic/OpenAI APIs.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
