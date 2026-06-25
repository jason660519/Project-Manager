# F60 - Agent Runtime Inventory Sheet

## Summary

Add a read-only Agent Runtime sheet to Integrations Hub. The sheet uses F59's
`loadAgentRuntimeInventory()` service and the existing Basic Table Sheet
controls to show local agent runtime readiness without exposing secrets or
writing external agent configuration.

## Current State

- Status: done
- Progress: 100%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23
- Completed: 2026-06-23

## Scope

- Add `agent-runtime` to Integrations Hub sheet routing, tabs, and scan actions.
- Map `AgentRuntimeInventory` rows to existing `IntegrationRow` table rows.
- Load the Agent Runtime sheet from F59 service when the tab is active.
- Show diagnostics as a visible read-only banner.
- Reuse existing `IntegrationsTable` Basic Table Sheet behavior.

## Non-Goals

- No external agent config writes.
- No key, env, auth, OAuth, session, or log content parsing.
- No new Tauri command.
- No new top-level navigation item.
- No session/cost extraction yet.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
- Test: `tests/agentRuntimeIntegrationSheet.test.ts`

## Verification

- `npm test -- --run .project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts` - 4 passed, 0 failed.
- `npm run table:sheet:audit -- --check` - Surfaces=36 Basic=9 Blocking=0 Warnings=0.
- `npm run typecheck` - passed.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` - passed, Next dev Issues 0.
- Playwright Chromium smoke for `/integrations-hub/agent-runtime` - passed, console/page errors 0.
- `npm run verify:baseline` - passed; Vitest 1525 passed / 1 skipped, Cargo check passed, static build passed.
