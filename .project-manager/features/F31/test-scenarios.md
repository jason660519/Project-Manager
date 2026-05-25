# F31 Test Scenarios - xmux Native Browser URL Chrome Stability

## Purpose

This scenario map converts the F31 debugging experience into reusable TDD and E2E coverage. It is intentionally user-path oriented: every scenario starts from something a real user did or could reasonably do in xmux.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F31-S01 | Add/select browser tab for `@project-manager/app`; default URL is GitHub repo. | Wrong homepage or missing default URL breaks expected browser startup. | `xmux.browser-url-chrome.test.tsx` asserts GitHub default appears in `Browser URL`. | Open `/xmux`, select workspace, verify browser URL is project GitHub URL. | Unit covered; E2E candidate. | User report |
| F31-S02 | Click GitHub URL input and edit part of the URL. | Native webview covers React chrome or input disappears. | `xmux.browser-url-chrome.test.tsx` asserts input remains in DOM and editable. | Tauri desktop: click URL input while GitHub renders; verify input remains visible. | Unit covered; Tauri E2E candidate. | User screenshot |
| F31-S03 | Click URL input while browser content is visible. | Focus hides active webview and creates a black pane. | `xmux.browser-url-chrome.test.tsx` asserts focus does not call `setSlotHidden` for active item. | Tauri desktop: visible page remains visible after URL input focus. | Unit covered; Tauri E2E candidate. | User follow-up |
| F31-S04 | Type `google.com` and press Enter. | Protocol-less URL fails normalization or navigation is invisible because webview is parked. | `xmux.browser-url-chrome.test.tsx` asserts `http://google.com` submit and no active hide on focus. | Submit `google.com`; verify tab label and native content state. | Unit covered; E2E candidate. | User follow-up |
| F31-S05 | Type `https://google.com/search?q=xmux` and press Enter. | Full HTTPS URL gets corrupted by normalization. | `xmux.browser-url-chrome.test.tsx` keeps HTTPS URL unchanged. | Submit full search URL; verify visible navigation or expected remote rendering behavior. | Unit covered; E2E candidate. | Debug expansion |
| F31-S06 | Type `about:blank` and press Enter. | Special scheme is incorrectly prefixed with `http://`. | `xmux.browser-url-chrome.test.tsx` keeps `about:blank` unchanged. | Submit `about:blank`; verify pane does not crash or leave old overlay. | Unit covered; E2E candidate. | Boundary case |
| F31-S07 | Type `localhost:43187/xmux` or local dashboard URL and click Go. | Local URL normalization or iframe/native backend routing fails. | `xmux.browser-url-chrome.test.tsx` normalizes localhost URL; browser smoke verified localhost render. | Submit local route; verify Project Manager page renders inside browser pane. | Unit covered; browser smoke covered. | Debug verification |
| F31-S08 | Clear URL field and do not submit. | Draft state navigates unexpectedly or field resets while editing. | `xmux.browser-url-chrome.test.tsx` asserts empty draft stays visible and does not call `onNavigate`. | Clear field, blur, switch panes; verify no unexpected navigation. | Unit covered; optional E2E. | Boundary case |
| F31-S09 | Switch from browser tab to terminal/folder tab. | Hidden native webview remains over active non-browser content. | `BrowserSlot.native-bounds.test.tsx` asserts inactive slot calls `setSlotHidden`. | Tauri desktop: switch tabs/panes and verify no native overlay remains. | Unit covered; Tauri E2E candidate. | User residual overlay report |
| F31-S10 | Close browser tab/pane while page is loading. | Pending native create resolves after close and leaves sticky overlay. | `BrowserRegistry.native-lifecycle.test.ts` destroys pending-create webview after close. | Tauri desktop: close tabs quickly during navigation; verify no residual surface. | Unit covered; Tauri E2E candidate. | User residual overlay report |
| F31-S11 | Navigate away from `/xmux`. | Native webview survives route change. | `XmuxView` route-leave cleanup plus registry tests. | Leave `/xmux` for dashboard; verify no browser surface remains. | Integration covered; Tauri E2E candidate. | Debug finding |
| F31-S12 | Browser slot has invalid or overlapping bounds during layout settle. | Native webview covers URL chrome. | `BrowserSlot.native-bounds.test.tsx` and `browser-bounds.test.ts` reject unsafe bounds and hide slot. | Resize xmux panes; verify URL chrome remains usable. | Unit covered; E2E candidate. | Root cause |

## Unit Test Backlog

| Priority | Scenario | Proposed Test |
| --- | --- | --- |
| P1 | S03 focus black pane | Keep existing `does not hide the active browser content when the URL input receives focus` test as required regression coverage. |
| P1 | S10 pending create close race | Keep native lifecycle test; extend if new registry states are added. |
| P2 | S11 route leave cleanup | Add a focused `XmuxView` unmount test if future route cleanup changes. |
| P2 | S12 resize/pane movement | Add a test that bounds are recomputed after split resize if pane resizing is refactored. |

## E2E Candidate Backlog

| Priority | Scenario | E2E Flow |
| --- | --- | --- |
| P0 | S02 + S03 + S04 | Tauri desktop: open `/xmux`, select Project Manager, focus URL, type `google.com`, submit, verify pane does not black out. |
| P0 | S09 + S10 | Tauri desktop: open two browser tabs, navigate remote URLs, close/switch rapidly, verify no residual native surface. |
| P1 | S07 | Browser mode or Tauri: submit localhost dashboard URL and assert iframe/pane renders expected page content. |
| P1 | S12 | Resize split panes around a native browser and assert URL chrome remains clickable. |

## Conversion Rule

When a future debug session reveals a new user path:

1. Add it to this matrix with a new scenario ID.
2. Mark whether it belongs to unit/integration, browser-mode E2E, or Tauri-native E2E.
3. Add or update a failing regression test before implementing the fix when feasible.
4. Append verification evidence to `dev-log.md`.
5. Summarize the root cause and lessons in `debug-retro.md`.
