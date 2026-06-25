# F59 - Agent Runtime Inventory Service

## Summary

Compose F58's read-only Tauri snapshot builder with F57's pure scanner through a
renderer-safe service contract. Future Agent Runtime, MCP, Skills, Session, and
Cost surfaces can call this service instead of reaching directly into bridge or
filesystem details.

## Current State

- Status: done
- Progress: 100%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23
- Completed: 2026-06-23

## Scope

- Add `lib/agent-runtime/inventoryService.ts`.
- Export service types and `loadAgentRuntimeInventory()` from `lib/agent-runtime`.
- Accept an injectable snapshot loader for tests and future non-Tauri callers.
- Default to the F58 bridge wrapper when no loader is supplied.
- Convert snapshot loading failures into diagnostics instead of throwing.
- Keep the service read-only and free of direct filesystem access.

## Non-Goals

- No UI table or route.
- No external agent config writes.
- No session log parsing.
- No cost extraction.
- No MCP or skills sync.
- No provider key handling.
- No schemaVersion change.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
- Test: `tests/agentRuntimeInventoryService.test.ts`

## Verification

- `npm test -- --run .project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts` - 4 passed, 0 failed.
- `npm run typecheck` - passed.
- `npm run verify:baseline` - passed; Vitest 1521 passed / 1 skipped, Cargo check passed, static build passed.
- Manual UI smoke: not applicable; this feature has no UI or route changes.
