# F59 Test Scenarios

## Scenario 1: Normal

**Given** Codex command and config evidence exist in an injected snapshot.  
**When** `loadAgentRuntimeInventory()` runs.  
**Then** the result includes `agent-runtime:codex`, Codex is not `missing`, the
loader receives `projectRoot`, and diagnostics are empty.

Acceptance:

- `diagnostics.length === 0`
- `loadedAt === '2026-06-23T00:00:00.000Z'` with injected clock.
- Codex row is present and `commandAvailable === true`.

## Scenario 2: Boundary

**Given** the snapshot loader returns `{ existingPaths: [], availableCommands: [] }`.  
**When** the service loads inventory.  
**Then** default rows are returned deterministically and no service diagnostic is
added.

Acceptance:

- Row IDs are stable across two calls.
- At least Codex, Claude Code, Gemini CLI, OpenCode, OpenClaw, and Hermes rows
  exist.
- Diagnostics are empty.

## Scenario 3: Abnormal

**Given** the snapshot loader rejects with `Permission denied`.  
**When** the service loads inventory.  
**Then** the service does not throw and returns an error diagnostic.

Acceptance:

- `diagnostics[0].code === 'snapshot_load_failed'`
- `diagnostics[0].severity === 'error'`
- Returned inventory still has default rows.

## Scenario 4: Permission / Security

**Given** a fixture snapshot contains `fileContents` with fake API keys.  
**When** the service returns and the result is serialized.  
**Then** fake secret values are not present.

Acceptance:

- Serialized result does not include `sk-fake-secret`.
- Serialized result does not include `GEMINI_FAKE_SECRET`.
- Secret-bearing file paths may appear as metadata, but contents must not.
