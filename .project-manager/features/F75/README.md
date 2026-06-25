# F75 - Agent Runtime Session Envelope UI Execute Flow

## Summary

Wire the F74 redacted session envelope executor into the Agent Runtime detail UI
with an explicit target path, approval checkbox, and safe result summary.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23

## Scope

- Add a guarded UI flow inside the existing Agent Runtime Evidence panel.
- Require an explicit metadata-only approval before execution.
- Require one session target path before execution.
- Call a parent-provided parser executor callback, not `invoke()` from the detail
  component.
- Display only F74 redacted execution summaries and blocked reasons.
- Keep parser errors and result display free of transcript content, tool args,
  secret-like strings, and parser error details.

## Non-Goals

- Session file discovery or picker.
- Transcript display.
- Persisting target paths or parsed metadata.
- Expanding the native Tauri command surface.
- Changing Integration Hub sheet/tab/table contracts.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Red: focused F75 test failed because the UI parse helper and parser region did not exist.
- Green: focused F75 tests passed, 4 passed / 0 failed.
- Regression: F64-F75 Agent Runtime tests passed, 42 passed / 0 failed.
- Static checks: `npm run typecheck` and `npm run docs:check` passed.
- UI route health: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed with Next dev Issues 0.
- Browser smoke: Playwright Chromium found the redacted parser controls, verified the button remains disabled without an existing session root or target, found required copy, and reported console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 251 files, 1591 passed, 1 skipped; cargo check passed; build passed.
