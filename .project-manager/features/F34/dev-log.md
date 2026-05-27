# F34 Dev Log — Xmux AI Assistant Block and Browser Tools

## 2026-05-27 17:06 AEST — Feature kickoff

### Request

User asked to start implementation after first creating or updating the dashboard work ID and writing Feature Spec, TDD Spec, user-scenario tests, and Dev Logs for follow-up engineers.

### Planned implementation

- Create F34 dashboard entry and feature artifacts.
- Add AI Assistant as first-class Xmux block item.
- Extend browser chrome with the requested utility menu and Go-left inspector icons.
- Add typed native bridge wrappers for stable webview actions.
- Keep screenshot/area screenshot and advanced inspector behavior honest when native implementation is incomplete.

### Initial risk decisions

- Reuse existing `ChatPageClient embedded`; do not fork chat UI.
- Use Tauri bridge for native webview commands; do not call `invoke()` directly from React components.
- Treat screenshot and DOM/CSS inspection as staged native work because child webviews paint above React overlays.

## 2026-05-27 17:16 AEST — Implementation pass

### Implemented

- Added `assistant` as a first-class Xmux block item.
- Added pane toolbar Bot action to create an AI Assistant tab.
- Reused existing `ChatPageClient embedded` with `currentView: 'xmux'` context.
- Added browser chrome Select Element, Console, CSS Inspector, and action menu controls.
- Added Tauri bridge wrappers and Rust commands for native webview URL lookup, reload, eval, zoom, clear browsing data, and clear cookies.
- Added Select Element injection script that captures DOM summary and writes it to clipboard from inside the native page context.
- Added focused tests for assistant tab creation and browser toolbar actions.

### Staged follow-ups

- Screenshot and area screenshot controls are visible but guarded until the native snapshot/crop pipeline is implemented.
- Console drawer and CSS Inspector drawer are present; full page log streaming and computed-style capture need the next native injection pass.
- Browser mode intentionally reports native-required status for native-only inspection actions.

### Verification

- `npm run test -- __tests__/xmux.registry.test.tsx __tests__/xmux.browser-url-chrome.test.tsx __tests__/browser.embed.test.ts __tests__/BrowserRegistry.native-lifecycle.test.ts` — pass, 32 tests.
- `npm run typecheck` — pass.
- `cargo check --manifest-path src-tauri/Cargo.toml` — pass.
- `npm run docs:check` — pass.
- `npm run docs:site:sync && npm run docs:site:check` — pass.
- `npm run standards:check` — pass with existing P2 hard-coded color review warning.
- `npm run build` — pass with existing Turbopack filesystem trace warnings in `app/api/chat/tools/file/route.ts`.
- `curl -I http://localhost:43187/xmux` — 200 OK.

## 2026-05-27 17:31 AEST — Layout correction from browser feedback

### User feedback

- Browser `...` menu was hidden behind or visually blocked by the native webview.
- Console and CSS Inspector should be inserted on the right side of the browser block, like a devtools side panel.
- AI Assistant was not visible under the Workspaces area.

### Fix

- Moved browser actions out of an absolute dropdown and into an inline panel directly below browser chrome; this pushes native webview bounds downward instead of trying to overlay it.
- Replaced top stacked Console/CSS drawers with a right-side inserted panel inside the browser block.
- Added a docked AI Assistant panel under the Xmux Workspaces list while keeping the pane toolbar Bot tab action.
- Added a `docked` mode to `ChatPanel` so the existing assistant panel can fit inside the Xmux sidebar without forking chat logic.

### Verification

- `npm run test -- __tests__/xmux.registry.test.tsx __tests__/xmux.browser-url-chrome.test.tsx` — pass, 18 tests.
- `npm run typecheck` — pass.
- `npm run build` — pass with existing Turbopack filesystem trace warnings in `app/api/chat/tools/file/route.ts`.
- `npm run docs:site:check` — pass.
- `curl -I http://localhost:43187/xmux` — 200 OK.

## 2026-05-27 17:40 AEST — Pane tool cleanup and Select Element assistant output

### User feedback

- Pane toolbar should not contain a built-in AI Assistant component.
- Select Element output should appear in the AI Assistant dialog with a position label such as `bottom`.
- The label/card should include the selected element's full DOM tree structure.

### Fix

- Removed the pane-toolbar AI Assistant tab implementation:
  - removed `assistant` from `BlockItem`
  - removed `createAssistantItem`
  - removed `onAddAssistant` toolbar action
  - removed `ChatPageClient` rendering from Xmux pane blocks
- Kept the docked Workspaces AI Assistant dialog because it is now the target display surface for Select Element output.
- Added native `xmux_webview_select_element` command using `eval_with_callback` so the selected element payload returns from the child webview to Project Manager.
- Select Element now sends a `pm:xmux-selected-element` event after capture; the docked assistant listens for it and renders a card with:
  - position tag (`top`, `bottom`, `left`, etc.)
  - selected element tag
  - selector and URL
  - full selected DOM subtree (`domTree`)
  - selected element `outerHTML`
- Clipboard writing is preserved from the host side.

### Verification

- `npm run test -- __tests__/xmux.registry.test.tsx __tests__/xmux.browser-url-chrome.test.tsx __tests__/chat.panel.test.tsx` — pass, 26 tests.
- `npm run typecheck` — pass.
- `cargo check --manifest-path src-tauri/Cargo.toml` — pass.
- `npm run docs:check` — pass.
- `npm run docs:site:check` — pass.
- `npm run standards:check` — pass with existing P2 hard-coded color review warning.
- `npm run build` — pass with existing Turbopack filesystem trace warnings in `app/api/chat/tools/file/route.ts`.
- `lsof -nP -iTCP:43187 -sTCP:LISTEN` — no listener in this shell context, so live HTTP smoke was not rerun.

## 2026-05-27 20:11 AEST — Console mirror implementation

### User feedback

- Console drawer should align with normal Chrome F12 Console expectations instead of showing placeholder copy.
- GitHub page examples showed `POST ... 503` network failures in Chrome DevTools Console.

### Fix

- Added a native webview initialization script for Xmux browser panes.
- The script installs before page scripts on top-level navigation and captures:
  - `console.debug/log/info/warn/error`
  - `window.onerror`
  - `unhandledrejection`
  - failed `fetch` responses and fetch exceptions
  - failed `XMLHttpRequest` responses and XHR errors
- Added native commands:
  - `xmux_webview_console_entries`
  - `xmux_webview_clear_console`
- Added bridge and BrowserRegistry wrappers for reading and clearing the active pane console buffer.
- Replaced the Console placeholder with a right-side log viewer supporting:
  - log count
  - filter
  - clear
  - level/kind/source/timestamp/status/method display

### Known limitation

- This mirrors practical page logs after the Xmux native webview installs its hook. It is not a full Chrome DevTools Protocol console and cannot replay historical DevTools messages that occurred before the hook was injected.

### Verification

- `npm run test -- __tests__/xmux.browser-url-chrome.test.tsx` — pass, 10 tests.
- `cargo check --manifest-path src-tauri/Cargo.toml` — pass.
- `npm run typecheck` — pass.

## 2026-05-27 20:25 AEST — CSS Inspector selected element slice

### User feedback

- CSS Inspector was still a placeholder and did not behave like Cursor's inspector.
- Expected behavior: user selects an element, then the inspector shows where that component sits in the DOM tree plus useful style/layout data.

### Fix

- Extended native Select Element payload with UI inspection data:
  - `classList`
  - `computedStyle`
  - `computedStyleSummary`
  - `boxModel`
  - `cssPath`
- BrowserContent now stores the latest selected-element payload for the active browser pane.
- Replaced CSS Inspector placeholder with:
  - Components/DOM tree panel with selected node highlight.
  - Design tab for position, layout, box model, dimensions, typography, and visual style summary.
  - CSS tab for class list, computed style rows, and outerHTML.
- CSS Inspector still shows an honest empty state before any element is selected.

### Verification

- `npm run test -- __tests__/xmux.browser-url-chrome.test.tsx` — pass, 10 tests.
- `cargo check --manifest-path src-tauri/Cargo.toml` — pass.
- `npm run typecheck` — pass.
