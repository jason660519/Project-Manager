# F59 Dev Log

Append-only chronological log. Newest entry on top.

---

## 2026-06-23 - Kickoff and Spec

### 2.1 Work Tracking

- Created F59 on Development sheet with `npm run feature:kickoff`.
- Feature name: **Agent Runtime Inventory Service**.
- Goal: compose F58 native snapshot evidence with F57 scanner output through a
  stable TypeScript service.
- Risk estimate:
  - Medium: service must not leak fixture-only `fileContents` or future secret
    material.
  - Medium: default loader must use bridge wrapper only, not raw `invoke()`.
  - Low: no UI, no Rust, no external writes.

### 2.2 Spec / TDD Design

- Wrote feature spec, TDD spec, test scenarios, and this log before
  implementation.
- Test plan covers normal composition, empty snapshot boundary, loader failure,
  and secret-boundary behavior.

### Planned Commands

```bash
npm test -- --run .project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts
npm run typecheck
npm run verify:baseline
```

### 2.3 TDD Cycles

| Cycle | Test | Red reason | Green fix | Result |
| --- | --- | --- | --- | --- |
| 1 | `agentRuntimeInventoryService.test.ts` | `loadAgentRuntimeInventory` was not exported / implemented | Added `lib/agent-runtime/inventoryService.ts` and exported service API | Green |

### Commands Run

```bash
npm test -- --run .project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts
# Red: 4 failed, loadAgentRuntimeInventory is not a function

npm test -- --run .project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts
# Green: 4 passed, 0 failed

npm run typecheck
# Green
```

### Implementation Summary

| File | Purpose |
| --- | --- |
| `lib/agent-runtime/inventoryService.ts` | Adds `loadAgentRuntimeInventory()` service, injectable snapshot loader, diagnostics, snapshot sanitization, and deterministic clock hook. |
| `lib/agent-runtime/index.ts` | Exports the service function and service result types. |
| `.project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts` | Covers normal composition, empty snapshot boundary, loader failure diagnostics, and secret-boundary behavior. |

### Security Notes

- The service performs no filesystem reads and no raw Tauri `invoke()`.
- The default loader uses the typed `buildAgentRuntimeSnapshot()` bridge wrapper.
- Returned snapshots are sanitized to `existingPaths` and `availableCommands`; fixture-only `fileContents` is not emitted.

### Final Verification

```bash
npm run verify:baseline
# PASS
# Vitest: 1521 passed, 1 skipped
# Cargo check: passed
# Static build: passed
```

- Manual UI smoke: not applicable; no UI, routing, localStorage, or client-rendered view changed.
- Build warnings observed from existing `app/api/integrations/scan-applications/route.ts` Turbopack tracing behavior; baseline still passed and F59 did not touch that route.

### Coverage Summary

| Layer | Coverage | Result |
| --- | --- | --- |
| Unit TS | Injected snapshot loader receives `projectRoot` and scanner rows are returned. | Pass |
| Unit TS | Empty snapshot returns deterministic default agent rows. | Pass |
| Unit TS | Snapshot loader rejection becomes `snapshot_load_failed` diagnostic without throwing. | Pass |
| Unit TS | Fixture `fileContents` and fake secret values are absent from serialized result. | Pass |
| Integration compile | Service exports and bridge dependency typecheck in app graph. | Pass |

### Remaining Risks / Next Step

- Future UI must surface `diagnostics` visibly instead of hiding snapshot failures.
- Next slice can build the Agent Runtime Basic Table Sheet on top of `loadAgentRuntimeInventory()` without touching bridge or Rust details.
