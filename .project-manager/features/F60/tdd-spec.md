# F60 TDD Spec: Agent Runtime Inventory Sheet

## Strategy

Start with mapper and registry tests before touching UI wiring. Then add the
minimum Integrations Hub wiring to make those contracts real.

## Test Layers

| Layer | File / Command | Purpose |
| --- | --- | --- |
| Unit TS | `.project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts` | Mapper, diagnostic summary, and sheet registry contract. |
| Static audit | `npm run table:sheet:audit -- --check` | Confirms table/sheet gate remains clean. |
| Typecheck | `npm run typecheck` | Confirms route/sheet union and UI wiring compile. |
| Manual UI smoke | `/integrations-hub/agent-runtime` | Confirm tab renders, no overlay errors, search/filter/rescan controls visible. |
| Full baseline | `npm run verify:baseline` | Repo-wide completion gate. |

## TDD Cycles

### Cycle 1: Mapper

**Given** an `AgentRuntimeToolRow` with Codex command, config evidence, warnings,
and capability flags.  
**When** it is mapped to an `IntegrationRow`.  
**Then** row key, sheet, source kind, status, badges, install path, and payload are
stable and contain metadata only.

Expected Red: mapper module does not exist.

### Cycle 2: Status Mapping

**Given** ready, partial, missing, and unsupported runtime statuses.  
**When** rows are mapped.  
**Then** statuses become installed, warning, not_installed, and unavailable.

Expected Red: status mapping does not exist.

### Cycle 3: Sheet Registry

**Given** the Integrations Hub sheet list.  
**When** tests inspect sheet constants and labels.  
**Then** `agent-runtime` is route-valid and scan-action-valid.

Expected Red: sheet constants do not include `agent-runtime`.

### Cycle 4: Secret Boundary

**Given** source row payload includes warning/path metadata and a fixture fake
secret string is nearby in test data.  
**When** mapped rows are serialized.  
**Then** fake secret values are absent.

Expected Red: mapper may over-copy payloads or have no sanitizer.

## Quantified Acceptance

| Command | Pass Criteria |
| --- | --- |
| `npm test -- --run .project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts` | All F60 focused tests pass. |
| `npm run table:sheet:audit -- --check` | exits 0. |
| `npm run typecheck` | exits 0. |
| `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` | exits 0 after dev server smoke. |
| `npm run verify:baseline` | exits 0 before marking done. |

## Test Asset Location

```text
.project-manager/features/F60/tests/
```
