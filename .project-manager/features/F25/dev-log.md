# F25 Dev Log

## 2026-05-25

- Created F25 dashboard feature entry for the Monaco Editor Workbench before implementation.
- Confirmed `@monaco-editor/react` is already installed in `package.json`.
- Confirmed existing reusable editor component at `components/CodeEditor.tsx`.
- Confirmed current `/coding-editor` route is mounted through `app/coding-editor/page.tsx` and `app/ui/MainClient.tsx`, rendering `ProjectFilesView`.
- Confirmed current `ProjectFilesView` is table-first and opens Monaco in a modal via `openEditorFiles`.
- Checked current Monaco integration guidance:
  - `microsoft/monaco-editor` supports direct editor creation and worker setup.
  - `@monaco-editor/react` supports React lifecycle callbacks, model paths, `onMount`, `onChange`, validation, and Next.js client-only usage.
- Architecture note:
  - Monaco should not be cloned into `.project-manager/vendor/` because it is not a native sidecar runtime like Hermes/OpenClaw.
  - Monaco should be treated as a built-in frontend/editor plugin or TypeScript adapter surface.
- Wrote feature spec with user scenarios for:
  - engineer opens feature file
  - Tauri save
  - browser-mode degradation
  - multi-file editing
  - unsupported/large file handling
  - external editor escape hatch
  - PM/product spec review
  - plugin reviewer metadata check
- Wrote TDD spec with unit, component, integration, and manual test coverage expectations.
- Implementation not started yet. Next step is to add Monaco plugin metadata and replace `/coding-editor` with a Monaco-first workbench.

### Implementation Update

- Added `frontend` as a first-class plugin kind and registered `Monaco Editor Workbench` as a project-scoped frontend plugin.
- Added Monaco registry and marketplace metadata:
  - source package: `@monaco-editor/react`
  - upstream reference: `microsoft/monaco-editor`
  - implementation path: `app/ui/views/MonacoEditorWorkbench.tsx`
- Replaced the old table-first `ProjectFilesView` implementation with a compatibility export to the new Monaco workbench.
- Implemented `MonacoEditorWorkbench`:
  - derives editable files from feature README/spec/TDD/dev-log/implementation/test paths
  - keeps Dashboard-selected project scoping and bottom project sheet tabs
  - supports feature filtering and text search
  - opens selected files as Monaco tabs in the primary editor area
  - keeps external editor access through the existing `CodeEditor` action
- Improved `CodeEditor` failure behavior:
  - read failures now show a visible error banner instead of fake file contents
  - save failures now show a visible error banner and preserve dirty state
- Added/updated tests:
  - `__tests__/monacoEditorWorkbench.test.tsx`
  - `__tests__/ProjectFilesView.test.tsx`
  - `__tests__/integrations.registry.test.ts`
- Verification completed:
  - `npm run -s test -- __tests__/monacoEditorWorkbench.test.tsx __tests__/ProjectFilesView.test.tsx __tests__/integrations.registry.test.ts`
  - Result: 3 files / 11 tests passed.

### Final Verification

- `npm run -s test`
  - Result: 74 files / 555 tests passed.
- `npm run -s typecheck`
  - Result: passed.
- `npm run -s build`
  - Result: passed, including static generation for `/coding-editor`.
- `npm run -s docs:check`
  - Result: passed.
- `npm run -s standards:check`
  - Result: exit 0 with the existing P2 hard-coded color warning.
- Browser sanity check:
  - Opened `http://127.0.0.1:43187/coding-editor`.
  - Confirmed `Monaco Editor` heading and project-scoped frontend plugin summary render.
  - Current browser dashboard scope was set to `Company-AI-App-Standards`, so that live session showed zero editable files until the Project Manager project is selected. The source `.project-manager/config.json` now contains F25 with 25 total features.
