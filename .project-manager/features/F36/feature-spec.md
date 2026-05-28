# F36: Performance Baseline, Route Splitting & xmux Smoothness

## Purpose

Improve Project Manager's perceived UI responsiveness through measured, low-risk frontend changes. The work starts with route-level client bundle reduction, then uses the same baseline to decide whether xmux runtime changes are needed.

## Background

The initial investigation found that the repo builds successfully and quickly, but `MainClient` imports many view components up front. That means users opening one route can still pay for code belonging to unrelated routes such as xmux, documentation, keys, chat, integrations, and project dashboard surfaces.

The largest generated static client chunk observed during the baseline was about 1.57 MB. The most actionable first slice is to split non-active heavy views into separate client chunks while keeping the existing app shell, navigation, project context, and route behavior unchanged.

## User Stories

### US-01: Open the dashboard without paying for every view

**As a** user opening Project Manager  
**I want** the dashboard route to load only the shell and dashboard code it needs  
**So that** first interaction is faster and unrelated views do not inflate the initial route bundle

### US-02: Switch to a lazy view with visible feedback

**As a** user clicking xmux, keys, documentation, chat, or integrations  
**I want** a compact loading state while the view chunk loads  
**So that** the app does not look frozen during route-level code loading

### US-03: Keep xmux resize smooth

**As a** user resizing xmux panes with terminal and browser tabs  
**I want** pane resizing to stay responsive  
**So that** native browser bounds sync and layout persistence do not compete with pointer movement

### US-04: Preserve native browser state

**As a** user switching xmux browser tabs or workspaces  
**I want** browser sessions to remain attached and correctly bounded  
**So that** route splitting does not regress native webview behavior

### US-05: Let future engineers continue from evidence

**As a** future maintainer  
**I want** performance changes to include baseline numbers, focused tests, and dev logs  
**So that** optimization work does not become speculative cleanup

## Functional Requirements

- Dynamically import heavy view components from `MainClient` when they are not needed for the current route.
- Show a compact, shell-compatible loading state for dynamically loaded views.
- Keep route props intact for:
  - integrations sheet selection
  - keys sheet selection
  - documentation slug selection
  - assistant sheet selection
  - dashboard project context
- Preserve existing navigation and selected-project state.
- Keep Development sheet metadata current for this feature.
- Do not remove dependencies or files unless a later cleanup pass proves they are unused and covered by tests.

## Technical Requirements

- Use `next/dynamic` from a client component for route view chunk splitting.
- Use named-export dynamic imports where current modules do not default-export the view.
- Keep the dynamic loading component small and free of heavy imports.
- Avoid `ssr: false` unless a component requires browser-only execution at import time.
- Add tests that confirm each lazy route still renders its intended view shell or fallback.
- Keep xmux behavior changes isolated to `app/ui/views/XmuxView.tsx`, `components/browser/*`, or `components/terminal/*` if follow-up optimization is needed.

## Acceptance Criteria

1. F36 appears in Project Dashboard > Development sheet with README, feature spec, TDD spec, user scenarios, and dev log paths.
2. `MainClient` no longer statically imports every heavy view component needed only by inactive routes.
3. Dashboard, xmux, keys, documentation, chat, integrations, settings, logs, sessions, cron jobs, engineers, channels, features, and company standards routes still render.
4. Lazy-loaded routes show a compact loading state rather than a blank shell while their chunk loads.
5. Focused tests cover route rendering and at least one lazy fallback path.
6. `npm run typecheck` and focused tests pass before broader checks.
7. Build output is compared with the baseline and recorded in `dev-log.md`.

## Open Decisions

- Whether to split dashboard internals separately after the route-level split.
- Whether xmux browser bounds sync should stay frame-based only while visible/active, or move to event-driven updates with a short RAF settling window.
- Whether dead-code tooling should be added as a separate maintenance feature after measured runtime improvements land.
