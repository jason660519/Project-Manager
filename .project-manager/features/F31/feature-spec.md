# F31 Feature Spec - xmux Native Browser URL Chrome Stability

## Problem

In xmux, adding a browser tab defaults to the selected project's GitHub repository URL. In the desktop/Tauri runtime, two related native-webview regressions were reported:

1. The URL input could be covered by the OS child webview while editing the GitHub default URL.
2. After the overlay fix, focusing the URL input could hide/park the active native webview, leaving the browser pane black; submitting a new URL such as `google.com` then appeared to do nothing because the webview remained offscreen.

## Root-Cause Hypothesis

Tauri child webviews are OS-level views, not DOM elements. React `z-index` cannot draw above them. The browser pane must therefore reserve native-webview bounds that never include the URL chrome, or the chrome must live outside the native child webview's drawable region.

The prior fix also introduced a bad focus-hide path: while the URL chrome was focused, BrowserSlot treated the active webview like an inactive or invalid slot and called `setSlotHidden`. That parked the active native webview offscreen and produced the black pane. The durable contract must be: native bounds are clipped by an explicit chrome-safe inset, but focusing or editing URL chrome must not hide the active browser content.

## Goals

1. URL input remains visible while the user focuses, selects, types, clears, pastes, and edits a browser URL.
2. Pressing Enter or clicking Go saves the modified URL, navigates the browser, and updates the tab label.
3. Adding a browser tab uses the workspace homepage, including the project's GitHub URL when present.
4. Closing browser tabs and panes destroys or hides native webviews so they do not overlay other panes.
5. Switching between terminal/browser/folder tabs does not leave hidden browser webviews visible.
6. Browser-mode iframe behavior remains unchanged.

## Non-Goals

- Replacing the native webview implementation.
- Implementing browser history, back/forward, reload, or address-bar autocomplete.
- Changing the project GitHub URL source of truth.

## User Scenarios

### S1 - Add Browser From Workspace Homepage

Given a workspace has `project.githubUrl = https://github.com/jason660519/Project-Manager`, when the user clicks New browser tab, then a browser tab is added with the URL input showing that GitHub URL.

### S2 - Edit GitHub URL In Desktop Runtime

Given the browser tab embeds GitHub in a native Tauri webview, when the user focuses the URL input and starts typing, then the URL chrome remains visible and interactive above the webview.

### S2b - Focus URL Input Without Black Pane

Given a browser tab is already rendering content, when the user clicks the URL input, then BrowserSlot keeps the active native webview visible and continues bounds sync.

### S3 - Submit Edited URL

Given the user types `example.com/docs`, when the user clicks Go or presses Enter, then the saved URL becomes `http://example.com/docs`, the browser navigates there, and the tab label becomes `example.com`.

### S4 - Clear Then Cancel By Not Submitting

Given the URL input is focused, when the user clears text and does not submit, then the draft remains visible and no navigation is triggered.

### S5 - Close Active Browser Tab

Given a browser tab is active, when the user closes it, then its iframe/native session is destroyed and cannot cover remaining pane content.

### S6 - Close Pane Containing Browser

Given a pane contains a browser item, when the user closes the pane, then all browser sessions in that block are destroyed before the layout removes the block.

### S7 - Switch Away From Browser

Given a browser tab has created a native webview, when the user switches to a terminal or folder tab, then the native webview is hidden and cannot overlap the active tab.

### S8 - Retry Native Embed

Given native embed creation fails and the user clicks retry, when the embed is recreated, then the chrome-safe bounds still apply.

## Implementation Contract

- The URL toolbar is part of React UI and must not share native-webview bounds.
- The native webview may only occupy the browser content area below the URL toolbar and any blocked/fallback hint row.
- BrowserSlot must be able to report a separate "native viewport" rectangle and keep a DOM debug marker for tests.
- BrowserRegistry must not show native webviews without a valid chrome-safe rectangle.
- URL input focus, selection, typing, and clearing are not hide conditions for the active native webview.
- Tests must cover both user workflow and low-level native bounds.

## Acceptance Criteria

- AC1: The browser URL input remains in the DOM and visible while the user edits a GitHub URL.
- AC2: `onNavigate` is called only after Enter/Go, with normalized URL.
- AC3: Native bounds start at or below the dedicated content viewport, not at the BrowserContent root.
- AC4: Closing browser tabs calls browser-session destroy.
- AC5: Switching inactive browser tabs hides native sessions.
- AC6: The feature artifacts and dashboard row exist for F31.
- AC7: Focusing the URL input does not call the active tab's native `setSlotHidden` path.
