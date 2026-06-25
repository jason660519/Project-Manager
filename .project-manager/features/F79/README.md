# F79 - Agent Runtime Session Target Diagnostics UI

## Summary

Surface F78 session target hydration diagnostics in Agent Runtime detail UI so
users understand why native redacted targets are unavailable.

## Current State

- Status: completed
- Progress: 100%
- Phase: done
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23

## Scope

- Keep `session_target_list_failed` diagnostics visible in the Agent Runtime
  detail sheet.
- Preserve row-level diagnostics without exposing target filenames, transcript
  content, or thrown secret strings.
- Add focused UI tests for diagnostic rendering and safe absence when no
  diagnostic exists.
- Keep the F76 selector behavior unchanged.

## Non-Goals

- New native commands.
- Reading session content.
- New table columns or sheet tabs.
- New persistence schema.
- Changing F78 hydration policy.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Passed: focused F79 UI tests, 3/3.
- Passed: F64-F79 regression tests, 65/65.
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Passed: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Passed: Playwright browser smoke for `/integrations-hub/agent-runtime`, console/page errors 0.
- Passed: `npm run verify:baseline`.
