# F25 TDD Spec: Monaco Editor Workbench

## Test Strategy

The workbench needs tests around behavior and state transitions, not only rendering. The goal is to protect user workflows: selecting files, opening Monaco tabs, editing, saving, dealing with missing capabilities, and exposing plugin metadata correctly.

## Unit Tests

### Monaco plugin metadata

- Registry returns a Monaco row with:
  - project scope
  - frontend/editor category
  - implementation path
  - no CLI command
  - no sidecar state path
- Marketplace or installed mapping treats Monaco as built-in/available, not agent-dispatchable.

### File row extraction

- Builds file rows from selected project feature paths.
- Deduplicates repeated file paths.
- Keeps canonical labels for known artifacts.
- Ignores empty path values.
- Preserves enough metadata to show project, feature, path, and artifact kind.

### Language detection

- Maps `.ts`, `.tsx`, `.js`, `.json`, `.md`, `.css`, `.py`, `.rs`, `.sh`, `.env`, and unknown extensions.
- Unknown extension falls back safely.

## Component Tests

### Empty states

1. No projects loaded:
   - Shows `No projects loaded`.
   - Does not render a fake editor.

2. Project loaded but no mapped files:
   - Shows a no files state.
   - Does not render stale editor content.

3. File read failure:
   - Shows read failure or blocked state.
   - Does not mark the file as cleanly loaded.

### Open file scenario

- Render workbench with one project and mapped files.
- Click a file row.
- Editor pane shows a tab/header for that file.
- Active file metadata shows path/project/feature.

### Multi-file scenario

- Open two files.
- Both tabs are visible.
- Switching tabs preserves active file.
- Closing one tab leaves the other open.
- Closing the last tab returns to an empty editor state.

### Dirty/save scenario

- Change editor content.
- Dirty indicator appears.
- Save button becomes enabled.
- Successful `writeFile` clears dirty state.
- Failed `writeFile` keeps dirty state and shows an error message.

### Keyboard scenario

- Cmd/Ctrl+S triggers save for active file.
- Cmd/Ctrl+G opens go-to-line controls.
- Shortcuts do not run when no active file exists.

### External editor scenario

- External editor button calls the existing `openInEditor` bridge wrapper for the active file.
- If external editor call fails, Monaco tab remains open and the error is visible or logged in a recoverable way.

## Integration Tests

### Route and shell

- `/coding-editor` maps to `currentView="coding-editor"`.
- `MainClient` renders the Monaco workbench for the coding-editor view.
- Sidebar/topbar labels remain stable.

### Project selection

- When multiple dashboard project IDs are selected, project tabs appear.
- Active project changes the available file list.
- Open editor tabs are cleared or scoped when active project changes, avoiding cross-project confusion.

### Plugin hub metadata

- Integrations Hub can search for `Monaco`.
- Monaco row communicates built-in project-scoped editor/plugin capability.
- Monaco row does not expose secret-like payload keys.

## User Scenario Test Matrix

| Scenario | Automated Coverage | Manual Coverage |
| --- | --- | --- |
| Engineer opens mapped TypeScript file | Component test | Browser click-through |
| Product user opens Markdown spec | Component test | Browser click-through |
| Multi-file editing | Component test | Browser tab switching |
| Save success | Mocked bridge write test | Tauri smoke test if available |
| Save failure | Mocked bridge rejection test | Browser blocked-state check |
| Browser mode file limitations | Mocked bridge rejection test | Browser route check |
| Unsupported file | Unit/component test | Manual large/binary file check |
| Plugin metadata | Unit test | Integrations Hub search |

## Manual Verification Checklist

1. Open `http://127.0.0.1:43187/coding-editor`.
2. Confirm the page is Monaco-first, not a table-first modal flow.
3. Select a Markdown feature spec and confirm Monaco opens in-page.
4. Open a TypeScript file and confirm syntax highlighting.
5. Open two files and switch tabs.
6. Edit a file and confirm dirty state appears.
7. Save and confirm state clears, or see explicit failure in browser mode.
8. Open Integrations Hub and search `Monaco`.
9. Check desktop width and narrow viewport for overflow.

## Required Commands

```bash
npm run test -- __tests__/monacoEditorWorkbench.test.tsx __tests__/integrations.registry.test.ts
npm run typecheck
npm run docs:check
npm run build
```

## Known Follow-Up Tests

- Tauri full write smoke test with a disposable temp file.
- Monaco worker/static export check after production build.
- Large-file threshold test once a file-size policy is implemented.
