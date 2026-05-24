# F25 Feature Spec: Monaco Editor Workbench

## Problem

Project Manager already depends on `@monaco-editor/react` and has a reusable `CodeEditor` component, but the current `/coding-editor` page still presents primarily as a project files table and opens Monaco as a modal. This makes Monaco feel like a helper action rather than a first-class editor plugin.

The user wants `/coding-editor` to be replaced with a Monaco Editor plugin surface, using `microsoft/monaco-editor` capability inside Project Manager's project scope.

## Goals

1. Make `/coding-editor` a Monaco-first workbench.
2. Keep Project Manager's project scope and bridge boundaries intact.
3. Let users browse mapped project files and open them in Monaco without leaving the page.
4. Keep saves explicit, visible, and safe.
5. Register Monaco as a built-in frontend/editor plugin in the integrations model.
6. Provide tests that reflect realistic user workflows, not only component snapshots.

## Non-Goals

- Do not clone `microsoft/monaco-editor` into `.project-manager/vendor/`.
- Do not run Monaco as a native sidecar process.
- Do not replace external IDE integration globally.
- Do not add language server protocol support in this iteration.
- Do not add multi-user collaborative editing.
- Do not write or expose raw credentials through the editor.

## Architecture Decision

Monaco Editor is a frontend/editor plugin, not a CLI plugin.

Reasoning:

- Hermes/OpenClaw are sidecar runtimes and belong under `.project-manager/vendor/`, `.project-manager/bin/`, and project-local state folders.
- Monaco is already a React/browser editor dependency and runs inside the renderer.
- The repo's plugin guide classifies Monaco-like packages as static/frontend editor plugins, while TypeScript adapter integration belongs in source.
- The safest first step is to promote the existing `CodeEditor` component into a full-page workbench and record Monaco in integration metadata.

## Current Implementation Evidence

- Dependency: `@monaco-editor/react` in `package.json`.
- Reusable editor: `components/CodeEditor.tsx`.
- Existing route: `app/coding-editor/page.tsx`.
- Existing shell mount: `app/ui/MainClient.tsx` renders `ProjectFilesView` for `coding-editor`.
- Existing file list/editor controls: `app/ui/views/ProjectFilesView.tsx`.

## Functional Requirements

### Workbench Layout

- `/coding-editor` renders a full-page Monaco workbench, not a modal-first file table.
- Use the existing Project Manager workstation style:
  - compact header
  - project context visible
  - left file/source panel
  - main editor panel
  - bottom or side status/testing panel if needed
- Keep bottom project tabs when multiple dashboard projects are selected.
- Keep responsive behavior usable on narrower desktop widths.

### Project File Source

- Show files derived from the selected dashboard project and mapped feature paths.
- Preserve existing behavior for multiple selected dashboard projects.
- Allow users to select a file and open it in the editor pane.
- Include empty states:
  - no project loaded
  - project loaded but no mapped files
  - selected file cannot be read

### Monaco Editing

- Open selected files in Monaco tabs.
- Preserve language detection from file extension.
- Support dirty state per file.
- Cmd/Ctrl+S saves the active file.
- Go-to-line remains available.
- External editor open remains secondary, not the primary page mode.
- Save failures show a visible error state.
- Successful saves clear dirty state and update status.

### Diff Support

- Existing `CodeEditor` diff capability should remain available for future use.
- This iteration does not need a new UI entry for arbitrary diff comparisons unless already present.

### Plugin/Integration Metadata

- Add a Monaco integration registry/marketplace entry as a project-scoped frontend/editor plugin.
- Status should communicate that Monaco is built into the app through `@monaco-editor/react`.
- It should not appear as a CLI command that can be toggled for agent dispatch.

### Runtime and Security Boundaries

- Browser mode may read/write only through existing supported bridge/server behavior.
- Tauri mode uses existing bridge wrappers for file operations.
- Do not store raw file contents in plugin catalog metadata.
- Do not expose credentials from `.env` files beyond the user explicitly opening the file.
- If a file is not editable or read fails, the editor must show failure, not fake content as if it loaded successfully.

## User Scenarios

### Scenario 1: Engineering User Opens A Feature File

Given a project has mapped feature files, when the user opens `/coding-editor`, they can select a feature artifact and it opens in Monaco inside the page. The selected project context remains visible.

### Scenario 2: User Edits And Saves In Tauri

Given Project Manager is running in Tauri mode, when the user edits a file and presses Cmd+S, Project Manager writes the file through the bridge, clears dirty state, and shows a saved status. If the write fails, the file remains dirty and the error is visible.

### Scenario 3: Browser Mode Degrades Clearly

Given Project Manager is running in browser mode and a local file operation is not available, the editor shows a readable blocked/error state. It must not imply that a file was saved when the write did not happen.

### Scenario 4: Multi-File Editing

Given a user opens multiple files from the file panel, each file appears as a Monaco tab. Switching tabs preserves contents and dirty state.

### Scenario 5: User Opens Unsupported Or Large File

Given a binary, very large, or unsupported file path is selected, the workbench should show a clear unsupported/read-failed state. It should not freeze the page or display corrupted content as normal.

### Scenario 6: User Uses External Editor Escape Hatch

Given a user needs a full IDE, they can open the active file in the configured external editor from the Monaco workbench without changing the primary Monaco-first page.

### Scenario 7: Product/PM User Reviews Specs

Given a product user wants to review `README.md`, `feature-spec.md`, or `tdd-spec.md`, they can open Markdown artifacts in Monaco, inspect them with stable tabs, and avoid OS app switching.

### Scenario 8: Plugin Reviewer Checks Monaco Capability

Given a maintainer opens Integrations Hub, Monaco appears as a built-in editor/frontend plugin with project scope and implementation path metadata, not as a sidecar runtime.

## Acceptance Criteria

- `/coding-editor` shows a Monaco-first workbench.
- Opening a mapped file renders Monaco in the main panel without modal overlay.
- Existing `CodeEditor` save shortcut continues to work.
- Dirty state is visible before save and cleared after a successful save.
- Save failures are visible and do not clear dirty state.
- Multi-file tab behavior is covered by tests.
- No project / no files / read failure states are explicit.
- Monaco appears in plugin/integration metadata as built-in/project-scoped.
- `npm run typecheck`, relevant tests, `npm run docs:check`, and `npm run build` pass or have documented blockers.

## Risks

- Monaco worker loading may behave differently between Next dev, static export, and Tauri.
- Existing `CodeEditor` uses hard-coded colors that may keep standards P2 warnings alive.
- Large files can hurt renderer performance.
- Browser-mode file writes may be limited compared with Tauri mode.
- Refactoring `/coding-editor` can accidentally regress Project Files behavior if code is not separated cleanly.

## Implementation Plan

1. Add Monaco plugin metadata to integration registry/marketplace.
2. Split file-list logic from `ProjectFilesView` if needed so the Monaco workbench can reuse it without keeping the old table-first page.
3. Create `MonacoEditorWorkbench` under `app/ui/views/`.
4. Render selected files in an embedded `CodeEditor` panel instead of a modal.
5. Add focused tests for workbench empty states, tab opening, and save-status behavior.
6. Verify in browser mode and, if feasible, Tauri mode.
