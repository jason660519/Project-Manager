# F34 Debug Retro - Xmux Select Element Desktop Capture

## Summary

This retro captures the 2026-05-31 debug session for Xmux Browser Select Element. The user reported that Select Element behaved correctly in the web app but still failed in the desktop app. The final defect was desktop/Tauri-specific: the native child webview capture path used `eval_with_callback` with a Promise that only resolved after a future click. The native callback returned too early, so the host received an empty or unusable payload, exited select mode, and never inserted selected DOM context into the docked AI Assistant input.

The retained lesson is that Xmux browser tools have two execution paths:

| Path | Runtime | Risk |
| --- | --- | --- |
| Browser fallback | same-page iframe | DOM and jsdom tests can cover most event/input behavior, but loopback host mismatches can make iframe access fail. |
| Desktop native | Tauri child webview | Native callback, navigation, visibility, and OS-surface lifecycle must be tested or manually smoked separately. Web success is not desktop proof. |

## User-Reported Symptoms

| ID | Symptom | User Impact | Runtime | Evidence |
| --- | --- | --- | --- | --- |
| S1 | Clicking Select Element did not leave a clear highlighted/pressed tool state. | User could not tell whether select mode was active. | Web and desktop concern | User report during Xmux browser tool testing. |
| S2 | After selecting an element, DOM tree information was not pasted into the left AI Assistants input. | The primary workflow, inspect page then ask assistant about selected DOM, was blocked. | Desktop confirmed; web needed verification | User report and desktop follow-up. |
| S3 | Select Element exited after one selection or appeared to return to normal mode without a useful payload. | User could not repeatedly select elements for iterative inspection. | Desktop confirmed | User report. |
| S4 | Web app became normal after fixes, but desktop app still had the same issue. | Browser-mode verification gave false confidence for a native-only bug. | Desktop only | User follow-up: web normal, desktop still broken. |
| S5 | Browser fallback could report preview document not ready when using `127.0.0.1` instead of `localhost`. | Same local app could fail select-mode DOM access depending on host spelling. | Web iframe fallback | Debug finding during browser-mode smoke. |

## Reproduction Paths

### R1 - Desktop Select Element Does Not Insert DOM Context

1. Start Project Manager in Tauri desktop mode.
2. Open `/xmux`.
3. Open or focus a browser pane.
4. Click the browser chrome Select Element control.
5. Click a visible page element inside the native browser.
6. Expected: Select Element captures selector, DOM tree, outerHTML, style summary, and appends a `[xmux element: ...]` snippet to the docked AI Assistant input.
7. Actual before fix: the desktop path returned an empty or unusable result; the assistant input did not receive DOM tree information.

### R2 - Desktop Select Element Mode Ends Without Useful Payload

1. Open `/xmux` in Tauri desktop mode.
2. Click Select Element.
3. Click one page element.
4. Try to continue selecting or inspect the assistant input.
5. Expected: the tool can be invoked repeatedly, and every completed selection produces usable context.
6. Actual before fix: the mode effectively ended after one click without useful pasted DOM context.

### R3 - Web Fallback Loopback Host Mismatch

1. Open the web app at `http://localhost:43187/xmux`.
2. Navigate the browser pane to a same-port local URL with host `127.0.0.1`.
3. Click Select Element.
4. Expected: iframe preview remains same-origin and the app can inspect the DOM.
5. Actual before fix: `localhost` vs `127.0.0.1` made the iframe cross-origin, so the preview document was not accessible.

### R4 - Hidden Assistant Target

1. Collapse or hide the docked AI Assistant.
2. Select an element from the Xmux browser.
3. Expected: the assistant dock opens and receives the selected-element snippet.
4. Actual risk before fix: payload delivery could be invisible if the target assistant area was closed.

## Root Cause

| Root Cause ID | Finding | How It Was Isolated | Wrong Assumption |
| --- | --- | --- | --- |
| RC1 | `xmux_webview_select_element` used Tauri `eval_with_callback(select_element_script())`, but the script returned a Promise that resolved only after a future click. The native eval callback did not wait for that later user event. | Compared the working web path with `src-tauri/src/xmux_webview.rs`; the desktop path returned before injected click listeners had a selected element. | A Promise returned from native eval can be used as a long-lived event channel. |
| RC2 | The host had no native callback bridge for a future click inside the child webview. | Verified that the only callback was the immediate eval callback, not a click-time IPC/navigation callback. | The native child webview can report asynchronous DOM events through the original eval call. |
| RC3 | The selected-element payload could be very large because full DOM/style payloads were inserted directly into chat input. | Reviewed Select Element payload fields and assistant snippet formatting. | More DOM context is always better, regardless of input size and performance. |
| RC4 | Web fallback same-origin assumptions failed when the same local server was addressed through different loopback hostnames. | Manual browser smoke showed `localhost` working and `127.0.0.1` failing for the same port. | All loopback hostnames are equivalent for iframe DOM access. |
| RC5 | The left assistant dock was not forced open when a selected-element event arrived. | Reviewed `XmuxView` dock state handling and event flow. | Event insertion is enough even if the target UI is hidden. |

## Final Fix

| Area | Change | Files |
| --- | --- | --- |
| Native desktop callback | Replaced delayed Promise return with an injected click listener that reports through a private Tauri IPC resolve command. Tauri validates label and nonce before sending the JSON payload to the pending command. | `src-tauri/src/xmux_webview.rs`, `src-tauri/src/lib.rs` |
| Native state management | Extended `XmuxWebviewState` from a label set to a registry with labels and select waiters. Each selection gets a nonce. Superseded, eval-failed, timeout, destroy, and destroy-all paths clear pending waiters. | `src-tauri/src/xmux_webview.rs`, `src-tauri/src/lib.rs` |
| Payload shaping | Native capture now sends useful bounded inspection data: selector, cssPath, class list, computed style summary, box model, element summary, ancestry, compact DOM tree, and truncated outerHTML. | `src-tauri/src/xmux_webview.rs` |
| Assistant insertion | Selected-element snippets are compacted before insertion, include style/layout summary fields, and remain bounded for large DOM trees. | `lib/xmux/selectedElementSnippet.ts` |
| Assistant visibility | Xmux opens the docked AI Assistant when `pm:xmux-selected-element` fires. | `app/ui/views/XmuxView.tsx` |
| Browser fallback | Loopback iframe preview URLs are rewritten to the current page origin when host differs but port is the same local app. | `components/browser/BrowserRegistry.ts` |
| Regression tests | Added loopback iframe origin regression and large selected-element snippet compaction coverage. | `__tests__/BrowserRegistry.iframe-preview.test.ts`, `__tests__/xmux.selectedElementSnippet.test.ts` |

## Tests Added Or Updated

| Test file | Coverage | Status |
| --- | --- | --- |
| `__tests__/BrowserRegistry.iframe-preview.test.ts` | Local iframe fallback rewrites `127.0.0.1` / `localhost` same-port URLs to the current origin so DOM access remains possible. | Added |
| `__tests__/xmux.selectedElementSnippet.test.ts` | Large selected DOM payloads are compacted before being inserted into the AI Assistant input. | Updated |
| `__tests__/chat.input.test.tsx` | Existing selected-snippet input append behavior remains covered. | Re-run |
| `__tests__/chat.panel.test.tsx` | Existing selected-element event flow into assistant panel remains covered. | Re-run |
| `__tests__/xmux.browser-url-chrome.test.tsx` | Browser chrome interaction regressions remain covered while Select Element behavior changes. | Re-run |

## Verification Evidence

| Command / Check | Result |
| --- | --- |
| `npm run test -- --run __tests__/BrowserRegistry.iframe-preview.test.ts __tests__/xmux.selectedElementSnippet.test.ts __tests__/chat.input.test.tsx __tests__/chat.panel.test.tsx __tests__/xmux.browser-url-chrome.test.tsx` | Pass: 5 files / 46 tests. |
| `npm run typecheck` | Pass. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass. |
| `git diff --check` | Pass. |
| Browser smoke on `http://localhost:43187/xmux` | Pass. Select Element stayed pressed after start, captured an element, and inserted `[xmux element: ...]` into the AI Assistant input. |
| Desktop user confirmation after restart/rebuild | Pass. User confirmed the desktop app finally behaved normally. |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | Not used as a clean gate because the repository has pre-existing Rust formatting diffs outside this fix. Manual formatting was kept scoped to touched lines. |

## Lessons For Future TDD / E2E

| Lesson | TDD / E2E Implication |
| --- | --- |
| Web passing is not desktop passing for Xmux browser tools. | Any feature that touches `src-tauri/src/xmux_webview.rs` needs a Tauri-native smoke candidate, even if browser/jsdom tests pass. |
| Native eval is not a durable event channel. | Tests and design reviews should reject native APIs that rely on a one-shot eval callback for future user events. Use an explicit callback bridge such as a Tauri IPC resolve command. |
| Select Element is a workflow, not a single bridge call. | Coverage must include pressed state, page click, payload parsing, assistant insertion, assistant visibility, and repeated invocation. |
| DOM context must be bounded. | Unit tests should include large DOM trees, long outerHTML, many children, and deep nesting. |
| Loopback hosts are not same-origin in the browser. | Browser fallback tests should include `localhost`, `127.0.0.1`, `0.0.0.0`, and `::1` where practical. |
| Hidden target UI can make successful events look broken. | E2E should collapse the assistant dock, select an element, and verify the dock opens with context. |
| Cancel, timeout, and destroy are part of correctness. | Unit/Rust-side tests or manual scripts should cover Escape, blank-area click, timeout, superseded select, pane close, and route leave. |

## Follow-Up Candidates

| Candidate | Reason |
| --- | --- |
| Add Tauri-native E2E smoke for Select Element | The root cause was native-only and cannot be fully proven by jsdom or iframe browser tests. |
| Add Rust unit test or integration harness for native Select Element IPC resolve handling | The nonce/label/payload validation is safety-critical for repeated selection and stale callback prevention. |
| Add an E2E flow that selects multiple elements consecutively | User explicitly noticed that select mode felt one-shot and could not support iterative inspection. |
| Add assistant-dock collapsed-state E2E | Confirms selected context is visible to the user, not just dispatched. |
| Add debug trace logs behind a development flag | Future native callback failures should show select nonce lifecycle without exposing page data. |

## Retention Implementation Path

| Item | Standard |
| --- | --- |
| Storage location | Keep durable debug knowledge in `.project-manager/features/F34/debug-retro.md` and scenario coverage in `.project-manager/features/F34/test-scenarios.md`. Register both in `.project-manager/config.json` under `paths.debugRetro` and `paths.testScenarios`. |
| Source of truth | The code repository is the source of truth for feature-linked retros and test scenario backlog. External wiki pages may link to these files but should not duplicate them. |
| Format | Use stable Markdown headings from `docs/project-process/commands/debug-retro.md`; use scenario IDs in `F34-Sxx` format; keep verification factual and mark commands not run. |
| Searchability | Include feature ID, affected route (`/xmux`), runtime (`web iframe`, `Tauri native webview`), user path, touched files, and test filenames in the artifact. |
| Update trigger | Every expensive debug session that produces a root cause, new user path, or missed test scenario must update `debug-retro.md`, `test-scenarios.md`, and the feature dev log before closing. |
| Quarterly review | Once per quarter, review all feature `debug-retro.md` and `test-scenarios.md` files, promote repeated candidates into shared E2E suites, remove obsolete candidates, and update dashboard metadata freshness. |
