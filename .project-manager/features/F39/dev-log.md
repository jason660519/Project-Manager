# F39 Dev Log — User-Controlled Plugin Install, Catalog Mirror, and Startup

## 2026-05-30 — Kickoff

### Context

User switched to a new development machine. Running `./start_project_manager.sh openclaw` failed:

```text
sync-openclaw-env.sh: line 114: node: command not found
OpenClaw Gateway did not report a listening port within 10 seconds
```

Product discussion concluded: third-party runtime install/start should be user-controlled via the existing Plugins / Integrations Hub model, not forced by dev startup scripts.

Prior art (2026-05-18): OpenClaw/Hermes registered as disabled-by-default CLI plugins; adapter bridge complete; UI lifecycle scripts exist but startup script still auto-installs and always starts sidecars on `core`/`all`.

### Baseline Observations

- `lib/storage/plugins.ts`: `hermes-agent` and `openclaw` have `enabled: false`.
- `start_project_manager.sh`: `cmd_openclaw` / `cmd_hermes` auto-run `npm run *:install` when wrapper missing.
- `cmd_core` / `cmd_all` unconditionally invoke both sidecars after PM start.
- Plugin catalog persisted to localStorage only — bash cannot read toggles.
- `IntegrationsDetailSheet` already renders runtime lifecycle commands (Install, Doctor, Start gateway).
- `PluginsHubView` hardcodes `PROJECT_MANAGER_ROOT = '/Users/Project-Manager'`.

### Planned Work

1. Feature kickoff F39 — specs + Development sheet registration.
2. Add `autostart` flag + `.project-manager/plugins.json` mirror module.
3. Update `start_project_manager.sh` — no auto-install; respect mirror on `core`/`all`.
4. Integrations Hub — autostart toggle; pass dynamic PM repo root; fix CLI command paths.
5. Tests: `__tests__/pluginCatalogMirror.test.ts`.
6. Verification: typecheck, vitest, bash -n, docs:check.

### Design Decisions

| Decision | Rationale |
| --- | --- |
| `enabled` vs `autostart` split | Dispatch adapter vs dev-stack sidecar are different user intents |
| Mirror at `.project-manager/plugins.json` | Same runtime scope as vendor/bin/state; gitignored |
| Explicit `openclaw`/`hermes` fails when not installed | User command = start intent, not silent install |
| No schemaVersion bump | Optional plugin fields + runtime file only |

### Verification Log

- `npm run typecheck` — passed
- `npm test -- __tests__/pluginCatalogMirror.test.ts` — 9/9 passed
- `bash -n start_project_manager.sh scripts/plugin-state.sh` — passed
- `node scripts/init-plugin-catalog-mirror.mjs` — creates default mirror when missing
- `bash scripts/plugin-state.sh autostart openclaw` — exit 1 with default mirror (expected)
- `npm run docs:check` — skipped (pre-existing `rg` missing in shell PATH on this machine; no doc edits in F39 artifacts beyond feature folder)
- Manual F39-M01 / F39-M02 — pending on user machine

### Implementation Notes (2026-05-30)

| Slice | Files |
| --- | --- |
| Catalog mirror | `lib/storage/plugin-catalog-mirror.ts`, `scripts/init-plugin-catalog-mirror.mjs`, `scripts/plugin-state.sh` |
| Plugin autostart | `lib/types/plugins.ts`, `lib/storage/plugins.ts`, `lib/project-manager-root.ts` |
| Startup script | `start_project_manager.sh` |
| Integrations Hub UI | `IntegrationsDetailSheet.tsx`, `PluginsHubView.tsx`, `MainClient.tsx`, i18n |
| Tests | `__tests__/pluginCatalogMirror.test.ts` |
| Interactive deps (F39 follow-up) | `scripts/dependency-resolver.sh`, `scripts/test-dependency-resolver.sh` |

### Interactive dependency resolver (2026-05-30 follow-up)

- `scripts/dependency-resolver.sh` — discover nvm/fnm/Homebrew Node paths; prompt before install; live `tee` progress.
- `./start_project_manager.sh start|web|openclaw|…` calls `dep_ensure_pm_runtime` before npm/Tauri.
- Sidecar install (`openclaw`/`hermes`) prompts before `npm run *:install`, then continues on success.
- Flags: `--yes-deps` (auto-confirm), `--no-deps` (fail fast), env `PM_AUTO_INSTALL=1|0`.
