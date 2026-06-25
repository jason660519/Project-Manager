# F59: Agent Runtime Inventory Service

## Problem Definition

F57 introduced a pure inventory scanner and F58 introduced a native metadata
snapshot command. The next layer needs a small service boundary that combines
both pieces without letting future UI modules know how snapshots are built or
how scanner errors are handled.

Without this service, future Agent Runtime / MCP / Skills / Session / Cost
surfaces would either duplicate bridge calls or accidentally couple UI code to
filesystem evidence rules.

## User Value

| User | Value |
| --- | --- |
| PM operator | Future readiness UI can load real local agent evidence through one stable operation. |
| Engineer | Can consume `loadAgentRuntimeInventory()` with a fixture loader in tests and bridge loader in app code. |
| Security reviewer | Can inspect one renderer-safe service and confirm it remains read-only and secret-free. |
| Future UI maintainer | Gets diagnostics for error and partial states instead of catching bridge exceptions in React. |

## In Scope

1. `lib/agent-runtime/inventoryService.ts`
   - Define `AgentRuntimeInventoryServiceOptions`.
   - Define `AgentRuntimeInventoryDiagnostic`.
   - Define `AgentRuntimeInventoryServiceResult`.
   - Implement `loadAgentRuntimeInventory(options)`.
2. `lib/agent-runtime/index.ts`
   - Export service function and service result types.
3. `.project-manager/features/F59/tests/agentRuntimeInventoryService.test.ts`
   - Cover normal, boundary, abnormal, and permission/security-like scenarios.
4. Dashboard F59 metadata, dev-log, and verification evidence.

## Out of Scope

- UI and table work.
- New Tauri command.
- Direct `fs` usage in TypeScript.
- Reading provider secrets, auth files, env files, OAuth caches, or session
  contents.
- Writing or syncing external agent configs.
- SchemaVersion changes.

## Dependencies and Constraints

- Depends on F57 `scanAgentEnvironment()`.
- Depends on F58 `buildAgentRuntimeSnapshot()` only through a default loader.
- **ADR-004:** secrets must not enter renderer; the service only passes snapshot
  paths and command names through the scanner.
- **Static export discipline:** no Node `fs` in client-reachable graph.
- **Bridge discipline:** service may import the typed bridge wrapper, but must
  not call raw `invoke()`.
- Local-first: no Supabase, Edge Function, or cloud gateway dependency.

## Design

### Data Flow

```text
loadAgentRuntimeInventory(options)
  -> snapshotLoader(projectRoot) or buildAgentRuntimeSnapshot(projectRoot)
  -> scanAgentEnvironment(snapshot, { homeDir, projectRoot, specs? })
  -> AgentRuntimeInventoryServiceResult
```

### Result Contract

The service returns one object:

```ts
interface AgentRuntimeInventoryServiceResult {
  inventory: AgentRuntimeInventory;
  snapshot: AgentRuntimeFilesystemSnapshot;
  diagnostics: AgentRuntimeInventoryDiagnostic[];
  loadedAt: string;
}
```

Diagnostics are non-throwing operational messages. A snapshot loader failure
produces a diagnostic with `severity: 'error'` and code
`snapshot_load_failed`, then scans an empty snapshot so consumers still receive
deterministic rows.

### Service Options

```ts
interface AgentRuntimeInventoryServiceOptions {
  homeDir: string;
  projectRoot: string;
  specs?: AgentRuntimeToolSpec[];
  snapshotLoader?: (projectRoot?: string) => Promise<AgentRuntimeFilesystemSnapshot>;
  now?: () => Date;
}
```

`snapshotLoader` and `now` exist for deterministic tests. Production callers can
omit both.

## Success Metrics

1. F59 appears in Development sheet with artifacts and planned tests populated.
2. Feature spec, TDD spec, scenarios, tests, and dev-log exist under
   `.project-manager/features/F59/`.
3. Normal scenario returns ready/partial/missing scanner rows from injected
   snapshot evidence.
4. Boundary scenario handles empty snapshot deterministically.
5. Abnormal scenario converts loader rejection to diagnostics and still returns
   rows.
6. Permission/security-like scenario proves file content in fixture snapshots is
   not emitted by the service result.
7. Focused tests, typecheck, and `npm run verify:baseline` pass before completion.

## Acceptance Criteria

1. `loadAgentRuntimeInventory()` is exported from `lib/agent-runtime`.
2. Default loader uses `buildAgentRuntimeSnapshot()` and no raw Tauri invoke.
3. Tests prove injectable loader receives the project root.
4. Tests prove `loadedAt` is deterministic when `now` is injected.
5. Tests prove rejected loaders do not throw to callers.
6. Tests prove secret-looking fixture contents do not appear in serialized
   service output.
