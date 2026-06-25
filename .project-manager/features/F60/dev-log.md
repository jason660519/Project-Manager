# F60 Dev Log

Append-only chronological log. Newest entry on top.

---

## 2026-06-23 - Kickoff and Spec

### 2.1 Work Tracking

- Created F60 on Development sheet with `npm run feature:kickoff`.
- Feature name: **Agent Runtime Inventory Sheet**.
- Goal: add a read-only Integrations Hub sheet over F59 inventory service.
- Risk estimate:
  - Medium: table/sheet wiring must preserve existing Basic Table Sheet compliance.
  - Medium: diagnostics must be visible, not silently swallowed.
  - Medium: mapper must not copy secret-bearing fixture contents.
  - Low: no external config writes and no new Tauri command.

### 2.2 Spec / TDD Design

- Wrote feature spec, TDD spec, test scenarios, and this log before implementation.
- Table classification: Basic Table Sheet via existing `IntegrationsTable`.
- Test plan covers mapper, status mapping, sheet registry, secret boundary,
  typecheck, table audit, manual UI smoke, and baseline.

### Planned Commands

```bash
npm test -- --run .project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts
npm run table:sheet:audit -- --check
npm run typecheck
npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime
npm run verify:baseline
```

### 2.3 TDD Cycles

| Cycle | Test | Red reason | Green fix | Result |
| --- | --- | --- | --- | --- |
| 1 | `agentRuntimeIntegrationSheet.test.ts` | `lib/integrations/mappers/agent-runtime` did not exist | Added mapper, sheet type, source kind, and sheet action label | Green |
| 2 | `agentRuntimeIntegrationSheet.test.ts` | `agent-runtime` was not route/action-valid | Added sheet id to `INTEGRATION_SHEETS` and `INTEGRATION_INVENTORY_SHEETS` | Green |

### Commands Run

```bash
npm test -- --run .project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts
# Red: mapper import failed

npm test -- --run .project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts
# Green: 4 passed, 0 failed

npm run typecheck
# Green

npm run table:sheet:audit -- --check
# Green: Surfaces=36 Basic=9 Blocking=0 Warnings=0
```

### Implementation Summary

| File | Purpose |
| --- | --- |
| `lib/integrations/types.ts` | Adds `agent-runtime` sheet and source kind. |
| `lib/integrations/sheet-actions.ts` | Adds Agent Runtime scan/test registry label. |
| `lib/integrations/mappers/agent-runtime.ts` | Maps F59 service results to read-only `IntegrationRow` values. |
| `app/ui/views/Plugins/PluginsHubView.tsx` | Adds Agent Runtime tab, load/rescan/test actions, active rows, loading/error state, and diagnostics banner. |
| `.project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts` | Covers mapper, status mapping, sheet registry, and secret-boundary behavior. |

### Security Notes

- The sheet uses F59 `loadAgentRuntimeInventory()` and never calls raw Tauri `invoke()`.
- The UI does not write external agent configs.
- Mapper payload includes path metadata and warnings only; fixture `fileContents` is not copied.

### Final Verification

```bash
npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime
# PASS: Next dev Issues 0

node Playwright Chromium smoke for /integrations-hub/agent-runtime
# PASS: Agent Runtime content present, read-only/diagnostic banner present, console/page errors 0

npm run verify:baseline
# PASS
# Vitest: 1525 passed, 1 skipped
# Cargo check: passed
# Static build: passed
```

- Build output confirms `/integrations-hub/agent-runtime` is included in static params.
- Build warnings observed from existing `app/api/integrations/scan-applications/route.ts` Turbopack tracing behavior; baseline still passed and F60 did not touch that route.

### Coverage Summary

| Layer | Coverage | Result |
| --- | --- | --- |
| Unit TS | Mapper converts `AgentRuntimeToolRow` to deterministic `IntegrationRow`. | Pass |
| Unit TS | Runtime statuses map to `installed`, `warning`, `not_installed`, and `unavailable`. | Pass |
| Unit TS | Sheet constants include `agent-runtime` for route and scan action validity. | Pass |
| Unit TS | Serialized mapped rows omit fixture `fileContents` and fake secret values. | Pass |
| Static audit | Existing Basic Table Sheet surface remains clean. | Pass |
| UI smoke | `/integrations-hub/agent-runtime` renders with Next Issues 0 and no Playwright console/page errors. | Pass |

### Remaining Risks / Next Step

- Home directory inference is best-effort from repo/project root; future native snapshot metadata could include a non-secret `homeDir` field to remove this guess.
- Next slice can add row-detail affordances for runtime evidence, MCP previews, session roots, and cost readiness without writing external configs.
