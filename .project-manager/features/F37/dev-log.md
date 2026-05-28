# F37 Dev Log - Windows Font Zoom Shortcuts and Global Font Scaling

## 2026-05-28 - Kickoff

### Context

User requested implementation of the agreed plan, with a required Project Dashboard > Development checkpoint before continuing implementation. The feature targets Windows Tauri desktop users and app-wide scaling.

### Baseline Observations

- Branch: `main...origin/main`.
- Highest existing feature ID before kickoff: `F36`.
- No existing feature matched font, zoom, shortcut, or hotkey scope.
- Dirty implementation files existed before F37 kickoff:
  - `app/globals.css`
  - `app/ui/AppShell.tsx`
  - `lib/bridge/index.ts`
  - `src-tauri/Cargo.lock`
  - `src-tauri/Cargo.toml`
  - `src-tauri/capabilities/default.json`
  - `src-tauri/src/lib.rs`
  - `__tests__/fontZoom.test.ts`
  - `lib/fontZoom.ts`
  - `lib/hooks/useFontZoomShortcuts.ts`
- `next-env.d.ts` was also dirty from Next type generation and must be reviewed separately as possible generated churn.
- `.env` is open in the IDE but is not needed for this work and must not be read or copied into artifacts.

### Kickoff Command

```bash
npm run feature:kickoff -- --title "Windows Font Zoom Shortcuts and Global Font Scaling" --category "Desktop Runtime" --located-section "Project Dashboard > Development" --implementation "src-tauri/src/lib.rs" --test "__tests__/fontZoom.test.ts" --points 5 --progress 10 --status in_progress --notes "Add Windows global font zoom shortcuts and app-wide scaling"
```

### Planned Work

1. Replace scaffolded F37 artifacts with specific feature, TDD, user scenario, and dev log content.
2. Keep the current shortcut/zoom implementation aligned with the F37 scope.
3. Ensure `next-env.d.ts` generated churn is not left unexplained.
4. Run metadata checks, focused frontend tests, TypeScript/build checks, Rust checks, docs checks, standards checks, and diff whitespace checks.
5. Record Windows manual verification limits, because the current environment is macOS.

### Design Decision

Use Tauri's official global shortcut plugin in Rust, emit a small frontend event, and keep all scale state/application in frontend code. Shortcut registration must be Windows-only and non-fatal on conflicts. Font scaling must clamp to 30% through 300% and persist when storage is available.

### Verification Log

- Pending: feature metadata checks.
- Pending: `npm run test -- __tests__/fontZoom.test.ts`.
- Pending: `npm run typecheck`.
- Pending: `npm run build`.
- Pending: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Pending: `cargo test --manifest-path src-tauri/Cargo.toml`.
- Pending: `npm run docs:check`.
- Pending: `npm run standards:check`.
- Pending: `git diff --check`.
- Pending manual: Windows OS-level `Win++`, `Win+-`, numpad variants, conflict handling, and restart persistence.

## 2026-05-28 - Continuation

### Context

Resuming F37 - Windows Font Zoom Shortcuts and Global Font Scaling. This continuation starts from the registered Development-sheet feature artifacts instead of creating a new feature ID.

### Previous State

- Status: in_progress
- Progress: 85%
- Phase: development
- Implementation: src-tauri/src/lib.rs
- Focused test: __tests__/fontZoom.test.ts

### Artifacts Reviewed

- README: .project-manager/features/F37/README.md
- Feature spec: .project-manager/features/F37/feature-spec.md
- TDD spec: .project-manager/features/F37/tdd-spec.md
- Test scenarios: .project-manager/features/F37/test-scenarios.md
- Dev log: .project-manager/features/F37/dev-log.md

### Planned Work

- Implementation completed for Rust shortcut registration, frontend event bridge, global zoom scaling, focused unit tests, and documentation artifacts. Remaining validation is Windows OS-level manual testing for Win shortcuts and conflict behavior.

### Verification Log

- Pending: focused tests for resumed behavior.
- Pending: npm run typecheck if TypeScript changes.
- Pending: npm run docs:check if artifacts change.

## 2026-05-28 - Implementation and Verification Results

### Implemented

- Added Tauri global shortcut dependency and capability permissions.
- Added Windows shortcut registration for `Super+Equal`, `Super+NumpadAdd`, `Super+Minus`, and `Super+NumpadSubtract`.
- Added Rust event payload emission for `font-zoom-shortcut`.
- Made shortcut registration non-fatal so conflicts log a warning instead of blocking app startup.
- Added frontend bridge listener, global hook, scale clamp/persistence utilities, and global CSS scaling.
- Added focused unit coverage for clamp, step, persistence, invalid storage read, and failed storage write.

### Verification Results

- Passed: F37 metadata exists in `.project-manager/config.json`.
- Passed: F37 feature spec, TDD spec, test scenarios, and dev log files are non-empty.
- Passed: `npm run test -- __tests__/fontZoom.test.ts` (`5 passed`).
- Passed: `npm run typecheck`.
- Passed: `npm run build`.
- Passed: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Passed: `cargo test --manifest-path src-tauri/Cargo.toml` (`12 passed`).
- Passed: `npm run docs:check`.
- Passed: `npm run standards:check`.
- Passed: `git diff --check`.
- Passed: browser render smoke at `http://127.0.0.1:43187/`; Project Progress Dashboard rendered, `--pm-font-zoom` was `1`, and `data-pm-font-zoom` was `1`.

### Manual Verification Status

- Not run in this environment: Windows OS-level `Win++`, `Win+-`, `Win+NumpadAdd`, and `Win+NumpadSubtract` shortcut presses.
- Not run in this environment: Windows shortcut conflict behavior.
- Not run in this environment: Tauri restart persistence on Windows.
- Reason: current development environment is macOS; Windows OS-level shortcut behavior requires a Windows desktop runtime.

### Follow-Up For Windows QA

Run the manual scenarios in `test-scenarios.md` on a Windows build before marking F37 fully verified or done.

## 2026-05-28 - Hook Test Coverage Follow-Up

### Implemented

- Added `__tests__/useFontZoomShortcuts.test.tsx` to cover the React hook boundary.
- Verified the hook loads a stored zoom scale, registers the bridge listener, applies zoom-in and zoom-out events from the mocked Rust bridge, persists the new scale, and unregisters the listener on unmount.

### Verification Results

- Passed: `npm run test -- __tests__/fontZoom.test.ts __tests__/useFontZoomShortcuts.test.tsx` (`8 passed`).
- Passed after clearing stale generated `.next` type output: `npm run typecheck`.
- Passed: `npm run build`.
- Passed: `npm run docs:check`.
- Passed: `git diff --check`.
- Confirmed: `next-env.d.ts` has no remaining diff after typegen/build.

### Remaining Manual Verification

- Still pending: Windows OS-level shortcut presses, shortcut conflict behavior, and Windows Tauri restart persistence.

## 2026-05-28 - Visual Verification Fix

### Issue Found

- User reported that text size did not change during hands-on testing.
- Browser inspection confirmed the local `http://127.0.0.1:43187/` tab is not a Tauri WebView (`hasTauri=false`), so Rust-emitted `font-zoom-shortcut` events cannot reach that browser context.
- Visual keypress testing also showed that `body { zoom: var(--pm-font-zoom) }` changes the page, but it scales the whole layout box and can cause card text overlap in a narrow viewport.

### Implemented

- Added a foreground app fallback listener for `Meta/Win + =`, `Meta/Win + +`, `Meta/Win + -`, and numpad equivalents, so focused browser/Tauri views can still drive font zoom when the OS-level global shortcut path is unavailable or cannot be inspected locally.
- Replaced body-level geometric zoom with root font-size scaling via `font-size: calc(16px * var(--pm-font-zoom))`, reducing layout breakage risk while keeping font scale centralized.
- Updated the Project Dashboard project card header so project identity, badges, feature count, and initialize actions wrap instead of overlapping at increased font scale.
- Added test coverage for keyboard shortcut direction mapping and foreground keydown fallback behavior.

### Visual Check

- Passed: browser foreground keypress simulation changed `data-pm-font-zoom` and `--pm-font-zoom` from `1` through higher values.
- Passed: visual screenshot confirmed text size changes after foreground keypress.
- Passed: visual screenshot at 110% confirmed the dashboard project card no longer overlaps project name, badge, feature count, and action controls in the narrow in-app browser viewport.
- Restored the browser tab scale back to `1` after inspection.

### Verification Results

- Passed: `npm run test -- __tests__/fontZoom.test.ts __tests__/useFontZoomShortcuts.test.tsx` (`10 passed`).
- Passed: `npm run typecheck`.
- Passed: `npm run build`.
- Passed: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Passed: `cargo test --manifest-path src-tauri/Cargo.toml` (`12 passed`).

### Remaining Manual Verification

- Still pending on Windows: OS-level `Win++`, `Win+-`, `Win+NumpadAdd`, `Win+NumpadSubtract`, conflict behavior, and restart persistence in the packaged/Tauri desktop runtime.

## 2026-05-28 - Actual Size And View Menu Follow-Up

### Issue Found

- User confirmed zoom in/out now work, but requested an `Actual Size` reset plus native `View` menu entries matching the standard `Zoom In`, `Zoom Out`, and `Actual Size` menu pattern.

### Implemented

- Added a frontend `reset` zoom action that restores scale to `1.0`, updates `--pm-font-zoom`, and persists the baseline value.
- Added foreground key handling for `Meta/Win/Ctrl + 0` so local browser/Tauri focused views can trigger Actual Size.
- Added native Tauri `View` menu entries for `Zoom In`, `Zoom Out`, and `Actual Size` with `CmdOrCtrl++`, `CmdOrCtrl+-`, and `CmdOrCtrl+0` accelerators.
- Wired native menu events back through the existing `font-zoom-shortcut` bridge with action payloads `in`, `out`, and `reset`.

### Verification Results

- Passed: `npm run test -- __tests__/fontZoom.test.ts __tests__/useFontZoomShortcuts.test.tsx` (`11 passed`).
- Passed: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Passed: browser visual check: zoomed from `1.0` to `1.2`, then `Meta+0` reset `--pm-font-zoom` and `data-pm-font-zoom` back to `1`.
- Passed: `npm run tauri:dev` reached the running `target/debug/project-manager` process, confirming native menu setup does not fail during app startup.

### Remaining Manual Verification

- Still pending in Tauri desktop runtime: open native `View` menu and click `Zoom In`, `Zoom Out`, `Actual Size`.
- Still pending on Windows: OS-level `Win++`, `Win+-`, `Win+NumpadAdd`, `Win+NumpadSubtract`, conflict behavior, and restart persistence.
