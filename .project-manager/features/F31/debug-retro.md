# F31 Debug Retro - xmux Native Browser URL Chrome Stability

## Summary

F31 covered two connected desktop/Tauri browser defects:

1. The native browser content could cover the React URL chrome, making the URL input appear to disappear.
2. After the first fix, clicking the URL input could park the active native browser offscreen, turning the pane black and preventing visible navigation after typing a new URL.

Both failures were caused by treating Tauri child webviews like DOM content. Native webviews are OS surfaces, so z-index is not enough and hide/park calls must be scoped to true inactive or teardown states only.

## User-Reported Symptoms

| ID | Symptom | Evidence |
| --- | --- | --- |
| S1 | Browser tab defaults to GitHub, but the URL input disappears when the user tries to edit it. | Screenshot showed GitHub content directly under xmux pane tabs with no URL chrome visible. |
| S2 | After the overlay fix, clicking the URL input makes the browser pane black. Typing `google.com` does not visibly navigate. | User report and follow-up reproduction in browser smoke test. |
| S3 | Browser residual content can remain stuck on screen after close/switch. | User screenshot showed an old browser surface over unrelated panes. |

## Reproduction Paths

### R1 - URL Chrome Covered By Native Webview

1. Start Project Manager in Tauri desktop mode.
2. Open `/xmux`.
3. Select `@project-manager/app`.
4. Add or focus the browser tab that defaults to `https://github.com/jason660519/Project-Manager`.
5. Attempt to edit the URL.
6. Expected: URL input remains visible and editable.
7. Actual before fix: native GitHub webview covers the URL chrome.

### R2 - URL Focus Black Pane

1. Open `/xmux`.
2. Select a browser tab with visible GitHub content.
3. Click the `Browser URL` input.
4. Type `google.com`.
5. Press Enter or click Go.
6. Expected: browser content remains visible during editing and navigates to the submitted URL.
7. Actual before fix: active pane becomes black and remains black after submit.

### R3 - Sticky Native Overlay After Close

1. Open two browser panes or tabs.
2. Navigate one browser tab to a remote site.
3. Close or switch panes while the native webview create/navigation is still settling.
4. Expected: inactive/closed native webview is hidden or destroyed.
5. Actual before fix: native webview can remain visually stuck over other panes.

## Root Cause

| Defect | Root cause | Bad assumption |
| --- | --- | --- |
| URL chrome covered | Native webview bounds could include the BrowserContent root instead of the content slot below the URL toolbar. | React z-index can keep chrome above webview. |
| Black pane on URL focus | URL chrome focus set a chrome-interaction state that made BrowserSlot call `setSlotHidden(itemId)` for the active tab. | Focusing the URL bar is equivalent to hiding the native webview to protect chrome. |
| Sticky overlay | A pending native webview create could resolve after React already removed the session. | Destroying React state is enough to remove the OS child webview. |

## Final Fix

| Area | Change |
| --- | --- |
| Browser bounds | Native webview bounds are derived from the settled browser slot and adjusted with a chrome-safe top guard. |
| Browser focus | URL input focus no longer hides or parks the active native webview. |
| Browser lifecycle | `detach`, `destroy`, inactive slots, invalid bounds, route leave, and orphan cleanup still park native webviews offscreen before hiding or closing. |
| Native bridge | Tauri `set_bounds` uses an atomic rect update, and hide/destroy paths park the webview offscreen before visibility changes. |
| Route cleanup | Leaving `/xmux` destroys all browser sessions to prevent orphan OS surfaces. |

## Tests Added Or Updated

| Test file | Coverage |
| --- | --- |
| `__tests__/xmux.browser-url-chrome.test.tsx` | Default GitHub URL editing, URL focus must not call `setSlotHidden`, Enter/Go submit, `google.com`, full HTTPS URL, `about:blank`, localhost URL, empty draft. |
| `__tests__/BrowserSlot.native-bounds.test.tsx` | Chrome-safe native bounds, invalid bounds hide, inactive slot hide. |
| `__tests__/browser-bounds.test.ts` | Native bounds add chrome guard and reject unsafe geometry. |
| `__tests__/BrowserRegistry.native-lifecycle.test.ts` | Pending create after close is destroyed, hidden sessions park offscreen, orphan purge destroys registry sessions. |
| `__tests__/xmux.registry.test.tsx` | Existing browser input and tab lifecycle coverage. |
| `__tests__/blockLayout.destroy.test.ts` | Browser sessions are destroyed when layout blocks are removed. |

## Verification Evidence

| Command / Check | Result |
| --- | --- |
| `npm run test -- --run __tests__/BrowserRegistry.native-lifecycle.test.ts __tests__/BrowserSlot.native-bounds.test.tsx __tests__/browser-bounds.test.ts __tests__/xmux.browser-url-chrome.test.tsx __tests__/xmux.registry.test.tsx __tests__/blockLayout.destroy.test.ts` | Pass: 6 files / 24 tests. Existing jsdom canvas warning only. |
| `npm run typecheck` | Pass |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm run build` | Pass. Existing Turbopack dynamic file-tracing warnings remain in `app/api/chat/tools/file/route.ts`. |
| `npm run docs:check` | Pass |
| `npm run standards:check` | Pass with existing P2 hard-coded color warning. |
| Browser smoke on `http://localhost:43187/xmux` | Pass. Selected `@project-manager/app`, focused `Browser URL`, submitted `google.com`, `about:blank`, and `localhost:43187/project-progress-dashboard`; input stayed connected/visible and localhost rendered in the pane. |

## Lessons For Future TDD / E2E

1. For native webview bugs, a DOM assertion is not enough. Tests must also assert registry calls such as `setSlotHidden`, `setBounds`, `destroy`, and offscreen parking.
2. URL chrome focus is an active interaction state, not a hide condition.
3. Fixes for native overlays must include close/switch/route-leave races, not only the visible active-pane path.
4. User-reported screenshots should be converted into at least one unit regression and one E2E candidate before the feature is considered stable.
5. Real URL drafts must include remote, protocol-less, special-scheme, and localhost cases.

## Follow-Up Candidates

| Candidate | Reason |
| --- | --- |
| Tauri E2E smoke for `/xmux` native browser URL editing | Browser-mode automation cannot fully verify OS child webview layering. |
| Native webview lifecycle trace logging in debug builds | Would make future orphan/black-pane reports easier to correlate with registry state. |
| Dashboard artifact gate for `debug-retro.md` and `test-scenarios.md` | Prevent expensive debugging knowledge from remaining only in chat transcripts. |
