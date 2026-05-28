# F36 - Performance Baseline, Route Splitting & xmux Smoothness

## Summary

Create a measured performance-improvement checkpoint for Project Manager before broad cleanup. The first implementation slice focuses on reducing initial client JavaScript loaded through `MainClient`, preserving route behavior, and preparing targeted xmux runtime optimizations for resize, native browser bounds sync, and layout persistence.

## Current State

- Status: in_progress
- Progress: 60%
- Phase: development
- Owner: Codex
- Created: 2026-05-28

## Scope

- Capture and document current build/bundle baseline before changing runtime behavior.
- Split heavy route views out of the initial `MainClient` client bundle using Next.js dynamic imports.
- Keep visible loading, empty, and blocked states consistent with the existing desktop shell.
- Add focused tests around lazy route rendering and user-visible fallbacks.
- Prepare xmux-specific follow-up tests for browser pane resize, tab switching, and persistence behavior.
- First slice implemented: route-level dynamic imports from `MainClient`.

## Non-Goals

- Running broad dead-code deletion as the primary performance fix.
- Rewriting the Project Manager shell or route architecture.
- Replacing xmux native webview or terminal registries.
- Changing Tauri IPC command contracts.
- Adding a new top-level navigation item.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
