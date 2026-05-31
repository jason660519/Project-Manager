# F34 Test Scenarios - Xmux AI Assistant Block and Browser Tools

## Purpose

This scenario map converts real Xmux browser-tool debugging experience into reusable TDD and E2E coverage. F34 covers the docked AI Assistant, browser chrome operator tools, Select Element, Console, and CSS Inspector. The 2026-05-31 Select Element desktop regression is now treated as a required scenario set because it exposed a gap between web-mode confidence and Tauri-native behavior.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F34-S01 | User opens `/xmux`, uses the docked AI Assistant under Workspaces, and types a question. | Xmux loses the assistant surface or routes the user away from the workspace. | Existing docked assistant render and chat input coverage. | Browser: open `/xmux`, select workspace, type into docked assistant. | Covered; E2E candidate. | Original feature path |
| F34-S02 | User interacts with the browser pane while the docked assistant remains visible. | Browser interaction hides, overlaps, or replaces the assistant. | Existing Xmux layout and ChatPanel docked mode coverage. | Browser/Tauri: interact with browser pane and verify assistant remains visible. | Covered; E2E candidate. | Original feature path |
| F34-S03 | User opens browser menu and chooses Copy Current URL. | Clipboard receives stale or wrong browser URL. | Browser chrome action tests with clipboard mock. | Browser/Tauri: navigate a tab, copy current URL, verify clipboard/status. | Covered; E2E candidate. | Original feature path |
| F34-S04 | User clicks Select Element and expects an active visual/tool state. | User cannot tell whether element selection mode is armed. | `xmux.browser-url-chrome.test.tsx` covers browser chrome interaction; additional pressed-state test should remain required when Select Element refactors. | Browser/Tauri: click Select Element and verify button pressed/highlight state before selecting. | Partially covered; E2E candidate. | User report |
| F34-S05 | User clicks Select Element, clicks a page element, and expects DOM context in the left AI Assistant input. | Primary inspect-and-ask workflow silently fails. | `chat.input.test.tsx`, `chat.panel.test.tsx`, `xmux.selectedElementSnippet.test.ts`; Tauri self-test exercises native callback and assistant snippet insertion. | `npm run e2e:tauri:f34-select` opens a Tauri-only self-test route, selects `#first-target` inside a native webview, and verifies `[xmux element: ...]`, `selector`, and `domTree` enter the simulated assistant input. | Automated; passing locally on 2026-05-31. | User report and root cause |
| F34-S06 | User repeats Select Element after one successful selection. | One-shot state or stale native callback prevents iterative inspection. | Tauri self-test performs two consecutive native `xmuxWebviewSelectElement` captures with different targets. | `npm run e2e:tauri:f34-select` selects `#first-target`, then `#second-target`, and fails if the second payload reuses stale selector state. | Automated; passing locally on 2026-05-31. | User report |
| F34-S07 | User collapses the AI Assistant, then selects an element. | Capture succeeds but user cannot see where the DOM context went. | `XmuxView` listener opens assistant on `pm:xmux-selected-element`; add focused component test if dock behavior refactors. | Browser/Tauri: close assistant, select element, verify assistant opens and input contains snippet. | Integration covered by implementation; E2E candidate. | Debug finding |
| F34-S08 | User opens web app at `localhost` and browser pane target uses `127.0.0.1` on the same port. | Browser fallback cannot inspect iframe DOM due to loopback cross-origin mismatch. | `BrowserRegistry.iframe-preview.test.ts` covers loopback origin rewrite. | Browser: open `localhost` app, navigate pane to `127.0.0.1:<same-port>/xmux`, run Select Element. | Unit covered; browser E2E candidate. | Debug finding |
| F34-S09 | Selected page element has a large DOM subtree, long text, many children, and long outerHTML. | Assistant input becomes too large, slow, or unusable. | `xmux.selectedElementSnippet.test.ts` bounds large payloads. | Browser/Tauri: select a dense table/card and verify snippet is readable and truncated. | Unit covered; E2E candidate. | Boundary case |
| F34-S10 | Native Select Element callback arrives after a stale, superseded, timeout, pane destroy, or route-leave path. | Old callbacks pollute the next selection or hang pending commands. | Proposed Rust/bridge test for nonce and waiter cleanup; `cargo check` confirms compile only. | Tauri: start select, cancel/close pane, start select again, verify no stale payload. | Pending. | Root cause |
| F34-S11 | User presses Escape while Select Element is armed. | Select mode cannot be cancelled or leaves cursor/listeners active. | Proposed unit/native injected-script behavior test. | Browser/Tauri: arm Select Element, press Escape, verify mode exits cleanly and no snippet is inserted. | Pending. | Boundary case |
| F34-S12 | User clicks blank page/body area while Select Element is armed. | Blank click creates misleading DOM payload or loses mode cleanup. | Proposed payload parser test for `{ cancelled: true, reason: 'blank-area' }`. | Browser/Tauri: click blank area and verify assistant input is unchanged with clear status. | Pending. | Boundary case |
| F34-S13 | User opens Console drawer, filters logs, clears logs, and toggles drawer repeatedly. | Console panel shows placeholder/stale logs or overlaps browser chrome. | Frontend entry is hidden by `XMUX_BROWSER_CONSOLE_HIDDEN`; backend console capture wrappers remain for dependent code. `xmux.browser-url-chrome.test.tsx` verifies no Console entry is rendered and native console read/clear is not called from UI. | No active E2E while hidden; re-enable only after a Tauri-native console reliability pass. | Hidden on 2026-05-31; backend retained. | User request / dependency scan |
| F34-S14 | User opens CSS Inspector, selects an element, then reviews DOM tree, Design tab, CSS tab, box model, class list, and outerHTML. | Inspector shows fake or stale selected-element data. | Existing selected inspector output coverage in `xmux.browser-url-chrome.test.tsx`; snippet compaction adds payload safety. | Browser/Tauri: select element and verify inspector panels reflect the selected node. | Partially covered; E2E candidate. | Original feature path |
| F34-S15 | User opens browser action menu and uses hard reload, clear cookies, clear cache/history, and zoom. | Unsupported mode fails silently or native bridge call is missing. | Bridge wrapper tests and chrome action tests when changed. | Tauri: exercise browser maintenance actions and verify status/native behavior. | Candidate. | Original feature path |
| F34-S16 | Developer changes native Select Element implementation and web tests still pass. | Native-only regression escapes review. | `npm run e2e:tauri:f34-select` asserts `__TAURI_INTERNALS__` is present and that native xmux webview commands handled the flow. | Tauri P0: run the self-test whenever `src-tauri/src/xmux_webview.rs` or Select Element bridge behavior changes. | Automated; passing locally on 2026-05-31. | Debug lesson |

## Unit Test Backlog

| Priority | Scenario | Proposed Test |
| --- | --- | --- |
| P0 | F34-S05 | Keep `chat.input.test.tsx`, `chat.panel.test.tsx`, and `xmux.selectedElementSnippet.test.ts` as required coverage for selected-element insertion and snippet formatting. |
| P0 | F34-S08 | Keep `BrowserRegistry.iframe-preview.test.ts` to prevent loopback same-port iframe origin regressions. |
| P0 | F34-S09 | Keep large payload compaction test; expand with deep nesting if compaction rules change. |
| P1 | F34-S04 | Add or preserve a chrome-level test asserting Select Element pressed/highlight state remains active while selection is armed. |
| P1 | F34-S06 | Keep `npm run e2e:tauri:f34-select` as native repeated-selection coverage; add a pure unit event test if assistant input append semantics change. |
| P1 | F34-S07 | Add `XmuxView` dock-state test: selected-element event opens the assistant when collapsed. |
| P1 | F34-S10 | Add Rust or bridge-level test for `pm-xmux-select://` label/nonce/payload parsing and waiter cleanup on superseded/eval-failed/destroy. |
| P2 | F34-S11 | Add injected-script cancellation contract test for Escape returning `{ cancelled: true }`. |
| P2 | F34-S12 | Add selected-element parser test to ignore blank-area cancellation payloads. |
| P2 | F34-S13 | Keep hidden-entry regression: Console button/panel must not render while `XMUX_BROWSER_CONSOLE_HIDDEN` is true; add clear/filter tests only if the UI is re-enabled. |
| P2 | F34-S14 | Add DOM tree selection and CSS Inspector tab tests when inspector data model changes. |

## E2E Candidate Backlog

| Priority | Scenario | E2E Flow |
| --- | --- | --- |
| P0 | F34-S05 | Automated Tauri self-test: `npm run e2e:tauri:f34-select` creates a native webview fixture, arms Select Element, clicks `#first-target` through native eval, and verifies assistant snippet content. |
| P0 | F34-S06 | Automated Tauri self-test: same command repeats selection on `#second-target` and verifies a fresh payload. |
| P0 | F34-S16 | Automated Tauri self-test: same command fails outside Tauri and records runtime/native command evidence in `.project-manager/e2e-reports/`. |
| P1 | F34-S04 | Browser/Tauri: Select Element button shows pressed/highlight state while armed, then returns to normal after cancel or completed selection. |
| P1 | F34-S07 | Browser/Tauri: collapse assistant, select element, verify assistant opens and receives context. |
| P1 | F34-S08 | Browser mode: run `/xmux` on `localhost`, navigate pane to `127.0.0.1` same port, verify Select Element can still inspect DOM. |
| P1 | F34-S09 | Browser/Tauri: select a dense DOM region and verify snippet remains bounded and readable. |
| P1 | F34-S10 | Tauri desktop: start Select Element, close browser pane or route away, reopen and select again; verify no stale callback or hang. |
| P2 | F34-S11 | Browser/Tauri: press Escape after arming Select Element and verify no snippet insertion. |
| P2 | F34-S12 | Browser/Tauri: click blank/body area after arming Select Element and verify cancellation is clean. |
| P2 | F34-S13 | Deferred while hidden: if re-enabled, Tauri desktop must use real page logs, filter, clear, hide/show before exposing the entry again. |
| P2 | F34-S14 | Tauri desktop: use CSS Inspector after Select Element and verify selected node, Design tab, CSS tab, box model, and class list. |
| P2 | F34-S15 | Tauri desktop: exercise reload, clear cookies/cache/history, zoom in/out/reset, and verify user-visible status. |

## Conversion Rule

When a future Xmux browser-tool debug session reveals a new real user path:

1. Add a stable `F34-Sxx` row to the Scenario Matrix with the user operation, failure risk, and source.
2. Decide whether the scenario belongs to unit/integration coverage, browser-mode E2E, Tauri-native E2E, or a manual smoke gate.
3. Add or update a failing focused test before the fix when feasible. For native-only behavior, at minimum add a bridge/registry/Rust contract test plus a Tauri E2E candidate.
4. Append factual verification evidence to `debug-retro.md` and `dev-log.md`; do not claim desktop verification unless Tauri was rebuilt/restarted and checked.
5. Update `.project-manager/config.json` `updatedAt` and feature notes if the scenario changes feature risk or readiness.
6. During quarterly review, promote repeated P0/P1 candidates into the shared E2E suite and retire scenarios that are fully covered by stable automated tests.

## Storage And Retrieval Standard

| Artifact | Location | Retrieval Use |
| --- | --- | --- |
| Debug process and root cause | `.project-manager/features/F34/debug-retro.md` | Engineers search by `F34`, `/xmux`, `Select Element`, `Tauri`, `pm-xmux-select`, or touched file names. |
| Test scenario backlog | `.project-manager/features/F34/test-scenarios.md` | TDD/E2E planning pulls scenario IDs and priority directly from this matrix. |
| Implementation history | `.project-manager/features/F34/dev-log.md` | Chronological engineering notes and command evidence. |
| Dashboard metadata | `.project-manager/config.json` paths for `debugRetro` and `testScenarios` | Project dashboard links to durable artifacts without duplicating content. |
