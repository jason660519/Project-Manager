---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing settings guide with no secrets, credentials, or private infrastructure details.
---

# Settings

The **Settings** view is Project Manager's preferences pane. It surfaces app-level toggles, runtime bridge status, the AI CLI exposure preset, and the global keyboard shortcut map — everything that is not project-specific.

Open it from the sidebar (gear icon) or from `/settings`.

## At a glance

| Section | What it controls |
|---|---|
| System Tray | Toggle whether Project Manager keeps a tray icon resident after window close. |
| Runtime Bridge | Read-only status of the Tauri runtime, AI route, secret backend, and process-spawn capability. |
| AI CLI Preset (allowlist) | Edit, import, export, and reset the default allowlist applied to `system-cli` rows on the Integrations Hub **Commands** sheet. |
| Keyboard Shortcuts | Reference table of every shortcut the app reserves, with a `Ready` / `Planned` tag per row. |

Sections render top to bottom as scrollable panels. None of the controls touch a specific project — changes are global to your install.

## Anatomy of the page

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SETTINGS                                       [?] [Bot] [Theme] [Lang]  │  ← global TopBar
├──────────────────────────────────────────────────────────────────────────┤
│ System Tray                                                       [P2]   │
│   [ ] Enable on launch                                  ●─── toggle      │
├──────────────────────────────────────────────────────────────────────────┤
│ Runtime Bridge                                                           │
│   Runtime mode               Tauri | Browser preview                     │
│   AI requests routed via     Rust call_anthropic                         │
│   Secret storage backend     OS Keychain | localStorage                  │
│   Process spawn enabled      Yes | No (browser)                          │
├──────────────────────────────────────────────────────────────────────────┤
│ System CLI Preset (AI Defaults)                                          │
│   [ multi-line textarea: one command per line ]                          │
│   12 commands         [ Export JSON ] [ Import JSON ] [ Reset ] [ Save ] │
├──────────────────────────────────────────────────────────────────────────┤
│ Keyboard Shortcuts                                                       │
│   Navigation / Dispatch / Search / Runtime — 4 grouped tables            │
└──────────────────────────────────────────────────────────────────────────┘
```

## System Tray

Toggle whether the app keeps a macOS / Windows / Linux tray icon resident when the main window closes. The control is **disabled in the browser preview** (`npm run dev`); the in-page hint reminds you that tray support is a Tauri-only capability. The `P2` badge in the section header tags this as a priority-2 polish item — the toggle is wired but the underlying tray plugin is still being finalised.

## Runtime Bridge

A read-only diagnostic panel. Each row shows the current value with a green accent when the runtime is wired and a grey accent when the capability is unavailable.

| Row | Value in `tauri:dev` / built app | Value in browser preview |
|---|---|---|
| Runtime mode | `Tauri` | `Browser preview` |
| AI requests routed via | `Rust call_anthropic` | `Rust call_anthropic` |
| Secret storage backend | `OS Keychain` (or `Dev secrets file` in debug builds, see [Keys](./keys.md)) | `localStorage` |
| Process spawn enabled | `Active` | `Disabled` |

The secret-storage row is sourced from the `get_secrets_storage_backend` Tauri command. AI routing is fixed by ADR-004 — the renderer never holds the Anthropic key, always proxying through `call_anthropic` in Rust.

## AI CLI Preset (allowlist)

The **Commands** sheet on the Integrations Hub scans your system `PATH` for known CLIs (`claude`, `cursor`, `codex`, `gemini`, etc.) and exposes them as `system-cli` rows. The AI CLI preset is the default *recommended* set to flip on when you click **AI Defaults** on that sheet — it's how new installs get a safe starting allowlist without ticking every box manually.

### Editing the preset

| Control | Behaviour |
|---|---|
| Textarea | One CLI command per line. Whitespace is trimmed; empty lines are ignored. |
| Live counter | Reports the trimmed-non-empty line count (`N entries`). |
| **Export JSON** | Copies the current preset as a pretty-printed JSON array to your clipboard (falls back to a prompt if clipboard access is denied). |
| **Import JSON** | Opens a prompt — paste a JSON array of strings. Invalid input shows an inline error and leaves the draft alone. |
| **Reset** | Restores the original recommended defaults (`getAiCliPresetAllowlist()` from `lib/storage/system-cli.ts`). |
| **Save** | Persists the current textarea contents and re-normalises the draft. |

The preset is local to your install — it is stored in `localStorage`, not in any project file. Hitting **Reset** is non-destructive: it only overwrites the draft, you still need to click **Save** to persist.

### Where the preset is consumed

On the Integrations Hub **Commands** sheet, the toolbar exposes three preset buttons:

- **Allow all** — flip every `system-cli` row to exposed.
- **Block all** — turn them all off.
- **AI Defaults** — use the allowlist you configure here.

The preset is therefore the single editable source of truth for what "AI Defaults" means on your machine.

## Keyboard Shortcuts

A reference table grouped into four sections (Navigation, Dispatch, Search and Filters, Runtime Controls). Each row carries a status badge:

| Badge | Meaning |
|---|---|
| **Ready** (green) | Shortcut is live in the current build. |
| **Planned** (amber) | Reserved key; not wired yet. |

Today only `Shift + ?` (open the shortcut reference) is **Ready**. Everything else is planned and tracked for the keyboard-first navigation milestone. The same panel is also reachable from any view by pressing `Shift + ?`.

## What is NOT in Settings (today)

| Setting | Where it lives instead |
|---|---|
| Theme | Global TopBar (theme picker icon). |
| Language | Global TopBar (language picker icon). |
| API keys | [Keys](./keys.md) view (`/keys`). |
| Plugin / integration toggles | [Integrations Hub](./integrations-hub.md) (`/integrations-hub`). |
| Project root selection | Sidebar project picker. |
| Per-project config (`.project-manager/config.json`) | Edited by the dashboard itself; this view is global only. |

If you came here expecting one of those, follow the link in the right column.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Wire up the system-tray toggle | Today the switch persists in component state only — restart-safe persistence is pending. |
| Add a Theme / Language section | Move the TopBar pickers into Settings so all preferences live in one place. |
| Per-project preset overrides | Let a project pin a stricter AI-CLI allowlist than the global default. |
| Hotkey rebinding | Allow editing each shortcut directly in the keyboard table. |
| Telemetry / privacy controls | Surface anonymous usage opt-in once telemetry exists. |

## References

- Source: [`app/ui/views/SettingsView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/SettingsView.tsx)
- Sub-component: [`app/ui/views/KeyboardShortcutsView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/KeyboardShortcutsView.tsx)
- Page entry: [`app/settings/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/settings/page.tsx)
- CLI preset storage: [`lib/storage/system-cli.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/storage/system-cli.ts)
- Secrets backend bridge: [`lib/bridge/index.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/bridge/index.ts) (`getSecretsStorageBackend`)
- ADR-004 (Anthropic key never in renderer): [`docs/architecture/`](https://github.com/jason660519/Project-Manager/tree/main/docs/architecture)
