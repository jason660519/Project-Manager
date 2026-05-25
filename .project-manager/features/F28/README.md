# F28: xmux Pane Unification, Stable Browser State & Smooth Resize

Status: in_progress
Category: Execution
Phase: Development
Created: 2026-05-25
Depends on: F27 (xmux Coding Tool Sidebar Entry)

## Summary

F27 shipped the first xmux view: a sidebar item, a workspace list, and a static three-block layout (terminal-a, optional browser pane, terminal-b). During hands-on use we found the blocks felt structurally inconsistent, the browser pane lost state on every "New Browser" action, and the resize handles stuttered when the cursor crossed an iframe or xterm canvas.

F28 turns the xmux interop console from a hand-assembled mock into a small, internally-consistent primitive:

- One shared `PaneShell` chrome (tab strip + 4-icon action toolbar) used by both terminal and browser panes.
- Multi-tab BrowserPane with per-workspace tab state — "New Browser" appends a tab instead of overwriting the URL.
- Resize dividers that drag smoothly across iframes, xterm, and notification panels via a transparent overlay during drag plus rAF-throttled state updates.

## User Value

Users dispatch real work through the xmux view and expect terminal/browser/split mechanics to behave consistently. F28 removes the most common friction points reported within the first 24h of F27:

- "I clicked the browser icon and lost what I was reading."
- "Dragging the divider stutters if my mouse goes over the terminal."
- "The browser block looks taller than the terminal block — it feels like a different widget."

## Out of Scope

- Dynamic pane tree (true tmux-style split that creates a brand-new pane) → tracked as future F29 candidate.
- localStorage persistence of layout → future F29 candidate.
- Cross-session restore of browser history → future work.

## Linked Files

- [feature-spec.md](./feature-spec.md) — problem, goal, scope, user scenarios.
- [tdd-spec.md](./tdd-spec.md) — test plan (unit + component + E2E).
- [dev-log.md](./dev-log.md) — running notes; reference for follow-up engineers.
