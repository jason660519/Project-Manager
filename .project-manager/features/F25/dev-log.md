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

### Continuation Update

- Re-reviewed the Workbench against current Monaco Editor and `@monaco-editor/react` documentation:
  - Monaco supports standalone editors, diff editors, custom markers, editor actions, commands, themes, language modes, minimap, suggestions, and layout APIs.
  - `@monaco-editor/react` supports multi-model editing through the `path` prop with view-state preservation.
- Upgraded `components/CodeEditor.tsx` so the in-page Workbench now behaves more like a Monaco workbench:
  - uses Monaco model `path` and `saveViewState` for file-backed tab models
  - enables automatic layout, minimap, suggestions, folding, links, and parameter hints
  - adds toolbar actions for command palette, find, outline, saved-vs-working diff, word wrap, and minimap
  - adds saved-vs-working diff view for normal editable files, not only externally supplied diff props
  - tracks cursor position and problems in the status bar
  - projects read/save/external-editor failures into visible Monaco markers instead of only rendering a banner
  - resets the saved diff baseline after successful saves
- Tightened browser-mode file reads in `lib/bridge/index.ts`:
  - failed `/api/editor/read-file` calls now throw the server error instead of silently returning an empty string.
  - this prevents read failure from looking like a successfully loaded empty file.
- Added `__tests__/CodeEditor.test.tsx` covering:
  - model path + view-state props
  - saved-vs-working diff
  - read failure problem state
  - command/find/outline actions
  - save resetting the diff baseline
- Verification completed:
  - `npm run -s test -- __tests__/CodeEditor.test.tsx __tests__/monacoEditorWorkbench.test.tsx __tests__/ProjectFilesView.test.tsx __tests__/integrations.registry.test.ts __tests__/adapterRegistry.plugin.test.ts`
    - Result: 5 files / 20 tests passed.
  - `npm run -s typecheck`
    - Result: passed.
  - `npm run -s build`
    - Result: passed, including static generation for `/coding-editor`.
  - Browser sanity check:
    - Started an observable dev server on `http://127.0.0.1:43188`.
    - Opened `/coding-editor` and confirmed the VS Code-style Workbench shell renders with Activity Bar, Explorer, Open Editors, Quick Open, Problems, feature-grouped files, and the empty editor state.

### VS Code-Style Workbench Update

- Acknowledged that the previous continuation still felt like an embedded editor, not a commercial IDE-grade workbench.
- Checked `monaco-vscode-api` documentation as the likely next architecture step for full VS Code services, extension host, TextMate, LSP, explorer/search/markers/output/terminal service overrides.
- Implemented the first commercial workbench layer in `app/ui/views/MonacoEditorWorkbench.tsx`:
  - Activity Bar with `Explorer`, `Search`, `Problems`, and `Output`.
  - Explorer panel with `Open Editors` plus feature-grouped file sections.
  - Search panel with query and feature filtering.
  - Problems panel backed by blocked feature files.
  - Output panel with live workbench/project/editor state lines.
  - Quick Open dialog with `Cmd/Ctrl+P` shortcut and file matching.
  - Editor breadcrumb row and VS Code-like bottom panel.
- Expanded `__tests__/monacoEditorWorkbench.test.tsx`:
  - validates activity panels and Quick Open dialog.
  - validates Quick Open opens files into the editor.
  - validates blocked feature rows appear in Problems.
  - keeps project sheet switching and search/filter behavior covered.
- Verification completed:
  - `npm run -s test -- __tests__/monacoEditorWorkbench.test.tsx __tests__/CodeEditor.test.tsx`
    - Result: 2 files / 13 tests passed.
  - `npm run -s test -- __tests__/CodeEditor.test.tsx __tests__/monacoEditorWorkbench.test.tsx __tests__/ProjectFilesView.test.tsx __tests__/integrations.registry.test.ts __tests__/adapterRegistry.plugin.test.ts`
    - Result: 5 files / 23 tests passed.
  - `npm run -s typecheck`
    - Result: passed.

### Remaining Gap To True VS Code Level

- The current implementation is now a VS Code-style Project Manager workbench shell, but not yet a full VS Code service runtime.
- True VS Code-level editor behavior still requires a dedicated architecture pass for:
  - `monaco-vscode-api` service overrides.
  - extension host initialization.
  - TextMate grammar/theme service.
  - language-server lifecycle and project-scoped LSP wiring.
  - real workspace file search beyond mapped feature artifacts.
  - terminal/debug service boundaries through Tauri.

### Native IDE Bridge Update

- Chose the legally cleaner integration model for native IDE apps:
  - Project Manager does not bundle, embed, redistribute, or rebrand third-party IDEs.
  - The Workbench delegates to user-installed IDE commands through the existing Tauri `open_in_editor` bridge.
- Added an `IDE Bridge` activity to `app/ui/views/MonacoEditorWorkbench.tsx`:
  - target selector for configured IDE adapters and built-in defaults.
  - preferred target based on `project.defaultIDE`.
  - `Open Workspace in IDE` dispatches the project root to the selected IDE.
  - `Open Active File in IDE` dispatches the current Workbench file to the selected IDE.
  - browser preview status explains that real opens run in the desktop app.
  - visible scope copy states that Project Manager uses the user-installed IDE command and does not bundle or embed third-party IDE apps.
- Added `buildIdeBridgeTargets` coverage in `__tests__/monacoEditorWorkbench.test.tsx`:
  - validates project adapter targets.
  - validates default IDE fallback/preferred selection.
  - validates workspace and active-file bridge calls.
- Verification completed:
  - `npm run -s test -- __tests__/monacoEditorWorkbench.test.tsx __tests__/CodeEditor.test.tsx __tests__/ProjectFilesView.test.tsx __tests__/integrations.registry.test.ts __tests__/adapterRegistry.plugin.test.ts`
    - Result: 5 files / 26 tests passed.
  - `npm run -s typecheck`
    - Result: passed.
  - `npm run -s build`
    - Result: passed, including static generation for `/coding-editor`.
  - Browser sanity check:
    - Opened `http://127.0.0.1:43188/coding-editor`.
    - Confirmed the `IDE Bridge` panel, legal/scope copy, target list, workspace button, and active-file button render in the live Workbench.
    - Screenshot capture timed out in the in-app browser, but DOM verification completed successfully.

### IDE Bridge Product Reset

- Removed the fake VS Code-style workbench direction from `/coding-editor`.
- Replaced `app/ui/views/MonacoEditorWorkbench.tsx` with `app/ui/views/IdeBridgeView.tsx`:
  - no embedded Monaco editor area in the Coding Editor route.
  - no Explorer/Search/Problems/Output/Quick Open panels.
  - left toolbar is now dedicated to IDE target selection.
  - bottom sheet tabs remain the project selector.
  - main surface focuses on opening the selected workspace, config, or project artifact in the selected user-installed IDE.
  - install/status copy clearly distinguishes browser preview from the desktop Tauri launch path.
  - bridge contract states Project Manager invokes local commands and does not emulate, bundle, or redistribute third-party IDE apps.
- Updated plugin metadata:
  - built-in frontend plugin id changed from `monaco-editor` to `ide-bridge`.
  - implementation path changed to `app/ui/views/IdeBridgeView.tsx`.
  - catalog/registry copy now describes a native IDE bridge instead of a Monaco editor plugin.
- Reworked tests:
  - replaced `__tests__/monacoEditorWorkbench.test.tsx` with `__tests__/ideBridgeView.test.tsx`.
  - updated `__tests__/ProjectFilesView.test.tsx` to assert the new IDE Bridge shape.
  - updated registry/plugin tests for `ide-bridge`.
- Verification completed:
  - `npm run -s test -- __tests__/ideBridgeView.test.tsx __tests__/ProjectFilesView.test.tsx __tests__/integrations.registry.test.ts __tests__/adapterRegistry.plugin.test.ts`
    - Result: 4 files / 19 tests passed.
  - `npm run -s typecheck`
    - Result: passed.
  - `npm run -s build`
    - Result: passed, including static generation for `/coding-editor`.
