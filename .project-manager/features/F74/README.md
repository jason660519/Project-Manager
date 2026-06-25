# F74 - Agent Runtime Session Envelope Parse Executor Boundary

## Summary

Execute F73 approved envelope parse actions through an injected parser function
and return redacted aggregate summaries only. The executor is the final pure
boundary before a future UI picker wires `readAgentRuntimeRedactedSessionEnvelope`.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a pure TypeScript executor helper for F73 parse actions.
- Ensure blocked / unapproved actions never call the parser.
- Ensure ready actions call the parser exactly once with the F73 request.
- Return F72 summary copy for parser results.
- Keep display output free of filenames, transcript text, tool arguments, and
  secret-like fixture strings.

## Non-Goals

- UI target picker.
- Direct Tauri invocation from React.
- Session directory scanning.
- Persisting parser output.
- Rendering transcript content.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Red: focused F74 test failed because the executor was not exported.
- Green: focused F74 tests passed, 6 passed / 0 failed.
- Regression: F64-F74 Agent Runtime tests passed, 38 passed / 0 failed.
- Static checks: `npm run typecheck` and `npm run docs:check` passed.
- UI route health: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed with Next dev Issues 0.
- Browser smoke: Playwright Chromium found 5 required Agent Runtime strings, 5 sensitive fixture strings absent, console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 250 files, 1587 passed, 1 skipped; cargo check passed; build passed.
