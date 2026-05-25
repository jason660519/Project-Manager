# F27 Feature Spec: xmux Coding Tool Sidebar Entry

## Problem

Project Manager already exposes agent CLI targets through dispatch, but cmux is only present as a built-in adapter named `Cmux CLI`. Users do not have a visible sidebar entry that explains why cmux matters, what Project Manager can do with it today, and where future deeper integration should go.

The product decision for this iteration is to avoid a separate xmux project and avoid a broad plugin architecture change. `xmux` should be one Project Manager sidebar item and one adapter-facing name.

## Goal

Add `xmux` as a first-class execution navigation item and rename the cmux adapter surface to `xmux`, while keeping the implementation small, testable, and compatible with the installed `cmux` app/CLI.

## Design Philosophy

xmux explicitly rejects the idea that the tool should dictate how developers use AI. It is not a closed product with one required workflow. It exposes terminal, browser, notification, workspace, split, tab, and CLI primitives as composable parts so developers can build the AI collaboration workflow that best fits their repository and team.

Project Manager should preserve that philosophy. The F27 sidebar item must explain and expose the tool boundary, not turn xmux into a rigid wizard or a single mandated dispatch path.

## User Scenarios

1. A user opens the Project Manager sidebar and sees `xmux` under Execution.
2. A user clicks `xmux` and sees a concise operational view describing what xmux is, how it maps to the installed cmux binary, and which features are available or planned.
3. A user dispatches work and sees an `xmux` agent CLI target instead of `Cmux CLI`.
4. A maintainer reviews the xmux docs and sees the official cmux features that shaped the product boundary.
5. A future engineer can continue deeper socket/browser/notification integration from documented follow-up notes instead of rediscovering the cmux docs.

## Core Feature Characteristics

The xmux product surface is based on cmux capabilities that are useful for monitoring multiple AI agents at once:

- AI notification attention rings for agents such as Claude Code and Codex when they need user input.
- Notification panel and quick jump to the latest unread notification.
- Vertical workspace sidebar with workspace metadata such as git branch, PR state, working directory, listening ports, and latest notification text.
- Embedded browser panes beside terminals, with automation commands for DOM inspection, clicks, form filling, screenshots, JavaScript evaluation, and session state.
- Claude Code Teams mode through `cmux claude-teams`, which maps teammate panes into native cmux splits instead of requiring tmux.
- SSH workspaces through `cmux ssh user@remote`, with browser panes routed through the remote network and local sidebar notifications.
- Session restore for window layout, workspaces, panes, working directories, terminal scrollback, and browser URL/history, with native agent resume when hooks capture session IDs.

## Interop Toolbar Semantics

The xmux interop surface should expose the right-top toolbar controls shown in the native cmux app:

| Icon | Meaning | User-facing behavior |
|---|---|---|
| Globe | Built-in browser | Splits a browser pane beside the terminal. Agents can inspect DOM snapshots, click elements, fill forms, run JavaScript, and interact with local dev servers. Shortcut: `Cmd+Shift+L`. |
| Bell | Notification panel | Opens centralized pending notifications. cmux listens for OSC 9/99/777 terminal sequences; waiting panes get attention rings and sidebar tabs light up. Shortcut: `Cmd+I`; latest unread jump: `Cmd+Shift+U`. |
| Grid | Split pane layout | Controls horizontal/vertical split layouts for parallel agent work. `Cmd+D` splits right, `Cmd+Shift+D` splits down, and `Option+Cmd+Arrow` moves pane focus. |

## Interactive Scope

The `/xmux` view must not ship as a static screenshot. In this iteration, the interop console provides page-local interaction:

- Terminal panes accept commands and call `/api/xmux/terminal`.
- The terminal API is allowlisted and only runs safe inspection commands such as `pwd`, `git status --short`, `git branch --show-current`, `cmux --version`, and `cmux list-workspaces`.
- The browser pane includes a URL bar and iframe surface so local Project Manager pages can be opened beside terminal panes.
- The Globe button toggles the browser pane.
- The Bell button opens a notification rail and highlights waiting workspace rows.
- The Grid button switches the primary workspace between vertical and horizontal split layouts.

Full PTY streaming, arbitrary shell execution, cmux socket inventory, and cmux browser automation are intentionally outside this iteration.

## Functional Requirements

- Add `xmux` to `ViewId`.
- Add `/xmux` route rendering `MainClient currentView="xmux"`.
- Add a sidebar item under the existing Execution group.
- Add localized nav labels for `xmux` in all supported locales.
- Add a TopBar label for `xmux`.
- Add an `XmuxView` using existing Project Manager shell styling.
- Add a safe `/api/xmux/terminal` endpoint for allowlisted terminal-pane inspection commands.
- Rename the built-in adapter from `cmux`/`Cmux CLI` to `xmux`/`xmux`.
- Keep the adapter command as `cmux` because the installed executable is still `/usr/local/bin/cmux`.
- Update capability presets so `xmux` receives the same capability ceiling that `cmux` previously had.
- Keep backward compatibility for legacy configured adapters with id `cmux` where practical.
- Add a user-facing xmux guide under `docs/guides/features/xmux.md`.
- Record this work in `.project-manager/config.json` as F27 with canonical feature artifact paths.

## Non-Goals

- No separate `xmux` repo in this iteration.
- No fork of `manaflow-ai/cmux`.
- No bundled cmux binary or redistributed cmux source.
- No Project Manager socket client for `/tmp/cmux.sock` yet.
- No automated browser-pane control from Project Manager yet.
- No live notification feed ingestion into Project Manager yet.
- No schema version bump unless a persisted xmux-specific config model is introduced.

## UX Requirements

- The sidebar remains compact and job-based.
- `xmux` sits under Execution because it is a coding execution/control tool.
- The view should resemble the actual xmux/cmux interoperability surface: a left workspace/project list and a main terminal/browser split-pane workspace.
- The terminal, browser, notification, and split controls must be interactive rather than decorative.
- The view must make the current boundary visible: Project Manager delegates to a user-installed `cmux` command today; deeper socket/browser/notification integration is future work.
- The view should show installed-path assumptions and command examples without exposing secrets.
- The view should frame xmux as composable primitives, not a prescribed AI workflow.
- Empty/degraded states should be explicit, especially when `cmux` is not installed or not symlinked.

## Technical Design

### Navigation

- Add `xmux` to the Execution group in `app/ui/Sidebar.tsx`.
- Use a lucide icon consistent with coding-tool execution.
- Add a static route in `app/xmux/page.tsx`.

### View

- Add `app/ui/views/XmuxView.tsx`.
- Include sections for:
  - workspace sidebar,
  - right-top toolbar semantics for browser, notifications, and split layout,
  - terminal/browser split-pane topology,
  - allowlisted terminal command execution,
  - iframe browser navigation,
  - command contract,
  - Project Manager integration boundary.

The view is a Project Manager interop control surface, not a marketing feature-card page or static preview.

### Adapter Registry

- Change the built-in agent CLI adapter:
  - `id`: `xmux`
  - `name`: `xmux`
  - `command`: `cmux`
  - `argsTemplate`: initially keep the existing command shape unless tests reveal it is invalid.
- Preserve a compatibility path for user configs that still include `cmux`.
- Do not vendor or package cmux. The integration uses a user-installed cmux command and should identify cmux as a third-party Manaflow project in docs.

### Documentation

- Create `docs/guides/features/xmux.md` with public frontmatter.
- Include official cmux source links and current Project Manager behavior.
- Keep internal implementation details in F27 feature docs and dev log.

## Acceptance Criteria

- `/xmux` renders in browser mode.
- Sidebar shows `xmux` under Execution and highlights it when active.
- TopBar shows `xmux`.
- `listAdapters()` includes `xmux` as the built-in cmux-backed agent CLI target.
- `listAdapters()` does not show duplicate `cmux` and `xmux` entries for a default config.
- Legacy configured adapter id `cmux` is still surfaced as `xmux` or otherwise remains dispatchable.
- `docs/guides/features/xmux.md` exists and is included in regenerated documentation manifests.
- Typecheck and focused tests pass.

## Risks

| Risk | Mitigation |
|---|---|
| `cmux run --cwd` may not match the current cmux CLI contract. | Document as current inherited adapter contract and keep follow-up to confirm real dispatch contract before treating it as live execution. |
| Sidebar item could become a marketing page. | Keep it operational: command, status, capability boundary, next actions. |
| Public doc could overpromise future features. | Separate current Project Manager behavior from cmux upstream capabilities and future roadmap. |
| Legacy `cmux` configs could disappear. | Add adapter compatibility logic and test coverage. |
