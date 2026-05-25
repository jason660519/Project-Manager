# F31 TDD Spec - xmux Native Browser URL Chrome Stability

## Test Matrix

### A. URL Input Workflow

- A1: Default GitHub URL appears in the URL input when the workspace project has a GitHub URL.
- A2: User can focus, clear, and type into the URL input without the input disappearing.
- A3: Enter submits the draft URL, normalizes missing protocol, and updates tab label.
- A4: Go button submits the draft URL, normalizes missing protocol, and updates tab label.
- A5: Clearing the field without submitting keeps the draft visible and does not navigate.
- A6: Focusing the URL input does not hide or park the active native browser content.
- A7: Common drafts (`google.com`, `https://google.com/search?q=xmux`, `about:blank`, localhost URLs) normalize and navigate correctly.

### B. Add Browser Scenarios

- B1: New browser tab uses workspace homepage.
- B2: Multiple browser tabs keep separate URL drafts.
- B3: Browser tab added while another browser tab exists does not overwrite the existing tab URL.

### C. Close Browser Scenarios

- C1: Closing a browser tab destroys its browser session.
- C2: Closing the last tab closes the pane and destroys the browser session.
- C3: Closing a pane with terminal + browser items destroys both terminal and browser sessions.
- C4: Closing one split browser pane does not destroy browser sessions in sibling panes.

### D. Native Webview Geometry

- D1: BrowserSlot does not call `setBounds` when the measured slot overlaps URL chrome.
- D2: BrowserSlot hides native webview when active slot has no valid chrome-safe bounds.
- D3: BrowserSlot syncs native bounds only to the content viewport below URL chrome.
- D4: BrowserSlot remeasures bounds after URL navigation and after native retry.
- D5: Inactive BrowserSlot calls `setSlotHidden` and never shows stale native overlays.
- D6: Active BrowserSlot must not call `setSlotHidden` solely because the URL chrome has focus.

### E. Desktop Manual Verification

- E1: In `npm run tauri:dev`, open `/xmux`, select Project Manager, verify GitHub URL is default.
- E2: Click the URL input, select part of the GitHub URL, type a replacement, verify the field stays visible.
- E3: Submit with Enter and Go, verify navigation and tab label update.
- E4: Add a second browser tab, edit it, switch back and forth, verify no overlay covers inactive/active chrome.
- E5: Close browser tab and pane, verify no native webview remains on screen.
- E6: While a browser page is visibly loaded, click the URL input and verify the browser content does not turn black.
- E7: Enter `google.com`, `https://google.com/search?q=xmux`, `about:blank`, and `localhost:43187/xmux`, then verify each submitted URL is normalized and rendered or delegated through the expected browser backend.

## Required Automated Tests

- `__tests__/BrowserRegistry.native-lifecycle.test.ts`
- `__tests__/BrowserSlot.native-bounds.test.tsx`
- `__tests__/browser-bounds.test.ts`
- `__tests__/xmux.browser-url-chrome.test.tsx`
- Existing xmux lifecycle coverage:
  - `__tests__/xmux.registry.test.tsx`
  - `__tests__/blockLayout.destroy.test.ts`

## Verification Commands

```bash
npm run test -- --run __tests__/BrowserRegistry.native-lifecycle.test.ts __tests__/BrowserSlot.native-bounds.test.tsx __tests__/browser-bounds.test.ts __tests__/xmux.browser-url-chrome.test.tsx __tests__/xmux.registry.test.tsx __tests__/blockLayout.destroy.test.ts
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run docs:check
npm run standards:check
```

## Done Criteria

- All automated tests pass.
- Desktop manual verification confirms the URL chrome remains visible while editing a GitHub URL.
- Dev log records the root cause, changed files, tests, and remaining risk.
