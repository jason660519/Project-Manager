# F60: Agent Runtime Inventory Sheet

## Problem Definition

F57-F59 created a safe local agent inventory stack, but the user still cannot
inspect those results in Project Manager. The next useful slice is a read-only
Integrations Hub sheet that surfaces runtime readiness, MCP/Skills/Session/Cost
capabilities, path evidence, and diagnostics using the existing table shell.

## User Value

| User | Value |
| --- | --- |
| PM operator | Can see which local agent runtimes are ready before dispatching or planning work. |
| Engineer | Can verify F57-F59 output in the app without writing one-off debug screens. |
| Security reviewer | Can confirm UI exposes metadata and diagnostics only, not secrets. |
| Future Session/Cost maintainer | Gets a stable navigation place for later read-only session and usage previews. |

## In Scope

1. `lib/integrations/types.ts`
   - Add `agent-runtime` as an `IntegrationSheet`.
   - Add `agent-runtime` as an `IntegrationSourceKind`.
2. `lib/integrations/sheet-actions.ts`
   - Add sheet action label and scan/test registry entry type support.
3. `lib/integrations/mappers/agent-runtime.ts`
   - Convert `AgentRuntimeToolRow` + service metadata to `IntegrationRow`.
4. `app/ui/views/Plugins/PluginsHubView.tsx`
   - Add state/loading/error for Agent Runtime inventory.
   - Load on active `agent-runtime` sheet.
   - Add bottom tab, active rows, rescan/test actions, diagnostics banner.
   - Reuse existing `IntegrationsTable`.
5. `.project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts`
   - Cover mapper output, diagnostics summary, and sheet registry contract.

## Out of Scope

- No UI for editing runtime config.
- No external MCP/Skills sync.
- No session or cost file parsing.
- No provider secret display.
- No new Tauri command or capability.
- No schemaVersion change.

## Table Compliance

Classification: **Basic Table Sheet**, implemented through the existing
`IntegrationsTable` surface.

| Control | F60 status |
| --- | --- |
| Table-scoped search | Implemented by Integrations Hub toolbar. |
| First data column `col-id` UUID | Implemented by `IntegrationsTable` UUID column. |
| Category filters | Implemented by `categoryFilter` over active rows. |
| Numeric `Freeze cols` | Implemented by existing toolbar control. |
| Column resize + persistence | Implemented by existing `IntegrationsTable` behavior / shared waiver. |
| Hidden columns | Implemented by existing table visibility controls. |
| Sort arrows | Implemented by existing TanStack sorting and markers. |
| Reset / density controls | Existing density control; reset follows shared table behavior. |
| Empty / filtered-empty | Implemented by existing table empty/error states. |
| Reorderable bottom sheets | Implemented by existing `BottomSheetTabs` reorderable setting. |

## Dependencies and Constraints

- Depends on F59 `loadAgentRuntimeInventory()`.
- Must not call raw Tauri `invoke()`.
- Must not read filesystem content in React.
- Diagnostics must be visible; scan failures must not silently disappear.
- Integrations Hub route generation must include `/integrations-hub/agent-runtime`.

## Success Metrics

1. F60 appears in Development sheet with spec/TDD/test/dev-log artifacts.
2. `/integrations-hub/agent-runtime` is a valid static route.
3. Agent Runtime tab appears in Integrations Hub bottom tabs.
4. Agent Runtime rows show status, runtime name, method, evidence paths, warnings,
   and capability badges.
5. Diagnostics are visible in the sheet banner.
6. Focused tests, table audit, typecheck, manual UI smoke, and
   `npm run verify:baseline` pass before completion.

## Acceptance Criteria

1. Mapper creates deterministic `IntegrationRow` keys such as
   `agent-runtime:codex`.
2. Ready runtime rows map to `installed`; partial rows map to `warning`;
   missing rows map to `not_installed`; unsupported rows map to `unavailable`.
3. Secret-bearing paths may appear as path metadata, but fixture secret contents
   do not appear in mapped rows.
4. Sheet action registry contains `agent-runtime`.
5. Opening the Agent Runtime route renders through existing Integrations Hub
   route validation.
