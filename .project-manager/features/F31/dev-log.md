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

## 2026-05-26 AEST - Split Resize Ghost And Browser Pane Close Fixed

User reported that the desktop/Tauri browser still left sticky native content when resizing split panes left/right or up/down, and that the browser pane could not be removed cleanly.

### Reproduction And Trigger Conditions

- Browser-mode smoke at `1440x900` reproduced the split geometry changes and verified the DOM iframe path tracks pane size.
- The native/Tauri risk path is specific to OS child webviews: during a split drag, the child webview can intercept pointer events and keep drawing at stale bounds while React layout moves.
- A second lifecycle bug was found in code review and regression testing: after a native webview had been parked offscreen, `setBounds()` and `forceNativeBoundsSync()` set `session.visible = true` before checking whether `show()` was required. That made the restore branch unreachable.
- Pane removal depended on the leaf component destroying sessions before asking the layout to remove the block. The layout-level close path now destroys all block items before removal, so future callers cannot remove a block without browser cleanup.

### Fixes Implemented

- Added native browser paint suspension during xmux split/sidebar resize. On drag start all native browser webviews are parked offscreen; during drag, bounds are recorded but native views are not shown or created; after drag end, the active `BrowserSlot` restores the latest bounds.
- Added a split-resize overlay in `LayoutRenderer` so browser/iframe content cannot steal drag events in browser mode, and native webviews are already parked in Tauri mode.
- Fixed the native restore state bug by capturing `wasVisible` before mutating `session.visible`, then calling `xmuxWebviewSetVisible(label, true)` when a parked webview becomes active again.
- Centralized pane close cleanup in `XmuxView.handleCloseBlock()` using `findBlock()` + `destroyBlockItems()` before `removeBlock()`.
- Adjusted `Block` so closing the last tab or closing a pane delegates teardown to the layout-level close path instead of doing partial local cleanup first.

### Verification

| Command / Check | Result |
| --- | --- |
| `npm run test -- --run __tests__/BrowserRegistry.native-lifecycle.test.ts __tests__/BrowserSlot.native-bounds.test.tsx __tests__/xmux.browser-url-chrome.test.tsx __tests__/xmux.registry.test.tsx __tests__/blockLayout.destroy.test.ts` | Pass: 5 files / 23 tests. Existing jsdom canvas warning only. |
| `npm run typecheck` | Pass |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm run docs:check` | Pass |
| `npm run standards:check` | Pass with existing P2 hard-coded color warning. |
| `npm run build` | Pass. Existing Turbopack dynamic file-tracing warnings remain in `app/api/chat/tools/file/route.ts`. |
| Browser smoke at `1440x900` | Pass. Left/right resize changed browser slot width from `462px` to `722px`; adding a bottom split and resizing up/down changed browser slot height from `346px` to `216px`. |
| Browser smoke repeated browser lifecycle | Pass. Created and closed browser tabs 20 times, then removed the browser pane without exceptions or leftover iframe DOM. |
| Browser smoke at `1024x700` | Pass after pane removal; no browser pane/iframe remained. |

### Remaining Manual Check

This environment can validate current macOS code, browser-mode behavior, Rust compile integrity, and registry lifecycle calls. It cannot genuinely validate Windows/Linux native webview rendering. A follow-up Tauri-native visual smoke should repeat the same split-resize and close-pane loop on packaged macOS, Windows, and Linux builds before claiming cross-OS completion.

## 2026-05-26 AEST - Expected Native Cleanup Race No Longer Trips Next Error Overlay

User reported a Next.js dev overlay with repeated console errors:

```text
[BrowserRegistry] park failed (detach) "xmux webview 'xmux-browser-...' not found"
```

### Root Cause

The previous resize/cleanup hardening made `detach`, `setSlotHidden`, and resize suspension more aggressive, but `parkNativeWebview()` still called Tauri `set_bounds` and `set_visible(false)` even when the registry session had not created a native child webview yet. When React detached a browser slot before `xmuxWebviewCreate` completed, Rust correctly returned `not found`; the frontend incorrectly logged it as `console.error`, which made Next.js show the error overlay.

A second related case existed when Rust had already destroyed a stale child webview and a late park/hide call raced behind it. That `not found` response is an idempotent cleanup result, not a user-facing failure.

### Fixes Implemented

- `parkNativeWebview()` now updates frontend state but skips Tauri bridge calls until `session.created` is true.
- Missing native webview errors during park/hide/destroy are treated as cleanup races and do not call `console.error`.
- `destroyNativeWebview()` only sends park/hide/destroy bridge calls when the registry knows a native child had been created; pending-create cleanup is still handled by the existing post-create disposed guard.

### Verification

| Command / Check | Result |
| --- | --- |
| `npm run test -- --run __tests__/BrowserRegistry.native-lifecycle.test.ts __tests__/BrowserSlot.native-bounds.test.tsx __tests__/xmux.browser-url-chrome.test.tsx __tests__/xmux.registry.test.tsx __tests__/blockLayout.destroy.test.ts` | Pass: 5 files / 25 tests. Existing jsdom canvas warning only. |
| `npm run typecheck` | Pass |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| Browser console check on `/xmux` | Pass. Added and closed a browser tab; `registryErrorsAfter 0`. |
| `npm run docs:check` | Pass |
| `npm run standards:check` | Pass with existing P2 hard-coded color warning. |
| `npm run build` | Pass. Existing Turbopack dynamic file-tracing warnings remain in `app/api/chat/tools/file/route.ts`. |
