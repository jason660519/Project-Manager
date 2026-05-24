# F25 Monaco Editor Workbench

## Summary

Replace the current `/coding-editor` experience with a Monaco-first in-app workbench. The page should behave as a project-scoped editor plugin surface: users choose project files, open one or more Monaco tabs, edit safely, save through the existing bridge, and still have an escape hatch to external editors when needed.

## Scope

- Treat Monaco Editor as a Project Manager project-scoped frontend/editor plugin, not as a cloned sidecar runtime.
- Rework `/coding-editor` from a project-files table with a modal editor into a full-page Monaco workbench.
- Keep file access inside the active Project Manager project scope.
- Preserve existing `components/CodeEditor.tsx` strengths: tabs, language detection, save, go-to-line, diff support, and external editor handoff.
- Add plugin/integration metadata so Monaco appears as a built-in project-scoped editor capability.
- Cover user scenarios for non-technical project review, engineer code editing, multi-file editing, browser-mode degradation, Tauri save behavior, dirty-state protection, and unsupported file handling.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- Dev log: `dev-log.md`

## Current Status

Planning artifacts created before implementation. Implementation is pending.
