# F60 Test Scenarios

## Scenario 1: Normal

**Given** F59 returns Codex and Claude Code runtime rows.  
**When** the Agent Runtime sheet maps rows for Integrations Hub.  
**Then** the table receives deterministic `IntegrationRow` objects.

Acceptance:

- `rowKey === 'agent-runtime:codex'`
- `sheet === 'agent-runtime'`
- `sourceKind === 'agent-runtime'`
- Runtime capability badges are present.

## Scenario 2: Boundary

**Given** a missing runtime row has no command and no path evidence.  
**When** it is mapped.  
**Then** it remains visible as `not_installed`, not dropped.

Acceptance:

- Status is `not_installed`.
- Status label is `Missing`.
- Notes explain missing command/path evidence.

## Scenario 3: Abnormal

**Given** F59 returns a `snapshot_load_failed` diagnostic.  
**When** the sheet renders.  
**Then** a visible warning/error banner appears above the table and rows still render
from the empty snapshot fallback.

Acceptance:

- Diagnostic message is included in sheet state.
- Table is not replaced by a blank screen.

## Scenario 4: Permission / Security

**Given** path observations include secret-bearing files.  
**When** mapper serializes payloads.  
**Then** secret file paths may appear, but secret values never appear.

Acceptance:

- Serialized row may include `.codex/auth.json`.
- Serialized row must not include fake key values such as `sk-fake-secret`.
