# F39 Test Scenarios

## Purpose

Map real user paths for optional third-party plugin lifecycle to automated and manual verification. Prioritize new-machine onboarding and explicit opt-in flows.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration | Manual | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F39-S01 | New dev runs `./start_project_manager.sh start` without OpenClaw/Hermes | Unexpected install / failure blocks PM | Shell smoke E1 | F39-M01 | Candidate | Kickoff |
| F39-S02 | New dev runs `./start_project_manager.sh openclaw` without Node or binary | Opaque auto-install failure | Shell smoke E3 | F39-M02 | Candidate | Terminal incident |
| F39-S03 | User opens Integrations Hub → OpenClaw → Install | Install never triggered from UI | Manual lifecycle button | Manual | Candidate | FR-4 |
| F39-S04 | User enables OpenClaw but leaves autostart off, runs `core` | Gateway starts anyway | Mirror + shell D2, E2 | Manual | Candidate | US-03 |
| F39-S05 | User enables + autostarts OpenClaw, runs `core` | Gateway not started when installed | Shell E4 | Manual | Candidate | US-03 |
| F39-S06 | User disables OpenClaw after autostart on | Stale mirror causes unwanted start | Unit A5 + toggle | Manual | Candidate | US-02 |
| F39-S07 | User on Windows path / different PM root | Hardcoded `/Volumes/...` breaks spawn | Unit C3 | Manual | Regression | Code audit |
| F39-S08 | User enables OpenClaw for dispatch only | Adapter missing from dispatch | `adapterRegistry.plugin.test.ts` | Manual | Regression | Existing |
| F39-S09 | Browser dev toggles plugin without Tauri | Mirror not written; shell stale | Unit R3 | Manual | Candidate | Mirror gap |
| F39-S10 | Explicit `hermes` command, binary missing | Auto-install runs | Shell E3 variant | Manual | Candidate | FR-1 |

## User Personas

| Persona | Goal | Critical scenarios |
| --- | --- | --- |
| **Minimal PM user** | Dashboard + dispatch only | S01, S04 |
| **Full-stack local dev** | PM + OpenClaw + Hermes dashboards | S03, S05 |
| **Explicit sidecar user** | Run `openclaw` command ad hoc | S02, S10 |

## Test Data Rules

- Do not commit real API keys or `.env` contents into tests or artifacts.
- Mirror fixtures use synthetic plugin ids and ISO timestamps.
- Shell tests may write to temp dirs under `/tmp/pm-f39-*`; clean up after run.
- No fake "installed" state — binary detection uses real path probes in manual tests.

## Unit Test Backlog

- `buildPluginCatalogMirror` includes all catalog plugins with correct flags.
- `parsePluginCatalogMirror` rejects malformed JSON gracefully.
- `togglePluginAutostart` idempotent for missing ids.
- `PROJECT_SCOPED_AUTOSTART_PLUGIN_IDS` contains exactly `openclaw` and `hermes-agent`.
- `resolveProjectManagerRepoRoot` returns sample config root when no override.

## Conversion Rule

When a new startup or Integrations Hub bug is reported, append a row before fixing and link the regression test or manual check.
