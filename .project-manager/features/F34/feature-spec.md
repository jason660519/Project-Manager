# F34 Feature Spec: Xmux AI Assistant Block and Browser Tools

## Purpose

Make Xmux a multi-block engineering cockpit by docking the existing Project Manager assistant under Workspaces and adding browser controls that let users inspect, reload, capture, and clean browser panes from inside Xmux.

## User Stories

### US-01: Dock AI Assistant under Workspaces

**As a** Project Manager user  
**I want** an AI Assistant dialog under the Xmux Workspaces area  
**So that** I can ask about terminals, browser pages, folder context, and future Xmux blocks without switching views.

Acceptance:

- Xmux Workspaces sidebar contains a docked assistant panel.
- Pane toolbar does not expose an AI Assistant tab/action.
- The docked panel reuses the existing assistant panel logic, not a duplicate chat implementation.
- Select Element output can appear inside the docked assistant panel.

### US-02: Browser utility menu

**As a** user browsing inside Xmux  
**I want** browser actions for screenshot, area capture, hard reload, URL copy, zoom, history, cookies, and cache  
**So that** I can operate the embedded browser without opening an external browser.

Acceptance:

- Browser chrome exposes a compact menu matching the requested action set.
- Copy Current URL writes the current browser URL to the system clipboard.
- Hard Reload, zoom, cookies/cache/history cleanup call native bridge commands in Tauri mode.
- Browser mode shows a clear disabled/degraded state for native-only actions.

### US-03: Select Element mode

**As a** user inspecting a page in Xmux browser  
**I want** a Select Element icon left of Go  
**So that** clicking a page component copies useful DOM context to the clipboard.

Acceptance:

- The icon toggles Select Element mode.
- In supported Tauri/native webview mode, the injected inspector script changes the page cursor to a crosshair.
- Clicking a DOM element returns tag, id, classes, attributes, selector path, ancestry, text snippet, bounding rect, selected DOM subtree, outerHTML, current URL, computed styles, box model, class list, and a position tag such as `bottom`.
- The docked AI Assistant dialog shows the position tag and embeds the selected DOM tree payload.
- CSS Inspector consumes the same selected-element payload for DOM tree, Design, and CSS tabs.
- Unsupported contexts report a clear reason instead of silently failing.

### US-04: Console visibility

**As a** developer  
**I want** Console/Hide Console in the browser chrome  
**So that** I can see logs and page errors for the active browser pane.

Acceptance:

- Console icon toggles a compact console drawer for the active browser item.
- Tauri/native mode captures `console.debug/log/info/warn/error`, runtime errors, unhandled promise rejections, failed `fetch`, and failed `XMLHttpRequest` entries from the active child webview.
- Console rows show level, kind, message, source URL, line/column when available, timestamp, HTTP method, and HTTP status where applicable.
- Console supports filtering and clearing the active pane's captured buffer.
- Browser preview mode reports a clear native-required message.
- The UI must not cover the native browser URL chrome.

### US-05: CSS Inspector

**As a** developer  
**I want** Show CSS Inspector  
**So that** selected element style and box-model information can be inspected inside Xmux.

Acceptance:

- CSS Inspector icon toggles an inspector drawer for the active browser item.
- Before selection, CSS Inspector shows an empty state that asks the user to use Select Element.
- After selection, CSS Inspector shows:
  - Components/DOM tree with the selected node highlighted.
  - Design tab with position, layout, box model, dimensions, typography, and visual summary.
  - CSS tab with class list, computed styles, and outerHTML.
- The inspector uses the active pane's latest Select Element payload and does not fabricate data.

## Functional Requirements

- Pane toolbar supports terminal, browser, folder, split, and close actions only.
- Workspaces sidebar hosts the docked assistant surface.
- Select Element emits a selected-element event consumed by the docked assistant.
- Add browser item UI state for:
  - menu open/closed
  - zoom percent
  - status banner
  - select mode
  - console drawer
  - CSS inspector drawer
  - selected element inspector payload
- Add typed bridge wrappers for stable native browser operations:
  - current URL lookup
  - reload
  - set zoom
  - clear browsing data
  - JavaScript eval/injection hook
  - console log buffer read/clear
- Keep screenshot and area screenshot visible but guarded if native capture is not implemented yet.

## Non-Goals For This Slice

- Full production-grade webview screenshot on every platform.
- Cross-origin iframe DOM inspection.
- Replacing every native browser DevTools feature. The Console drawer mirrors practical page logs but is not a full Chrome DevTools Protocol frontend.
- Making the assistant autonomously mutate Xmux blocks; this feature only creates the display path for selected DOM context.
- Reintroducing an assistant pane tab in the pane toolbar.

## Risk Notes

- Native child webviews paint above React. React overlays cannot reliably sit over page content; element selection and inspection should use injected script inside the target webview.
- Browser mode uses iframe fallback and cannot bypass remote page restrictions.
- Clearing cache/history may be webview-global depending on platform APIs. UI copy must describe scope honestly.

## Acceptance Criteria

1. F34 dashboard entry and artifacts exist.
2. Xmux pane toolbar has no AI Assistant tab/action.
3. Workspaces sidebar shows the docked AI Assistant dialog.
4. Browser chrome includes the requested action set and Go-left inspector icons.
4. Copy Current URL works in browser mode and Tauri mode.
5. Select Element output appears in the docked assistant with a position tag and selected DOM tree.
6. Console drawer shows captured page logs/network failures in Tauri mode and no longer displays placeholder copy.
7. CSS Inspector shows selected DOM tree, Design tab, CSS tab, class list, box model, computed styles, and outerHTML after element selection.
8. Native-only actions are typed through `lib/bridge/index.ts` and return visible status.
9. Focused unit tests cover pane actions, selected-element assistant output, console output, CSS inspector output, and browser toolbar interactions.
10. `npm run typecheck`, relevant vitest suites, `cargo check --manifest-path src-tauri/Cargo.toml`, and `npm run build` are attempted before handoff.
