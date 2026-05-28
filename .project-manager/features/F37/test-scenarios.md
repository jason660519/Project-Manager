# F37 Test Scenarios

## Purpose

Map real user paths for Windows font zoom shortcuts into automated tests, manual desktop checks, and follow-up coverage candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F37-S01 | Windows user presses `Win++` while Project Manager is foregrounded | Shortcut not registered or event not emitted | Rust compile check; bridge payload type | Windows Tauri manual smoke | Planned | Feature spec |
| F37-S02 | Windows user presses `Win+-` while Project Manager is foregrounded | Zoom direction reversed or ignored | Rust compile check; bridge payload type | Windows Tauri manual smoke | Planned | Feature spec |
| F37-S03 | User uses numpad plus/minus | Keyboard layouts miss main plus/minus | Rust shortcut registration includes numpad variants | Windows keyboard manual smoke | Planned | Feature spec |
| F37-S04 | User repeatedly zooms in | Scale exceeds 300% and layout becomes unusable | `nextFontZoomScale` max clamp unit test | Browser/Tauri visual scan at max scale | Covered by unit; manual pending | TDD |
| F37-S05 | User repeatedly zooms out | Scale drops below 30% and text becomes unreadable | `nextFontZoomScale` min clamp unit test | Browser/Tauri visual scan at min scale | Covered by unit; manual pending | TDD |
| F37-S06 | Storage is unavailable or throws | App crashes on startup or shortcut press | storage fallback unit test | Browser mode smoke | Covered by unit | TDD |
| F37-S07 | User reloads/restarts app | Zoom preference is lost | apply/read storage unit tests | Tauri restart manual smoke | Covered by unit; manual pending | Feature spec |
| F37-S08 | Shortcut registration conflicts with OS/tool | App fails to launch | non-fatal registration path in Rust | Windows conflict manual smoke | Planned | Feature spec |
| F37-S09 | Browser mode outside Tauri | Hook tries to access unavailable Tauri runtime | no-op listener behavior, foreground key fallback, and browser smoke | Browser route smoke | Covered by unit; visual passed | Runtime boundary |
| F37-S10 | Existing dashboard UI at zoomed scale | UI appears blank or key controls disappear | build/typecheck plus screenshot/manual scan | Browser/Tauri visual scan | Visual partial; Windows pending | Design system |
| F37-S11 | User selects `View > Actual Size` or presses `Cmd/Ctrl+0` | User cannot quickly return to baseline scale | reset action unit and hook tests | Tauri native menu manual smoke | Covered by unit; Tauri manual pending | User feedback |
| F37-S12 | User selects `View > Zoom In/Zoom Out` | Menu items do not match shortcut behavior | Rust compile check plus bridge payload contract | Tauri native menu manual smoke | Compile covered; manual pending | User feedback |

## Unit Test Backlog

- Verify clamp range: `0.3 <= scale <= 3.0`.
- Verify 10% step behavior in both directions.
- Verify invalid stored values fall back to `1.0`.
- Verify CSS variable and `data-pm-font-zoom` are applied.
- Verify storage read/write errors do not throw.
- Verify foreground `Meta/Win` keydown fallback maps plus/minus to the same zoom directions as Rust events.
- Verify `Actual Size` resets scale to `1.0`.

## Integration and Manual Backlog

- Add a future integration test for frontend event handling if the project adds a stable Tauri event mock helper.
- Add a future Settings UI test if the app exposes current zoom percentage or reset controls.
- Run Windows desktop smoke before claiming OS-level shortcut behavior complete.

## Conversion Rule

If Windows manual testing reveals keyboard layout differences, shortcut conflict patterns, or WebView2 scaling issues, append a new scenario row before changing code and map it to the smallest reproducible automated or manual check.
