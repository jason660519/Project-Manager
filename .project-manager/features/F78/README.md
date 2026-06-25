# F78 - Agent Runtime Session Target Hydration

## Summary

Hydrate Agent Runtime integration rows with F77 native redacted session target
candidates so the F76 selector can use real metadata.

## Current State

- Status: completed
- Progress: 100%
- Phase: done
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23

## Scope

- Add an async helper that calls the F77 target lister for runtime rows with
  existing session roots.
- Store returned targets at `payload.agentRuntime.sessionTargets`.
- Preserve rows when listing is blocked or throws.
- Add diagnostics for lister failures.
- Wire Integration Hub `loadAgentRuntime` to use the helper.

## Non-Goals

- New native commands.
- Reading transcripts.
- Displaying filenames.
- Persisting target candidates.
- Changing table/sheet layout.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Passed: focused F78 tests, 4/4.
- Passed: F64-F78 regression tests, 62/62.
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Passed: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Passed: Playwright browser smoke for `/integrations-hub/agent-runtime`, console/page errors 0.
- Passed: `npm run verify:baseline`.
