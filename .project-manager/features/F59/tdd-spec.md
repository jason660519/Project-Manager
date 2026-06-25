# F59 TDD Spec: Agent Runtime Inventory Service

## Strategy

Use focused unit tests in the feature folder. The service is pure TypeScript
except for its default bridge loader, so tests inject snapshot loaders instead
of touching Tauri or filesystem APIs.

## Test Layers

| Layer | File | Purpose |
| --- | --- | --- |
| Unit TS | `.project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts` | Service composition, diagnostics, determinism, and secret boundary. |
| Integration compile | `npm run typecheck` | Confirms exports and bridge imports typecheck in app graph. |
| Full baseline | `npm run verify:baseline` | Confirms repo-wide tests, docs, cargo, and static build. |
| E2E | Not applicable | No UI or route change in F59. |

## TDD Cycles

### Cycle 1: Normal Composition

**Given** an injected snapshot loader that returns Codex command/path evidence.  
**When** `loadAgentRuntimeInventory()` runs with fixed `homeDir`,
`projectRoot`, and `now`.  
**Then** it passes `projectRoot` to the loader, scans rows, returns an ISO
`loadedAt`, and emits no diagnostics.

Expected Red: `loadAgentRuntimeInventory` does not exist.

### Cycle 2: Empty Snapshot Boundary

**Given** an injected snapshot loader returns no paths and no commands.  
**When** the service loads inventory.  
**Then** all default tool rows are deterministic and missing/partial logic comes
from the scanner, not the service.

Expected Red: service does not preserve scanner inventory.

### Cycle 3: Loader Failure

**Given** an injected snapshot loader rejects with `Permission denied`.  
**When** the service loads inventory.  
**Then** it does not throw; it returns empty-snapshot inventory and one
`snapshot_load_failed` diagnostic with `severity: 'error'`.

Expected Red: service either throws or has no diagnostic contract.

### Cycle 4: Secret Boundary

**Given** a fixture snapshot includes `fileContents` with fake API keys.  
**When** the service result is serialized.  
**Then** secret values are absent from the result.

Expected Red: service returns the raw snapshot including fixture-only
`fileContents`.

## Quantified Acceptance

| Command | Pass Criteria |
| --- | --- |
| `npm test -- --run .project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts` | 4 tests passed, 0 failed. |
| `npm run typecheck` | exits 0. |
| `npm run verify:baseline` | exits 0 before marking done. |

## Test Asset Location

All F59 tests live under:

```text
.project-manager/features/F59/tests/
```

This keeps the test evidence colocated with the feature handoff documents.
