---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing workspace guide with no secrets, credentials, or private infrastructure details.
---

# xmux Workspace

xmux is Project Manager's in-app **tiling workspace**: terminals, browsers, and folder views arranged like tmux panes — split, resize, and tabbed — all without leaving the desktop shell. It is inspired by [cmux](https://cmux.com/) (Manaflow), and is intended to grow into the same level of multi-agent coding ergonomics over time.

This page documents the workspace exactly as it ships today. For the background inspiration and the upstream cmux feature surface, see [Background: inspired by cmux](#background-inspired-by-cmux) at the end.

## At a glance

When you open **xmux** from the sidebar, you land on a single workspace with two tabs visible:

- A `zsh` terminal tab
- A `localhost` browser tab opened to the selected project's homepage

The browser is active by default so you immediately see your project context. Click the `zsh` tab to switch to the terminal. From there you can split the screen, add more tabs, or open new workspaces.

## Anatomy of the page

```
┌──────────────────────────────────────────────────────────────────────────┐
│ XMUX                                          [?] [Bot] [Theme] [Lang]   │  ← global TopBar (Help button opens this doc)
├──────────────────────────────────────────────────────────────────────────┤
│ WORKSPACES         🔔│ Owner-Property-Management-AI-SPA Workspace        │  ← header (active workspace name)
│                      ├────────────────────────────────────────────────── │
│ ┌─────────────────┐  │ ┌──Block────────────┐ │ ┌──Block────────────────┐ │
│ │ Project A   *   │  │ │ zsh × │ localhost │ │ │ zsh ×                 │ │
│ │ local /…        │  │ │       [⊞ ⊕ ⊟ ⇆ ⇣]│ │ │      [⊞ ⊕ ⊟ ⇆ ⇣]      │ │
│ │ feature in …    │  │ ├───────────────────┤ │ ├───────────────────────┤ │
│ ├─────────────────┤  │ │  iframe / xterm   │ │ │   xterm content       │ │
│ │ Project B       │  │ │                   │ │ │                       │ │
│ └─────────────────┘  │ └───────────────────┘ │ └───────────────────────┘ │
│  (sidebar)           │  (resizable column)                               │
└──────────────────────────────────────────────────────────────────────────┘
```

| Region | What it does |
|---|---|
| Workspaces sidebar | One row per project selected on the Project Progress Dashboard. Click a row to switch workspace. The little blue dot marks unread agent notifications. |
| Bell (🔔) | Opens the right-side notification panel. |
| Workspace header | Shows the active workspace name. The page-level **Help (?)** button in the global TopBar opens this very documentation page in your system browser. |
| Block | A single tabbed pane. Holds any mix of terminal / browser / folder tabs. The 5-button toolbar lives in the tab strip. |
| Divider | Drag the slim grey gutter between two blocks to resize them. Vertical dividers resize left/right; horizontal dividers resize top/bottom. |
| Notification panel | Optional column on the right; toggle with the bell. |

## Blocks and tabs

A **block** is the basic unit. Every block has a tab strip on top and one large content area below. The tab strip holds tabs and a 5-button action toolbar on the right.

### Tab types

| Icon | Type | What it shows |
|---|---|---|
| ▣ | Terminal | An embedded xterm (real PTY in `tauri:dev` / built app; placeholder in `npm run dev` browser preview). |
| 🌐 | Browser | URL bar + iframe. Defaults to the active workspace's homepage (the project's GitHub URL if set, otherwise the in-app Project Progress Dashboard). |
| 🗂 | Folder | A simple folder explorer rooted at the workspace's project root. |

Tabs can be mixed freely within one block — for example a block can hold two terminals + one browser + one folder. The active tab determines which content area is visible.

### The 5-button toolbar

Every block carries the same five buttons in its tab strip, on the right:

| Icon | Action | Behaviour |
|---|---|---|
| **▣** | New terminal | Adds a `zsh N` tab to **this block**. |
| **🌐** | New browser tab | Adds a browser tab in **this block**, pre-loaded with the workspace homepage. |
| **🗂** | New folder tab | Adds a folder explorer tab in **this block**, rooted at the project root. |
| **⇉** | Split right | Creates a brand-new **sibling block** to the right of this one. If a sibling already exists to the right, adds a tab instead so the click is never a no-op. |
| **⇣** | Split down | Same as Split right but below. |

The split buttons operate on the **layout tree**, not on tabs — that is what makes xmux feel like tmux. Clicking "Split right" never changes the current block's contents; it places a new empty block alongside it.

### Closing tabs and blocks

Click the **×** next to a tab label to close it. When you close the **last** tab in a block, the block itself is removed from the layout tree, and its sibling block automatically expands to fill the space (left-right sibling stretches horizontally, top-bottom sibling stretches vertically).

This means there is no separate "close block" button — emptying the block IS closing it.

If you close every block in a workspace, xmux re-seeds the workspace with a fresh initial block (one terminal + one browser pre-loaded with the homepage), so you can never end up with a blank workspace by accident.

## Splits and the tiling layout

The workspace content area is a binary tree:

- **Leaf node** → one Block
- **Split node** → two children (first / second) plus a direction (vertical = side-by-side, horizontal = stacked) and a ratio

Splits can nest to any depth. For example, after **Split down** then **Split right** on the top block, the tree looks like:

```
split(horizontal)
├─ split(vertical)
│  ├─ Block A (top-left)
│  └─ Block B (top-right)
└─ Block C (bottom)
```

Each split node remembers its own size ratio, and every divider you see on screen corresponds to exactly one split node. Dragging a divider only resizes the immediate two children of that split — siblings further up the tree stay put.

### Closing a block in a nested tree

When a block is removed, the empty side of the parent split disappears and the surviving side **takes over the parent's full space**. Example: closing `Block A` above collapses `split(vertical)` to just `Block B`, and `Block B` now fills the entire top half of the workspace.

If every block under a split is closed, the split itself disappears and the layout tree shrinks one level.

## Workspaces

The left sidebar lists every project currently selected on the **Project Progress Dashboard**. Each row shows:

- Project name (bold)
- Branch label and working directory (mono small text)
- Status note when applicable (e.g. "Feature in progress")
- A small blue dot if there are unread notifications for that workspace

Switch workspace by clicking a row. The active row is highlighted blue.

### Per-workspace layout state

Each workspace keeps its **own** layout tree in memory. Switching back and forth between workspaces preserves your splits, tabs, and browser URLs for each one. The first time you visit a workspace it seeds the default `terminal + browser` block described above.

> Note: layout state lives in memory only for now. Closing the app or switching tabs in the dashboard does not currently persist your workspace layout across launches — that is on the [follow-ups list](#follow-up-integration-ideas).

## Resizing

Three kinds of drag handles exist in xmux:

| Handle | Where | What it resizes |
|---|---|---|
| Sidebar resize | Between the workspaces sidebar and the main content (visible on ≥ `lg` screens) | Workspaces sidebar width |
| Split divider | Between two children of a split node | The split's ratio (clamped 10% – 90%) |
| Notification panel | Fixed 320px column on `lg` screens | Not user-resizable |

Drags are RAF-throttled so layout stays smooth.

## Notifications

Click the 🔔 in the sidebar header to open the notification panel on the right. Today the panel shows a placeholder card for the active workspace; the long-term plan is to surface real agent notifications (OSC 9 / 99 / 777 sequences from running PTY sessions, GitHub events, dispatch results, etc.).

The bell pulses when any workspace in the sidebar has an unread alert.

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Toggle notification panel | `Cmd+I` (visual title only — wiring TBD) |
| Jump to latest unread workspace | `Cmd+Shift+U` (planned) |

> The keyboard layer is intentionally minimal in the first iteration. Splits, tab navigation, and pane focus are all currently mouse / click driven; first-class keyboard navigation is a follow-up.

## Page-level Help button

The `?` button in the global TopBar opens this page in your **system browser** (via the Tauri shell plugin in the desktop app, or a new tab in web preview). The destination URL is per-view — each tool page in Project Manager has its own slug in `lib/docsRegistry.ts`. If a view does not have a documentation page yet, the `?` button renders disabled.

## Background: inspired by cmux

The xmux design is a deliberate echo of [cmux by Manaflow](https://cmux.com/) — a multi-agent terminal application with native browser panes, notifications, and Claude Code teammate splits. Project Manager's xmux is **not** a port or wrapper of cmux; it is an in-app reimplementation of the same core idea (tiling terminal + browser workspace) so the dashboard stays self-contained.

The same vocabulary applies in spirit:

| cmux concept | xmux equivalent |
|---|---|
| Workspace | Workspace (sidebar row) |
| Pane | Block leaf in the layout tree |
| Split | Split node in the layout tree |
| Browser surface | Browser tab inside a block |
| Notification | Bell + notification panel |
| Session restore | (Planned) persistent layout state per workspace |

If you already use the standalone cmux app, the in-app xmux workspace should feel familiar.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Persistent layout per workspace | So your splits survive app restarts. |
| Real PTY notifications | Surface OSC 9 / 99 / 777 sequences from running shells. |
| Keyboard-first navigation | Pane focus, split, close, tab cycle without the mouse. |
| Folder tab → file preview | Click a file in the folder tab to open it in a side preview. |
| Browser pane bookmarks | Per-workspace pinned URLs (CI dashboard, staging site, GitHub Issues, …). |
| Optional bridge to standalone cmux | For users who already have cmux installed, mirror its workspace inventory and notifications. |

## References

- [cmux Getting Started](https://cmux.com/docs/getting-started)
- [cmux Concepts](https://cmux.com/docs/concepts)
- [cmux Notifications](https://cmux.com/docs/notifications)
- [cmux Session Restore](https://cmux.com/docs/session-restore)
- Source: [`app/ui/views/XmuxView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/XmuxView.tsx), [`components/terminal/blockLayout.ts`](https://github.com/jason660519/Project-Manager/tree/main/components/terminal/blockLayout.ts), [`components/terminal/Block.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/terminal/Block.tsx), [`components/terminal/LayoutRenderer.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/terminal/LayoutRenderer.tsx)
