# F39: User-Controlled Plugin Install, Catalog Mirror, and Startup

## Purpose

On a fresh machine, `./start_project_manager.sh openclaw` currently attempts to auto-install OpenClaw and fails when Node is missing from PATH. Users who only want the Project Manager desktop app should not be forced through third-party runtime setup. This feature aligns dev startup behavior with the existing plugin product model: **installation availability ≠ user intent**.

## Background

| Layer | Current behavior | Target behavior |
| --- | --- | --- |
| Plugin catalog (`lib/storage/plugins.ts`) | OpenClaw/Hermes `enabled: false` by default | Unchanged; add optional `autostart: false` |
| Runtime adapters (`lib/adapters/registry.ts`) | Enabled plugins appear in dispatch | Unchanged |
| `start_project_manager.sh` | `core`/`all` always start OpenClaw+Hermes; missing binary triggers auto-install | Only autostart when mirror says `enabled && autostart`; never auto-install |
| Plugin persistence | localStorage only (`projectManager.shared.plugins`) | Mirror to `.project-manager/plugins.json` for shell |
| Integrations Hub detail sheet | Runtime lifecycle commands exist | Add autostart toggle; surface not-installed guidance |

Triggering incident (2026-05-30, new dev machine):

```text
node: command not found  (sync-openclaw-env.sh)
OpenClaw Gateway did not report a listening port
```

Root cause: user ran `./start_project_manager.sh openclaw` without Node installed and without opting in to OpenClaw.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a new developer, I want `./start_project_manager.sh start` to launch only Project Manager so I can begin work without installing OpenClaw or Hermes. |
| US-02 | As a power user, I want to opt in to OpenClaw/Hermes from Integrations Hub so installation and startup reflect my choices. |
| US-03 | As a user who enabled OpenClaw, I want `core`/`all` to autostart its gateway only when I also turn on autostart — not merely because I enabled dispatch. |
| US-04 | As a user running `./start_project_manager.sh openclaw` explicitly, I want a clear message when the binary is missing instead of a silent auto-install attempt. |
| US-05 | As a maintainer, I want shell scripts to read the same plugin state as the UI via a file mirror. |
| US-06 | As a user on Integrations Hub, I want Install / Doctor / Start gateway actions on the OpenClaw/Hermes detail sheet without memorizing npm scripts. |

## Functional Requirements

### FR-1 Startup script behavior

| Command | OpenClaw / Hermes behavior |
| --- | --- |
| `start`, `web`, `auto` | Never start or install sidecars |
| `core`, `all` | Start sidecar only if mirror entry has `enabled: true` AND `autostart: true` |
| `openclaw`, `hermes` | Start if installed; if missing, print install instructions and exit non-zero; **no auto-install** |
| Missing mirror file | Treat all sidecars as disabled / no autostart; write default mirror via init script |

### FR-2 Plugin catalog mirror

- Path: `.project-manager/plugins.json` (gitignored runtime state).
- Schema v1: `{ schemaVersion, updatedAt, plugins: { [id]: { enabled, autostart, kind } } }`.
- Written when: `savePluginCatalog()` is called with a known PM repo root.
- Init script: `scripts/init-plugin-catalog-mirror.mjs` seeds defaults when file absent.

### FR-3 Plugin schema extension

- Add optional `autostart?: boolean` on `BasePlugin` (default `false` for OpenClaw/Hermes built-ins).
- `togglePluginAutostart(catalog, id)` flips the flag and persists.

### FR-4 Integrations Hub UI

- Detail sheet shows **Autostart on stack launch** toggle for project-scoped sidecar plugins (`openclaw`, `hermes-agent`).
- When binary not detected, show guidance banner pointing to Install lifecycle command.
- Pass PM repo root from `MainClient` for mirror writes and terminal cwd (remove hardcoded `/Volumes/KLEVV-4T-1/...`).

## Technical Requirements

- Mirror write uses existing `writeFile` bridge (Tauri) or `/api/editor/write-file` (dev).
- Shell reads mirror via `scripts/plugin-state.sh` + `jq`.
- Do not bump `schemaVersion` on `.project-manager/config.json`.
- Project-scoped CLI commands use `.project-manager/bin/{name}` relative paths resolved against PM repo root.
- `npm run typecheck` and focused vitest must pass.

## Acceptance Criteria

1. Fresh machine: `./start_project_manager.sh start` succeeds without OpenClaw/Hermes installed.
2. `./start_project_manager.sh core` skips OpenClaw/Hermes when mirror defaults apply.
3. After enabling + autostart in UI, `./start_project_manager.sh core` attempts sidecar start (when installed).
4. `./start_project_manager.sh openclaw` with missing binary prints install guidance; does not run `npm run openclaw:install`.
5. Toggling plugin in UI updates `.project-manager/plugins.json`.
6. Integrations Hub detail sheet exposes autostart toggle for OpenClaw/Hermes.
7. Unit tests cover mirror build/parse and autostart toggle.

## Open Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Separate `enabled` vs `autostart` | Yes | Enable = dispatch adapter; autostart = dev stack sidecar |
| Mirror location | `.project-manager/plugins.json` | Colocated with other runtime state; gitignored |
| Explicit `openclaw` command without install | Fail with instructions | User typed command = intent to start, not auto-install |
