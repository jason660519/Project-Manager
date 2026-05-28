# F37: Windows Font Zoom Shortcuts and Global Font Scaling

## Purpose

Add app-wide font zoom controls for the Tauri desktop app, focused on Windows users who need quick keyboard access to larger or smaller text. The feature improves accessibility, projector/demo readability, high-DPI usability, and keyboard-only workflows without changing Project Manager's operational shell.

## Background

Project Manager already uses a Tauri v2 Rust backend and a React/Next.js frontend. The app bridge pattern is Rust emitting events to the frontend, while frontend UI state and layout behavior stay in TypeScript/CSS. Tauri v2 global shortcuts require the official `tauri-plugin-global-shortcut` dependency and explicit capability permissions. The current development environment is macOS, so Windows OS-level shortcut press behavior must be marked for Windows manual verification.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a keyboard-only Windows user, I can press `Win++` or `Win+-` to change app text size without opening settings. |
| US-02 | As a Windows desktop user, I can use numpad variants when my keyboard layout maps plus/minus differently. |
| US-03 | As a high-DPI monitor user, I can enlarge Project Manager up to a readable maximum without the app becoming unusable. |
| US-04 | As a presenter or projector user, I can quickly enlarge the UI before a demo and shrink it afterward. |
| US-05 | As a user who accidentally reaches the limit, repeated zoom commands clamp at 30% or 300% instead of breaking layout. |
| US-06 | As a returning user, my chosen zoom level is restored after reload or app restart when storage is available. |
| US-07 | As a maintainer, global shortcut registration conflicts do not crash the app; they are logged for diagnosis. |
| US-08 | As a desktop user, I can use the native View menu to Zoom In, Zoom Out, or return to Actual Size. |

## Functional Requirements

- Register the feature in Project Dashboard > Development as F37 with canonical artifacts.
- On Windows, register zoom-in shortcuts: `Super+Equal` and `Super+NumpadAdd`.
- On Windows, register zoom-out shortcuts: `Super+Minus` and `Super+NumpadSubtract`.
- Emit a `font-zoom-shortcut` frontend event with direction, shortcut label, and source.
- Apply zoom globally with a scale range from `0.3` through `3.0`.
- Use a stable `0.1` zoom step for each shortcut press.
- Support Actual Size reset to `1.0`.
- Add native View menu entries for `Zoom In`, `Zoom Out`, and `Actual Size` with platform menu accelerators.
- Persist the current scale under `project-manager:font-zoom-scale` when storage is available.
- Keep browser mode safe: no Tauri runtime should be required to render the page.

## Technical Requirements

- Use `tauri-plugin-global-shortcut = "2.3.1"` in `src-tauri/Cargo.toml`.
- Add `global-shortcut:allow-is-registered`, `global-shortcut:allow-register`, and `global-shortcut:allow-unregister` to the default capability.
- Register shortcuts from Rust setup and treat registration failure as non-fatal.
- Keep the Rust backend responsible only for shortcut detection and event emission.
- Keep zoom state and DOM/CSS application in frontend code.
- Use `--pm-font-zoom` as the CSS control variable.
- Apply the scale through root font-size so text changes without geometrically scaling the whole layout box.
- Do not read, write, or expose `.env` or secrets.

## Acceptance Criteria

1. F37 exists in `.project-manager/config.json` with paths for README, feature spec, TDD spec, test scenarios, and dev log.
2. The app builds with the global shortcut dependency and capability permissions.
3. Rust emits `font-zoom-shortcut` for the four Windows shortcut variants.
4. Frontend receives the event and updates the global scale.
5. Scale clamps at 30% minimum and 300% maximum.
6. Scale persists when storage works and degrades gracefully when storage is unavailable.
7. Existing app shell renders in browser mode after the hook is mounted.
8. Native View menu actions emit the same frontend zoom event as shortcuts.
9. Verification results and Windows manual verification limitations are recorded in `dev-log.md`.

## Open Decisions

- User-configurable shortcut mappings are out of scope for F37 and should become a later feature if needed.
- A visible Settings UI for zoom reset/current percentage is out of scope for this first slice.
