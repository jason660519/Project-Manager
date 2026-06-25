# F76 - Agent Runtime Redacted Session Target Selector

## Summary

Add a redacted session target selector to the Agent Runtime envelope parser UI.
When safe target candidates are present in the row payload, users select a
redacted option instead of pasting a full path.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23

## Scope

- Add a pure mapper helper for optional `sessionTargets` payload metadata.
- Keep target paths internal to the parse action and out of option labels.
- Render a selector in the F75 parser panel when candidates exist.
- Preserve F75 manual path fallback when no candidates exist.
- Verify selecting a redacted option enables the same approved parse flow.

## Non-Goals

- Native filesystem discovery.
- Showing target filenames.
- Persisting target selections.
- Transcript display.
- New bridge commands or Tauri capabilities.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Red: focused F76 test failed because the target option helper and selector UI did not exist.
- Green: focused F76 tests passed, 3 passed / 0 failed.
- Regression: F64-F76 Agent Runtime tests passed, 45 passed / 0 failed.
- Static checks: `npm run typecheck` and `npm run docs:check` passed.
- UI route health: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed with Next dev Issues 0.
- Browser smoke: Playwright Chromium found the parser panel, confirmed live fallback input when no candidates exist, found required copy, and reported console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 252 files, 1594 passed, 1 skipped; cargo check passed; build passed.
