# F28 Feature Spec: xmux Pane Unification, Stable Browser State & Smooth Resize

## Problem

F27 shipped `app/ui/views/XmuxView.tsx` with three hand-built blocks:

| Block | Tab strip | Extra chrome | Source |
|---|---|---|---|
| terminal-a | `TerminalPaneGroup` PaneTabs (h-8) | — | `components/terminal/TerminalPaneGroup.tsx` |
| browser   | local static `PaneTabs` in XmuxView | URL bar (h-8) | `app/ui/views/XmuxView.tsx` |
| terminal-b | `TerminalPaneGroup` PaneTabs (h-8) | — | `components/terminal/TerminalPaneGroup.tsx` |

Three concrete failures emerged in use:

### F-1. Browser pane state is destroyed by "New Browser"
`openBrowserHomepage()` in `InteropConsole` does `setBrowserVisible(true); setBrowserUrl(homepageUrl);` — clicking the 4-icon Globe overwrites whatever URL the user had navigated to. Because the browser was implemented as a single-URL component, every "new" action is destructive.

### F-2. Divider drag stutters across iframe / xterm
`beginDrag` in `XmuxView.tsx` attaches `mousemove` listeners on `document`. When the cursor enters the `<iframe>` (browser pane) or the xterm canvas, those children swallow mouse events and the listener stops firing until the cursor leaves. The drag visibly stutters or feels stuck.

### F-3. Blocks are not derived from a single primitive
The terminal block uses `h-8` tab strip; the browser block uses `h-8` tab strip + `h-8` URL bar. Two different tab strip implementations (one in `TerminalPaneGroup`, one inline in `XmuxView`). The chrome height differs by 32px, so the same outer height shows different content areas — visually the blocks read as "different widgets."

### F-4. 4-icon toolbar conflicts and disabled UX
- `TerminalPaneGroup` has both a `+` tab button **and** a 4-icon `SquareTerminal` — two entry points to the same action.
- "New Browser" 4-icon resets URL (see F-1).
- Browser pane's "New Terminal" 4-icon is disabled, so the toolbar is partially dead per pane type.

## Goal

Turn the xmux interop console into a small, internally-consistent system:

- One `PaneShell` component (tab strip + 4-icon action toolbar) used by every block.
- Multi-tab browser pane with per-workspace tab state.
- Resize that survives mouse-over-iframe and mouse-over-xterm without stuttering.
- A single canonical entry point for "new terminal tab" and "new browser tab."

## Non-Goals (deferred)

- True tmux-style dynamic pane tree (Split Right/Down creating new panes). Today F28 keeps the existing 3-slot layout and gives Split Right / Split Down honest names plus deterministic behavior.
- localStorage persistence of layout.
- Multi-window xmux sessions.
- Browser history per-tab (forward/back buttons).

## Scope (this iteration)

1. **`components/terminal/PaneShell.tsx`** (new): exports `PaneShell` + `PaneTab` + `PaneActions`. Renders unified tab strip (h-8) with tabs (selectable + closable) + right-aligned 4-icon toolbar. Accepts `children` for the content area.
2. **`TerminalPaneGroup`** refactored to consume `PaneShell`. Removes the redundant `+` button — the 4-icon `SquareTerminal` becomes the only "new terminal tab" entry point.
3. **`BrowserPane`** refactored to consume `PaneShell` with multi-tab state and a per-active-tab URL bar (still controlled below the shell). `<iframe>` re-mount only on tab switch or hard navigate, not on every keystroke.
4. **Per-workspace browser tab state**: `Map<workspaceId, BrowserTabState[]>` in `InteropConsole`, seeded with one tab at workspace.homepageUrl on first visit; preserved on workspace switch.
5. **Resize overlay**: while a divider drag is in progress, render a `position: fixed; inset: 0` overlay with `pointer-events: auto; cursor: <col|row>-resize; z-index: 50` so iframe and xterm cannot capture the mouse.
6. **rAF-throttled resize**: state updates inside `beginDrag` go through `requestAnimationFrame` to coalesce multiple `mousemove` events per frame.
7. **Action semantics finalized**:
   - `onAddTerminal` → add a new terminal tab to *this* pane.
   - `onAddBrowser` → ensure browser pane visible + **append** a new browser tab (workspace homepage). Never overwrites an existing tab.
   - `onSplitRight` → ensure browser pane visible + `splitLayout='vertical'`. Honest description on hover: "Show browser side-panel (right)".
   - `onSplitDown` → ensure browser pane visible + `splitLayout='horizontal'`. Honest description on hover: "Show browser side-panel (bottom)".

## Architecture After F28

```
PaneShell (chrome only)
├── tab strip (h-8)
│   ├── tabs[] — selectable + closable
│   └── PaneActionToolbar (4 icons, right-aligned)
└── children (content)

TerminalPaneGroup = PaneShell + EmbeddedXtermPane (per active tab)
BrowserPane       = PaneShell + URL bar (h-8, per active tab) + <iframe>
```

`InteropConsole` owns the dynamic state previously hand-rolled in XmuxView:
- `sidebarWidth`, `topAreaPercent`, `primarySplitPercent`, `splitLayout`, `browserVisible`
- `browserTabsByWorkspaceId: Record<workspaceId, BrowserTabState[]>`
- `activeBrowserTabIdByWorkspaceId: Record<workspaceId, string>`
- `dragOverlayCursor: 'col-resize' | 'row-resize' | null` (drives the overlay)

## User Scenarios (used as test fixtures in tdd-spec.md)

> Numbering is referenced from `tdd-spec.md` as US-N.

US-1. **Boot with dashboard-selected workspace**: User opens xmux. The selected dashboard project becomes the active workspace. Three blocks visible (terminal-a, browser pane at workspace homepage, terminal-b). All three blocks share identical tab strip chrome.

US-2. **Smooth drag across iframe**: User drags the col divider between terminal-a and the browser pane. Cursor passes over the iframe area. Drag does **not** stutter or stop. Releasing snaps the split percent.

US-3. **Smooth drag across xterm canvas**: Same as US-2 but cursor passes over the xterm WebGL canvas in terminal-a / terminal-b.

US-4. **Smooth top-bottom drag**: User drags the row divider between top area and terminal-b. Cursor passes over either terminal or iframe. Drag remains smooth.

US-5. **Sidebar resize**: User drags the sidebar divider 300→500px (within `[220, 520]` clamp). Reflows smoothly.

US-6. **Type URL, press Enter, navigate**: User types `github.com` in browser URL bar. Presses Enter. iframe loads `http://github.com`. URL persists. URL bar shows the navigated URL.

US-7. **Mid-typing not overwritten**: User starts typing in the URL bar. Some unrelated parent state changes (e.g., new notification arrives) — the URL bar **keeps** the user's in-progress input.

US-8. **New Browser tab appends, does not overwrite**: User navigates browser tab to `github.com`. Clicks 4-icon Globe in terminal-a. A second browser tab opens at workspace homepage. The first tab still shows `github.com` when selected.

US-9. **Close browser tab**: User has 3 browser tabs. Closes middle one. The remaining 2 keep their URLs. If active tab closed, next tab becomes active.

US-10. **Cannot close last tab**: Browser pane has 1 tab. The `×` close button is not rendered.

US-11. **Switch workspace preserves tabs**: User in workspace-A opens 2 browser tabs (homepage, github). Switches to workspace-B. Opens 1 browser tab. Switches back to workspace-A. Sees 2 tabs intact at their previous URLs.

US-12. **GitHub URL as homepage**: Project has `config.project.githubUrl='https://github.com/jason/repo'`. New Browser opens that URL as the tab's initial src.

US-13. **No githubUrl → fallback homepage**: Project without githubUrl → New Browser opens `http://localhost:43187/project-progress-dashboard`.

US-14. **External link button**: Each browser tab's URL bar has an external-link anchor — `href` always reflects the **active** tab's URL.

US-15. **Toggle browser pane preserves tabs**: User has 3 browser tabs. Clicks WorkspaceHeader "Built-in browser" button → browser pane hides. Clicks again → browser pane shows, all 3 tabs preserved.

US-16. **Notification panel + drag**: Notification panel open. User drags any divider. Drag still works (overlay still appears on top of notification panel? — overlay is `inset: 0` so it covers everything during drag, including notification panel; drag completes; overlay disappears; notification panel still open).

US-17. **Disabled action buttons show disabled state**: A pane wired without `onAddTerminal` (e.g., browser pane in current F28 scope) shows the SquareTerminal button with `disabled` + `cursor: not-allowed` + reduced opacity.

US-18. **`+` button removed from terminal tab strip**: After F28, the only way to add a terminal tab is the 4-icon SquareTerminal in the toolbar — no duplicate entry.

US-19. **Chrome height parity**: terminal-a's tab strip and browser pane's tab strip have the exact same height (32px). Browser pane has an additional URL bar (32px) below the shared tab strip; that is intentional.

US-20. **Workspace switch does not navigate browser**: Switching workspace shows the new workspace's tabs (URLs preserved). It does **not** force the iframe to reload the current tab's URL.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Overlay traps clicks intended for content | Overlay only rendered while `dragCursor !== null`; cleared on mouseup. Verified by test US-16. |
| rAF coalescing drops final mousemove | Always run the final position on mouseup, not just on rAF frames. |
| Per-workspace tab state grows unbounded | Bounded by number of workspaces × tabs per workspace. F28 caps at 8 tabs/workspace soft limit (button no-op past 8). |
| Iframe reload on every URL change feels heavy | iframe `key` switches on tab-id, not URL. URL change on same tab uses `src` mutation (browser handles navigation natively). |

## Verification Baseline

- `npm run typecheck` — green.
- `npm run test` — green; new tests for US-1…US-20 (see tdd-spec.md).
- `cargo check --manifest-path src-tauri/Cargo.toml` — green (no Rust changes expected).
- `npm run docs:check` — green (these docs are under `.project-manager/features/`, exempt from bilingual gov).
- Manual: drag every divider, click every 4-icon button per pane type, switch workspaces, toggle browser.
