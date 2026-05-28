# F37 - Windows Font Zoom Shortcuts and Global Font Scaling

## Summary

Project Manager needs desktop-level font scaling so users can enlarge or shrink the entire interface without leaving the app. The first implementation slice adds Windows global shortcuts for font zoom and a frontend scaling layer that clamps zoom to a safe, predictable range.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Desktop Runtime
- Owner: Codex
- Created: 2026-05-28

## Scope

- Register Windows desktop shortcuts for zoom in and zoom out through Tauri's global shortcut plugin.
- Emit backend shortcut events to the frontend and apply a global scale across the shell.
- Persist the selected scale for reload/restart continuity.
- Cover clamp, step, persistence, and unavailable-storage behavior with focused tests.
- Record Windows-specific manual verification limits when the current environment cannot press Windows OS shortcuts.

## Non-Goals

- Replacing the full Project Manager layout or typography system.
- Adding a full user-configurable shortcut editor.
- Supporting browser-only global OS shortcuts outside Tauri.
- Changing secrets, schema version, provider settings, or `.env` behavior.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
