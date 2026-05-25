# F27: xmux Coding Tool Sidebar Entry

Status: in_progress  
Category: Execution  
Phase: Development  
Created: 2026-05-25  

## Summary

F27 adds `xmux` as the Project Manager-facing name for the cmux coding-tool integration. The first implementation is intentionally small: one sidebar item under Execution, one operational `xmux` view, and a renamed built-in agent CLI adapter that still invokes the installed `cmux` binary.

## User Value

Project Manager users need a clear entry point for a multi-agent coding terminal without turning it into a separate project or a broad plugin redesign. `xmux` gives the sidebar a focused coding-tool surface while preserving the current adapter architecture.

## Design Philosophy

xmux explicitly avoids prescribing how developers must use AI. It is not a closed workflow product. It packages terminals, browsers, notifications, workspaces, splits, tabs, and CLI controls as composable building blocks so each developer can shape an AI collaboration workflow that fits their codebase.

## Scope

- Add a sidebar item named `xmux`.
- Add a Project Manager view that mirrors the intended xmux interoperability interface: workspace sidebar plus interactive terminal/browser split-pane topology.
- Rename the built-in `cmux` CLI adapter to `xmux` while delegating to the existing `cmux` command.
- Publish a user-facing xmux guide under `docs/guides/features/`.
- Keep full PTY, deeper cmux socket, and browser automation wiring as documented follow-up work.
- Do not bundle, fork, or redistribute cmux in this iteration; Project Manager integrates with a user-installed third-party cmux command.

## Source References

- Official cmux getting started: https://cmux.com/docs/getting-started
- Official cmux concepts: https://cmux.com/docs/concepts
- Official cmux API reference: https://cmux.com/docs/api
- Official cmux browser automation: https://cmux.com/docs/browser-automation
- Official cmux notifications: https://cmux.com/docs/notifications
- Official cmux SSH: https://cmux.com/docs/ssh
- Official cmux Claude Code Teams: https://cmux.com/docs/agent-integrations/claude-code-teams
- Official cmux session restore: https://cmux.com/docs/session-restore
