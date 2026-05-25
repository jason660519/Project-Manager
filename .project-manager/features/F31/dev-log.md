# F31 Dev Log - xmux Native Browser URL Chrome Stability

## 2026-05-26 AEST - Feature Started

User reported that the previous fix did not solve the real desktop symptom. Screenshot shows the GitHub native webview rendering directly under the xmux pane tab strip, with no URL chrome visible. That proves the URL input is still being covered by the OS-level webview.

### Dashboard Work

- Added F31 to `.project-manager/config.json`.
- Created feature-local artifacts:
  - `README.md`
  - `feature-spec.md`
  - `tdd-spec.md`
  - `dev-log.md`

### Current Working Hypothesis

The native webview bounds must be explicitly chrome-safe. The previous fix used safe measurement, but the desktop screenshot indicates the child webview can still occupy the BrowserContent root area. React `z-index` is not a viable protection because Tauri child webviews are native OS surfaces.

### Planned Engineering Work

1. Split browser chrome and native viewport into explicit DOM regions.
2. Make BrowserSlot sync native bounds only from the viewport region.
3. Add tests for GitHub default URL editing, Go/Enter submit, multiple browser tabs, close tab, close pane, inactive tab hiding, and retry native embed.
4. Run automated verification and desktop manual verification.

## 2026-05-26 AEST - URL Editing Fixed, Orphan Overlay Race Found

The URL input became editable after adding chrome interaction handling and native bounds guards, but user testing found a second desktop-only bug: browser content could remain as a sticky native overlay after closing or switching panes.

### Root Cause

The sticky overlay can occur when a native webview create is still pending while the user closes a browser tab or pane. The React session is removed, but the queued `xmuxWebviewCreate` can complete afterward and leave an OS child webview with no live registry owner. Since this is not a DOM node, React cannot remove it.

### Fixes Implemented

- Added `disposed` lifecycle guard to Tauri browser sessions.
- If pending create resolves after the session is disposed or removed, BrowserRegistry immediately destroys the just-created native webview label.
- `setSlotHidden`, `detach`, and `destroy` now park native webviews offscreen at `-100000,-100000` with size `1x1` before hiding/destroying.
- Rust `xmux_webview_set_visible(false)`, `xmux_webview_destroy`, and `xmux_webview_destroy_all` also park webviews offscreen before hide/close.
- `xmux_webview_set_bounds` now uses atomic `set_bounds(Rect)` instead of separate position and size updates.
- Leaving `/xmux` now destroys all browser sessions so native child webviews cannot survive route changes.

### Tests Added

- `__tests__/BrowserRegistry.native-lifecycle.test.ts`
  - Pending create resolving after close destroys the native webview.
  - Hidden sessions are parked offscreen even if frontend visible state is already false.
  - Purge clears registry sessions and calls Rust destroy-all.
- Existing F31 coverage retained:
  - `__tests__/BrowserSlot.native-bounds.test.tsx`
  - `__tests__/xmux.browser-url-chrome.test.tsx`
  - `__tests__/browser-bounds.test.ts`

### Verification

| Command | Result |
| --- | --- |
| `npm run test -- --run __tests__/BrowserRegistry.native-lifecycle.test.ts __tests__/BrowserSlot.native-bounds.test.tsx __tests__/browser-bounds.test.ts __tests__/xmux.browser-url-chrome.test.tsx __tests__/xmux.registry.test.tsx __tests__/blockLayout.destroy.test.ts` | Pass: 6 files / 20 tests. jsdom reports existing missing-canvas warning. |
| `npm run typecheck` | Pass |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |

### Remaining Manual Check

Restart or let `tauri dev` rebuild, then repeat:

1. Open `/xmux`.
2. Add/open two browser tabs with GitHub and Google.
3. Edit URL field, submit, switch tabs.
4. Close browser tabs and panes quickly while pages are loading.
5. Navigate away from `/xmux`.

Expected: no native browser content remains after close/switch/navigation.

## 2026-05-26 AEST - URL Focus Black Pane Regression Fixed

User reported a new regression after the sticky overlay fix: clicking the browser URL input made the browser pane turn fully black, and submitting a new URL such as `google.com` did not visibly reload the page.

### Reproduction Path

1. Open `/xmux` in the desktop/Tauri runtime.
2. Add or select a browser tab with the default GitHub URL.
3. Click the URL input.
4. Observe that the active browser content disappears and the pane becomes black.
5. Type `google.com` and submit.
6. Observe that the active pane remains black instead of showing the navigated page.

### Root Cause

The prior overlay protection introduced a `chromeInteracting` state in `BrowserContent`. When URL chrome received focus, that state was passed into `BrowserSlot` as `isChromeInteracting`. `BrowserSlot` then treated the active browser as unsafe to show and called `setSlotHidden(itemId)`.

In the Tauri backend, `setSlotHidden` parks the native child webview offscreen. That is correct for inactive tabs, invalid geometry, detach, close, and orphan cleanup, but it is wrong for URL editing. The active browser content must remain visible while the React URL input has focus.

### Fixes Implemented

- Removed the URL-chrome focus/blur hide path from `BrowserContent`.
- Removed the `isChromeInteracting` prop and hide checks from `BrowserSlot`.
- Kept inactive-slot, invalid-bounds, detach, close, route-leave, and orphan cleanup parking behavior intact.
- Added regression coverage proving that focusing the URL input does not call `setSlotHidden` for the active browser tab.
- Expanded URL-submit cases for `google.com`, full HTTPS search URLs, `about:blank`, and localhost URLs.

### Verification

| Command | Result |
| --- | --- |
| `npm run test -- --run __tests__/BrowserRegistry.native-lifecycle.test.ts __tests__/BrowserSlot.native-bounds.test.tsx __tests__/browser-bounds.test.ts __tests__/xmux.browser-url-chrome.test.tsx __tests__/xmux.registry.test.tsx __tests__/blockLayout.destroy.test.ts` | Pass: 6 files / 24 tests. jsdom reports existing missing-canvas warning. |
| `npm run typecheck` | Pass |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm run build` | Pass. Existing Turbopack dynamic file-tracing warnings remain in `app/api/chat/tools/file/route.ts`. |
| `npm run docs:check` | Pass |
| `npm run standards:check` | Pass with existing P2 hard-coded color warning. |
| Browser smoke on `http://localhost:43187/xmux` | Pass. Selected `@project-manager/app`, focused `Browser URL`, submitted `google.com`, `about:blank`, and `localhost:43187/project-progress-dashboard`; the input stayed connected/visible and the localhost page rendered in the pane. Screenshot: `/tmp/xmux-url-flow-verification.png`. |

### Follow-Up Manual Check

Desktop verification in the Tauri runtime must specifically confirm both old and new failure modes:

1. URL input stays visible above the native GitHub webview.
2. Clicking the URL input does not black out the active browser pane.
3. Enter/Go navigation updates the active pane for `google.com` and a localhost URL.
4. Closing browser tabs and switching panes does not reintroduce sticky native overlays.

## 2026-05-26 AEST - Debug Retro Artifact Promoted To Dashboard Field

The F31 debugging work exposed a process gap: expensive real-user reproduction paths were captured in chat and dev logs, but they were not first-class dashboard artifacts. That made it harder to reuse the work for future TDD and E2E design.

### Fixes Implemented

- Added `paths.debugRetro` and `paths.testScenarios` to the feature artifact model.
- Added Project Progress Dashboard columns for `debug-retro.md` and `test-scenarios.md`.
- Registered F31's new artifacts in `.project-manager/config.json`.
- Created:
  - `.project-manager/features/F31/debug-retro.md`
  - `.project-manager/features/F31/test-scenarios.md`
- Updated workflow docs so future debug sessions can preserve reproduction, root cause, verification, and test scenario conversion in the repo:
  - `docs/project-process/commands/debug-retro.md`
  - `.claude/commands/debug-retro.md`
  - `.claude/commands/daily-report.md`
  - `.claude/commands/ship.md`
  - `.claude/skills/ship/SKILL.md`

### Tests Added

- `__tests__/progressDashboard.pathLabels.test.tsx`
  - Verifies dashboard cells show `debug-retro.md` and `test-scenarios.md` labels instead of raw paths.
  - Verifies the document panel receives absolute paths for both artifacts.

### Verification

Verification for this artifact/dashboard update is recorded in the final command output for the implementation session.
