# F34: Xmux AI Assistant Block and Browser Tools

## Summary

Dock the existing AI Assistant chat surface under the Xmux Workspaces area and extend the Xmux browser chrome with operator tools for reload, URL copy, zoom, browsing-data cleanup, screenshot workflows, element selection, console visibility, and CSS inspection.

## Scope

- Keep pane tools focused on terminal, browser, folder, split, and close actions.
- Remove the pane-toolbar AI Assistant tab implementation to avoid duplicate assistant surfaces.
- Use the Workspaces docked assistant as the single Xmux assistant display surface.
- Add browser chrome actions requested for Xmux browser panes.
- Keep native webview actions behind typed bridge wrappers in `lib/bridge/index.ts`.
- Provide clear browser-mode fallback messaging when an action requires Tauri.

## User Value

Xmux becomes a workspace control surface where the user can inspect a site, copy DOM context, reload or clean browser state, and review selected-element DOM output in the docked assistant without leaving the Xmux layout.

## Primary Artifacts

- Spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- Test scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
