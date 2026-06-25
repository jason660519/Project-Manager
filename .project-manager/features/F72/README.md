# F72 - Agent Runtime Redacted Session Envelope Detail Summary

## Summary

Render F71 aggregate-only session envelope metadata in the Agent Runtime Session
detail group. The slice makes parsed message/tool-call counts visible as safe
copy while keeping transcript content, filenames, prompts, tool arguments, and
secrets out of renderer-visible artifacts.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a pure TypeScript summary helper for redacted session envelope results.
- Wire optional aggregate envelope metadata into the Agent Runtime detail model.
- Preserve existing preview, dry-run, and approval-boundary Session detail copy.
- Add focused tests before implementation and record Red/Green evidence.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Reading session files from the renderer.
- Triggering the F71 native parser from UI.
- Rendering transcript content, filenames, prompt text, tool arguments, or raw
  secrets.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Focused F72 tests: 5 passed, 0 failed.
- F64-F72 Agent Runtime regression tests: 36 passed, 0 failed.
- Typecheck and docs check: passed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: Codex CLI detail rendered existing Session import copy with console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 248 files, 1574 tests passed, 1 skipped; cargo check and build passed.
