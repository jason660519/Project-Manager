# F39 TDD Specification

## Suite A: Plugin catalog mirror (unit)

| Case | Input | Expected |
| --- | --- | --- |
| A1 | Default catalog with OpenClaw/Hermes disabled | Mirror has both `enabled: false`, `autostart: false` |
| A2 | OpenClaw enabled + autostart true | Mirror reflects both flags |
| A3 | Parse valid mirror JSON | Returns typed `PluginCatalogMirror` |
| A4 | Parse invalid / missing mirror | Returns null; shell treats as no autostart |
| A5 | `buildPluginCatalogMirror` after toggle | `updatedAt` changes; only affected plugin entry updates |

## Suite B: Plugin autostart toggle (unit)

| Case | Action | Expected |
| --- | --- | --- |
| B1 | `togglePluginAutostart(catalog, 'openclaw')` on plugin with `autostart: false` | Becomes `true`; other plugins unchanged |
| B2 | Toggle twice | Returns to `false` |
| B3 | Unknown plugin id | Catalog unchanged (no throw) |

## Suite C: Project-scoped CLI paths (unit)

| Case | Input | Expected |
| --- | --- | --- |
| C1 | `projectScopedBin('openclaw', '/tmp/pm')` | `/tmp/pm/.project-manager/bin/openclaw` |
| C2 | `projectScopedBin('hermes')` without root | `.project-manager/bin/hermes` (relative fallback) |
| C3 | DEFAULT_CLIS hermes/openclaw commands | No hardcoded `external SSD absolute path` path |

## Suite D: Shell plugin-state contract (integration / script)

| Case | Mirror file | Command | Expected exit / output |
| --- | --- | --- | --- |
| D1 | absent | `plugin-state.sh enabled openclaw` | exit 1 (false) |
| D2 | openclaw enabled false | `plugin-state.sh autostart openclaw` | exit 1 |
| D3 | openclaw enabled+autostart true | `plugin-state.sh autostart openclaw` | exit 0 |
| D4 | init script on empty dir | creates mirror with sidecar defaults off | file exists |

## Suite E: Startup script behavior (manual / smoke)

| Case | Preconditions | Command | Expected |
| --- | --- | --- | --- |
| E1 | No sidecar binaries | `./start_project_manager.sh start` | PM starts; no OpenClaw/Hermes messages |
| E2 | Default mirror | `./start_project_manager.sh core` | PM starts; sidecars skipped with info message |
| E3 | No openclaw binary | `./start_project_manager.sh openclaw` | Non-zero; install guidance; no auto-install |
| E4 | Mirror autostart on + installed | `./start_project_manager.sh core` | Attempts gateway start |

## Suite F: Integrations Hub UI (unit / manual)

| Case | User action | Expected |
| --- | --- | --- |
| F1 | Open OpenClaw detail sheet | Autostart toggle visible |
| F2 | Click autostart toggle | Catalog updates; mirror write scheduled |
| F3 | Binary missing | Guidance banner visible; Install lifecycle button present |
| F4 | Claude Code detail sheet | No autostart toggle (not project sidecar) |

## Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| R1 | Enabled OpenClaw still in adapter registry | `listAdapters` unchanged semantics |
| R2 | MCP autostart field | Unaffected (`McpPlugin.autoStart` separate) |
| R3 | `savePluginCatalog` without repo root | localStorage still works; mirror skipped silently |

## Required Verification

```bash
npm run typecheck
npm test -- __tests__/pluginCatalogMirror.test.ts
bash -n start_project_manager.sh scripts/plugin-state.sh
node scripts/init-plugin-catalog-mirror.mjs --dry-run  # if supported
npm run docs:check
```

Manual (record in dev-log):

- F39-M01: `./start_project_manager.sh start` on machine without sidecars
- F39-M02: `./start_project_manager.sh openclaw` without install → guidance only
