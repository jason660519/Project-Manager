# F39 — User-Controlled Plugin Install, Catalog Mirror, and Startup

## Summary

Give users explicit control over optional project-scoped third-party runtimes (OpenClaw, Hermes Agent). Project Manager must not auto-install or auto-start these sidecars during `./start_project_manager.sh start`. User intent flows through the Integrations Hub plugin catalog (`enabled`, `autostart`), mirrored to `.project-manager/plugins.json` so shell scripts can read the same state.

## Current State

- Status: in_progress
- Progress: 85%
- Phase: development
- Category: Platform/DevOps
- Owner: Cursor
- Created: 2026-05-30

OpenClaw and Hermes are registered as disabled-by-default CLI plugins. `start_project_manager.sh core|all` now respects the mirrored plugin `enabled && autostart` state, explicit sidecar commands no longer silently auto-install, and the Integrations Hub writes a project-scoped mirror that shell scripts can read. Manual new-machine sidecar checks remain before marking done.

## Scope

1. **`start` is PM-only** — `cmd_start` / `cmd_start_background` / `cmd_auto` never touch OpenClaw or Hermes.
2. **Catalog mirror** — persist `{ enabled, autostart }` per plugin to `.project-manager/plugins.json` whenever the catalog changes in the app.
3. **Respect mirror in shell** — `core` / `all` only autostart plugins with `enabled && autostart`; explicit `openclaw` / `hermes` commands start only when installed (no auto-install).
4. **Integrations Hub UI** — autostart toggle on project-scoped sidecar plugins; lifecycle Install/Doctor/Start buttons already present via runtime metadata.
5. **Tests** — mirror serialization, autostart toggle, shell helper contract.

## Non-Goals

- MCP connector lifecycle (separate layer).
- Changing `.project-manager/config.json` schemaVersion.
- Shipping OpenClaw/Hermes source in git.
- Auto-install on any startup path.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
