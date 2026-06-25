# F71 - Agent Runtime Redacted Session Envelope Parser

## Summary

Parse bounded approved session content natively and return a redacted aggregate
session envelope only.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a Tauri command for redacted session envelope parsing.
- Reuse the F70 bounded redacted content reader before parsing.
- Return aggregate metadata: message count, role buckets, tool-call count, and
  redaction flags.
- Never return raw transcript text, snippets, filenames, prompts, tool
  arguments, message content, or secrets.
- Add focused tests before implementation and record verification evidence.

## Completion Evidence

- Focused F71 TS tests: 2 passed, 0 failed.
- Focused F71 Rust tests: 3 passed, 0 failed.
- F64-F71 TS regression tests: 31 passed, 0 failed.
- Agent Runtime Rust regression tests: 13 passed, 0 failed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: existing session import copy rendered with console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 247 files, 1569 tests passed, 1 skipped; cargo check and build passed.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Session table import, cost calculation, semantic extraction, renderer access
  to raw transcript text, or model/API calls.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
