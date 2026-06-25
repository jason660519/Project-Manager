# F70 - Agent Runtime Redacted Session Content Reader

## Summary

Read bounded approved session content natively after the F69 reader boundary,
but return only redacted structural metadata to the renderer.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a Tauri command for bounded redacted session content inspection.
- Reuse the F69 approval/root/max-byte boundary before reading.
- Return structural metadata: byte length, line counts, JSON object/array shape,
  and redaction flags.
- Never return raw transcript content, snippets, target filenames, parsed
  messages, prompts, tool calls, or secrets.
- Add focused tests before implementation and record verification evidence.

## Completion Evidence

- Focused F70 TS tests: 2 passed, 0 failed.
- Focused F70 Rust tests: 3 passed, 0 failed.
- F64-F70 TS regression tests: 29 passed, 0 failed.
- Agent Runtime Rust regression tests: 10 passed, 0 failed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: existing session import copy rendered with console/page errors 0.
- Baseline: `npm run verify:baseline` passed.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Session table import, cost calculation, message parsing, semantic extraction,
  model/API calls, or renderer access to raw transcript text.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
