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
| F31-S13 | Drag split dividers left/right and up/down while a native browser page is visible. | Native webview keeps drawing stale content at old bounds or intercepts drag events. | `BrowserRegistry.native-lifecycle.test.ts` asserts resize suspension parks native webviews and restores them only after resume. | Tauri desktop: drag vertical and horizontal split handles around GitHub/Google and verify no stale native surface remains. | Unit covered; browser smoke covered; Tauri E2E candidate. | User resize ghost report |
| F31-S14 | Close the browser pane after split resizing and browser tab churn. | React block disappears but native webview remains as an undeletable overlay. | `XmuxView.handleCloseBlock` now tears down block items before `removeBlock`; `blockLayout.destroy.test.ts` keeps destroy coverage. | Tauri desktop: create/close browser tabs 20 times, close the browser pane, verify no native surface remains. | Unit covered; browser smoke covered; Tauri E2E candidate. | User cannot delete browser pane report |
| F31-S15 | Submit `localhost:43187/project-progress-dashboard` while a native browser session is still being created. | URL input state changes, but native webview was created with the old remote URL and never replays the latest local URL. | `BrowserRegistry.native-lifecycle.test.ts` replays latest local URL after pending native create resolves. | Tauri desktop: immediately submit local dashboard URL after opening a new browser pane; verify content switches from remote page to dashboard. | Unit covered; Tauri E2E candidate. | User local URL report |
| F31-S16 | Submit the same local dashboard URL in two browser panes/tabs. | A stale/missing native child or bad singleton/PID assumption lets only one browser surface load the project URL. | `BrowserRegistry.native-lifecycle.test.ts` allows multiple native panes to navigate to the same local URL and recreates stale native children with the latest URL. | Tauri desktop: open two browser panes and submit the same local URL in both repeatedly. | Unit covered; Tauri E2E candidate. | User PID question |
| F31-S17 | In one pane, open several browser tabs, navigate the newest tab, then click back to older browser tabs. | Earlier tabs become black because an async native hide from inactive state is not followed by a real native show. | `BrowserRegistry.native-lifecycle.test.ts` restores hidden tabs on active switch and repairs late hide completion. | Tauri desktop: create three browser tabs in one pane, navigate GitHub/Google/Yahoo/local dashboard, switch back through each tab repeatedly. | Unit covered; Tauri E2E candidate. | User same-pane black tab report |

## Unit Test Backlog

| Priority | Scenario | Proposed Test |
| --- | --- | --- |
| P1 | S03 focus black pane | Keep existing `does not hide the active browser content when the URL input receives focus` test as required regression coverage. |
| P1 | S10 pending create close race | Keep native lifecycle test; extend if new registry states are added. |
| P1 | S15 pending create local navigation | Keep `replays the latest local URL when navigation changes while native create is pending`. |
| P1 | S16 stale native child local navigation | Keep `recreates a stale native webview and preserves the requested local URL`. |
| P1 | S16 no singleton local browser | Keep `allows multiple native browser panes to load the same local project URL`. |
| P1 | S17 browser tab restore | Keep `shows a previously hidden native browser when its pane tab becomes active again`. |
| P1 | S17 late hide repair | Keep `repairs a late native hide that resolves after the user switches back to a browser tab`. |
| P1 | S13 resize suspension | Keep `parks native webviews during split resize and restores them only after resume` as required regression coverage. |
| P2 | S11 route leave cleanup | Add a focused `XmuxView` unmount test if future route cleanup changes. |
| P2 | S12 resize/pane movement | Add a BrowserSlot event-level test if pane resizing is refactored away from continuous bounds polling. |
| P2 | S14 pane close ownership | Add a focused `XmuxView` close-pane test if close handling moves out of `handleCloseBlock`. |

## E2E Candidate Backlog

| Priority | Scenario | E2E Flow |
| --- | --- | --- |
| P0 | S02 + S03 + S04 | Tauri desktop: open `/xmux`, select Project Manager, focus URL, type `google.com`, submit, verify pane does not black out. |
| P0 | S09 + S10 | Tauri desktop: open two browser tabs, navigate remote URLs, close/switch rapidly, verify no residual native surface. |
| P0 | S13 + S14 | Tauri desktop: drag vertical and horizontal splits around a browser pane, then create/delete browser tabs at least 20 times and close the pane. |
| P1 | S07 | Browser mode or Tauri: submit localhost dashboard URL and assert iframe/pane renders expected page content. |
| P1 | S15 + S16 | Tauri desktop: open/close/reopen browser panes, submit `localhost:43187/project-progress-dashboard` at least 10 times across two panes, verify no stale remote page remains visible. |
| P1 | S17 | Tauri desktop: in one pane, create at least three browser tabs, switch newest -> oldest -> middle -> newest ten times, verify no black pane appears. |
| P1 | S12 | Resize split panes around a native browser and assert URL chrome remains clickable. |

## Conversion Rule

When a future debug session reveals a new user path:

1. Add it to this matrix with a new scenario ID.
2. Mark whether it belongs to unit/integration, browser-mode E2E, or Tauri-native E2E.
3. Add or update a failing regression test before implementing the fix when feasible.
4. Append verification evidence to `dev-log.md`.
5. Summarize the root cause and lessons in `debug-retro.md`.
