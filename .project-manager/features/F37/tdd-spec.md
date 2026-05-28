# F37 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F37 exists with status `in_progress`, phase `development`, and category `Desktop Runtime`. |
| A2 | Feature paths | README, feature spec, TDD spec, test scenarios, and dev log files exist and are non-empty. |
| A3 | Dashboard notes | `feature.notes` remains short text and does not store artifact paths. |

## Suite B: Font zoom core logic

| Case | User action | Expected |
| --- | --- | --- |
| B1 | Zoom in from scale `1.0` | Next scale is `1.1`. |
| B2 | Zoom out from scale `1.0` | Next scale is `0.9`. |
| B3 | Repeated zoom in beyond maximum | Scale clamps at `3.0`. |
| B4 | Repeated zoom out beyond minimum | Scale clamps at `0.3`. |
| B5 | Stored scale is invalid or not finite | App falls back to base scale `1.0`. |
| B6 | Storage throws or is unavailable | App still applies session zoom without crashing. |
| B7 | Scale is applied | Root element receives `--pm-font-zoom` and `data-pm-font-zoom`. |
| B8 | Actual Size action fires | Scale resets to `1.0` and persists. |

## Suite C: Tauri event bridge

| Case | Source | Expected |
| --- | --- | --- |
| C1 | Rust shortcut handler receives `Super+Equal` | Emits direction `in` with shortcut label `Win++`. |
| C2 | Rust shortcut handler receives `Super+NumpadAdd` | Emits direction `in` with numpad shortcut label. |
| C3 | Rust shortcut handler receives `Super+Minus` | Emits direction `out` with shortcut label `Win+-`. |
| C4 | Rust shortcut handler receives `Super+NumpadSubtract` | Emits direction `out` with numpad shortcut label. |
| C5 | Shortcut registration fails | App startup continues and logs a warning. |
| C6 | Browser mode renders outside Tauri | Listener resolves to a no-op and UI remains usable. |
| C7 | Foreground `Meta/Win` keydown fallback fires | The same clamp, persistence, and CSS variable path runs without requiring Tauri event delivery. |
| C8 | Native View menu `Zoom In`, `Zoom Out`, or `Actual Size` fires | Rust emits `font-zoom-shortcut` with action `in`, `out`, or `reset`. |

## Suite D: Layout and user scenarios

| Case | Scenario | Expected |
| --- | --- | --- |
| D1 | App is in foreground on Windows | Shortcut changes scale exactly once per press. |
| D2 | User demos on projector | Large scale remains navigable and no blank shell appears. |
| D3 | User uses high-DPI display | Increased scale improves readability without hidden runtime failures. |
| D4 | User reloads/restarts app | Stored scale is restored when storage is available. |
| D5 | User reaches min/max boundary | Further shortcut presses keep the app stable. |
| D6 | User tests in local browser instead of Tauri | Foreground key fallback changes the visible scale, while OS-level shortcut verification remains marked Windows-only. |

## Required Automated Verification

- `npm run test -- __tests__/fontZoom.test.ts`
- `npm run typecheck`
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run docs:check`
- `npm run standards:check`
- `git diff --check`

## Required Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F37-M01 | Windows foreground shortcut | Open Tauri app on Windows, focus Project Manager, press `Win++` and `Win+-` | Scale increases/decreases once per press. |
| F37-M02 | Numpad shortcut | Press `Win+NumpadAdd` and `Win+NumpadSubtract` | Same behavior as main-key shortcuts. |
| F37-M03 | Boundary handling | Hold or repeat zoom in/out until limits | Scale clamps at 300% and 30%; app remains navigable. |
| F37-M04 | Shortcut conflict | Run on a Windows machine where one shortcut is unavailable | App starts; warning is logged; no crash. |
| F37-M05 | Restart persistence | Set scale, restart app | Previous scale is restored when storage is available. |
| F37-M06 | Native View menu | Open View menu in Tauri app and select `Zoom In`, `Zoom Out`, `Actual Size` | Menu items invoke the same zoom behavior as keyboard shortcuts. |
