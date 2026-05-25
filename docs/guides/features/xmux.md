---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing coding-tool guide with no secrets, credentials, or private infrastructure details.
---

# xmux

xmux is the Project Manager-facing coding-tool entry for a user-installed cmux command. cmux is a third-party project by Manaflow. In the first Project Manager integration, xmux is a sidebar item and agent target that delegates to the installed `cmux` command. The goal is to make multi-agent coding work visible from Project Manager without bundling, forking, or redistributing cmux.

## Design Philosophy

xmux does not prescribe how developers must use AI. It is not a closed workflow product. Instead, it treats terminals, browser panes, notifications, workspaces, splits, tabs, and CLI commands as composable building blocks. Developers can combine those parts into the AI collaboration workflow that fits their codebase.

## Current Project Manager Behavior

| Area | Current behavior |
|---|---|
| Sidebar | `xmux` appears under Execution. |
| Adapter | Dispatch target is named `xmux`. |
| Command | Project Manager invokes the installed `cmux` executable. |
| Interface | Interactive workspace sidebar plus terminal/browser split-pane topology. |
| Terminal | Page-local terminal panes can run allowlisted inspection commands through `/api/xmux/terminal`. |
| Browser | Browser pane has a URL bar and iframe surface for local Project Manager pages. |
| Toolbar | Globe toggles browser, Bell opens notifications, Grid switches vertical/horizontal split. |
| Deep control | Full PTY, cmux socket inventory, cmux browser automation, and notification feed wiring are future work. |

## Install And Verify cmux

cmux is distributed as a macOS app. The official getting-started guide documents two install paths:

```bash
brew tap manaflow-ai/cmux
brew install --cask cmux
```

For CLI access outside cmux terminals, create the standard symlink:

```bash
sudo ln -sf "/Applications/cmux.app/Contents/Resources/bin/cmux" /usr/local/bin/cmux
cmux list-workspaces
cmux notify --title "Build Complete" --body "Your build finished"
```

Project Manager expects the executable to be available as `cmux`. It does not ship cmux inside Project Manager.

## Page-Local Terminal

The terminal pane is interactive, but intentionally allowlisted. It is meant for safe local inspection, not arbitrary shell execution. Supported commands:

| Command | Purpose |
|---|---|
| `pwd` | Show the Project Manager server working directory. |
| `git branch --show-current` | Show the current git branch. |
| `git status --short` | Show dirty worktree entries. |
| `cmux --version` | Verify the installed cmux CLI. |
| `cmux list-workspaces` | Ask cmux for current workspaces. |

## Core Capabilities

### Right-Top Toolbar

The xmux interop surface mirrors the native cmux right-top controls for browser, notification, and split-pane actions. These controls are live in Project Manager: they change visible pane state rather than only documenting the upstream cmux behavior.

### AI Notification Attention

cmux supports desktop and in-app notifications so coding agents and scripts can alert you when they need attention. Unread workspaces can be surfaced in the sidebar, and the notification panel provides a central place to review pending work.

### Notification Panel

Use the cmux notification panel for pending agent alerts. The upstream shortcut `Cmd+Shift+U` jumps to the workspace with the latest unread notification.

### Vertical Workspace Sidebar

cmux organizes work into windows, workspaces, panes, surfaces, and panels. Workspaces appear in the sidebar and can carry operational metadata such as current working directory, notifications, and coding context.

### Embedded Browser Panes

cmux browser surfaces can sit beside terminal panes. The browser command group can navigate pages, inspect DOM state, take screenshots, click elements, fill forms, evaluate JavaScript, and save or restore browser session state.

The Globe toolbar icon opens or hides the built-in browser split. Shortcut target: `Cmd+Shift+L`.

### Notification Toolbar

The Bell toolbar icon opens the centralized notification panel. cmux listens for OSC 9/99/777 terminal sequences, so coding agents can mark panes as waiting for input. Waiting panes get attention rings, and the related workspace tab lights up in the sidebar.

Shortcuts:

| Action | Shortcut |
|---|---|
| Open notification panel | `Cmd+I` |
| Jump to latest unread | `Cmd+Shift+U` |

### Split Pane Toolbar

The Grid toolbar icon controls split-pane layout for parallel agent work. In Project Manager today it switches the visible terminal/browser split between vertical and horizontal layouts.

| Action | Shortcut |
|---|---|
| Split right | `Cmd+D` |
| Split down | `Cmd+Shift+D` |
| Move pane focus | `Option+Cmd+Arrow` |

### Claude Code Teams

`cmux claude-teams` launches Claude Code with teammate agents mapped into native cmux splits. cmux provides a tmux compatibility shim so Claude's teammate-pane behavior can run without requiring users to manage tmux directly.

### SSH Workspaces

`cmux ssh user@remote` creates a remote workspace. Browser panes in that workspace route HTTP and WebSocket traffic through the remote machine, so remote `localhost` services are accessible without manual port forwarding. Remote coding-agent notifications can still appear locally.

### Session Restore

cmux can restore app-owned layout and metadata after relaunch, including windows, workspaces, panes, working directories, terminal scrollback on a best-effort basis, and browser URL/history. Supported coding agents can resume when cmux captures their native session identifiers through hooks.

## Project Manager Boundary

xmux currently does not provide a full PTY, read the cmux socket, control cmux browser panes, or ingest cmux notifications into Project Manager logs. Those are separate follow-up integrations because they require command boundaries, socket access policy, and UI state design.

## Follow-Up Integration Ideas

| Follow-up | Purpose |
|---|---|
| Socket status check | Show whether `/tmp/cmux.sock` is reachable and which access mode is active. |
| Workspace inventory | List cmux workspaces inside the xmux view. |
| Notification mirror | Surface cmux unread notifications inside Project Manager. |
| Browser automation bridge | Dispatch browser verification steps to a cmux browser pane. |
| SSH workspace shortcuts | Open known remote development hosts from Project Manager. |

## Official References

- [cmux Getting Started](https://cmux.com/docs/getting-started)
- [cmux Concepts](https://cmux.com/docs/concepts)
- [cmux API Reference](https://cmux.com/docs/api)
- [cmux Browser Automation](https://cmux.com/docs/browser-automation)
- [cmux Notifications](https://cmux.com/docs/notifications)
- [cmux SSH](https://cmux.com/docs/ssh)
- [cmux Claude Code Teams](https://cmux.com/docs/agent-integrations/claude-code-teams)
- [cmux Session Restore](https://cmux.com/docs/session-restore)
