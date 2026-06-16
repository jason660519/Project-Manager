# F53 Dev Log - Workflow Graph Execution Console

## 2026-06-16 - Kickoff and Planning

- Started F53 as the next slice after F52 Project Workflow Loop Engine.
- Product direction: upgrade AI Assistants > Workflow Runs from an old
  agent-workflow table into a Project Workflow graph execution console.
- User clarified the desired UI should feel closer to n8n or ComfyUI:
  feature/work item workflow represented as nodes with visible agents, prompts,
  tools, memory files, handoffs, evidence, and approval gates.
- Selected UX direction:
  - graph canvas + inspector as primary layout;
  - optional swimlane grouping later;
  - rich node details in inspector/expanded node state.
- Scope lock for first implementation:
  - Project Workflow run visualization and inspection only;
  - manual/review-first actions only;
  - no automatic agent/tool execution.

## Planned Test Coverage

- Unit: Project Workflow run to graph view-model projection.
- Integration: AI Assistants Workflow Runs tab renders graph and inspector.
- E2E/manual: browser smoke for `/ai_assistants/workflow-runs`.

## Risks

- Existing Workflow Runs tab is based on `agent-workflows`; replacing it must not
  break the AI Assistants route.
- Graph UI can become visually crowded; first slice should use fixed readable
  layout before adding drag/drop or zoom.
- Prompt/tool/memory metadata may need inferred placeholders until the workflow
  template model grows first-class prompt/tool fields.

## 2026-06-16 - TDD Round 1: Graph Projection

- RED:
  - Added `__tests__/projectWorkflowGraphView.test.ts`.
  - Confirmed failure: missing `../lib/project-workflows/projectWorkflowGraphView`.
- GREEN:
  - Added `lib/project-workflows/projectWorkflowGraphView.ts`.
  - Exported graph view helpers from `lib/project-workflows/index.ts`.
  - Implemented Project Workflow run projection into:
    - graph run summary;
    - nodes;
    - dependency edges;
    - metrics;
    - selected node inspector;
    - prompt/tool/memory/handoff/evidence/scorecard/approval gate labels;
    - review-first safety notice.
- Refactor/decision:
  - Kept prompt/tool/memory as inferred view-model labels because F52 templates do
    not yet have first-class prompt/tool/memory fields.
  - This keeps F53 shippable without a schema change while leaving a clear future
    extension point.

## Verification - TDD Round 1

- PASS: `npm run test -- __tests__/projectWorkflowGraphView.test.ts`
  - 4 tests.

## 2026-06-16 - TDD Round 2: Workflow Runs Graph UI

- RED:
  - Added integration coverage in `__tests__/ai-assistants.console.test.tsx`
    requiring `initialProjectWorkflowRuns` and graph UI copy.
  - Confirmed failure: the existing sheet rendered only the legacy workflow table
    and did not contain `Workflow Graph`.
- GREEN:
  - Added Project Workflow run support to `AIAssistantsConsoleClient`.
  - `WorkflowRunsSheet` now loads Project Workflow sidecars from
    `.project-manager/project-workflow-runs` and uses legacy AgentWorkflow runs as
    fallback.
  - Added graph canvas + run browser + node inspector UI.
  - Added review-first safety copy; rendering/selecting nodes does not execute
    agents or tools.
- Boundary RED/GREEN:
  - Added empty-state test requiring Project Workflow-specific guidance.
  - Implemented "No Project Workflow runs found yet" state with `/workflow
    <featureId>` guidance.

## Verification - TDD Round 2

- PASS: `npm run test -- __tests__/ai-assistants.console.test.tsx -t "Project Workflow runs as a graph"`
- PASS: `npm run test -- __tests__/ai-assistants.console.test.tsx -t "Project Workflow empty state"`
- PASS: `npm run test -- __tests__/ai-assistants.console.test.tsx`
  - 9 tests.
- PASS: `npm run test -- __tests__/projectWorkflowGraphView.test.ts __tests__/projectWorkflowEngine.test.ts`
  - 2 files / 19 tests.
- PASS: `npm run typecheck`

## Current Open Risks

- The graph layout is fixed-grid in this first slice; drag/drop, zoom, minimap,
  and swimlane grouping remain out of scope.
- Prompt/tool/memory fields are currently inferred in the view model, not stored
  as first-class template fields.

## Browser Smoke - Workflow Runs Route

- PASS: Chrome/Playwright smoke opened
  `http://localhost:43187/ai_assistants/workflow-runs`.
- PASS: Browser console/page error count was 0.
- PASS: Empty Project Workflow state rendered because the currently selected app
  project has no persisted Project Workflow run sidecars yet.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.

## 2026-06-16 - Bugfix: Workflow Run Save Root Resolution

- Symptom:
  - PM clicked `Save workflow run` in AI Assistants > Workflow Runs and saw
    `Unable to save workflow run.`
  - The empty-state path showed `/Users/Project-Manager/.project-manager/project-workflow-runs`
    instead of the real repo root.
- Root cause:
  - The Workflow Runs save button trusted the raw `projectRoot` prop.
  - `MainClient` passed the selected project root into AI Assistants, so the
    route could receive either a stale persisted sample root (`/Users/Project-Manager`)
    or the first bundled sample project root.
  - Browser dev write-file protection correctly rejected `/Users/Project-Manager`
    because it is outside `process.cwd()`.
- Test gap acknowledged:
  - Previous TDD covered a mocked save path and browser smoke only checked that
    the button rendered with console error count 0.
  - It did not perform a real click-to-file save against the dev route.
- RED:
  - Added `__tests__/ai-assistants.console.test.tsx` coverage proving a stale
    `/Users/Project-Manager` root must resolve through `getProjectManagerRoot()`
    before saving.
  - Added `__tests__/MainClient.lazy-routes.test.tsx` coverage proving AI
    Assistants receives the detected Project Manager repo root rather than the
    default bundled sample root.
- GREEN:
  - `AIAssistantsConsoleClient` now rewrites persisted sample Project Manager
    roots to the detected repo root before loading, displaying, or saving
    Project Workflow run sidecars.
  - `MainClient` now passes `projectManagerRoot` into AI Assistants, matching
    Keys and AI SDKs root handling.
- Manual E2E smoke:
  - Reloaded `http://localhost:43187/ai_assistants/workflow-runs`.
  - Confirmed the path displayed as
    `/Users/jasonmacbbookpro/Project/Project-Manager/.project-manager/project-workflow-runs`.
  - Entered `F53`, clicked `Save workflow run`, and confirmed success message:
    `/Users/jasonmacbbookpro/Project/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F53-software-engineering-loop-20260615195241.json`.
  - Confirmed the sidecar JSON exists on disk and browser console error count is 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 174 files / 1185 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.

## Verification - UI Save Action Baseline

- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 174 files / 1181 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.
- Final dashboard update:
  - F53 status: `done`
  - F53 progress: `100`

## 2026-06-16 - Runtime Listener Cleanup Fix

- Symptom:
  - PM reported the Next.js lower-left Issues badge on
    `/ai_assistants/workflow-runs` showed:
    `Runtime TypeError: undefined is not an object (evaluating 'listeners[eventId].handlerId')`.
- Root cause:
  - Tauri event `unlisten` functions are async. `safeUnlisten` only caught
    synchronous throws, so async double-unregister rejections could still surface
    as a runtime overlay.
  - Several React effects still used direct `unlisten?.()` or did not clean up
    listener promises that resolved after unmount/HMR cleanup.
- Fix:
  - Expanded `UnlistenFn` to allow `Promise<void>`.
  - Updated `safeUnlisten` to catch both synchronous throws and async rejection.
  - Updated MainClient, dispatch modals, font zoom shortcuts, GitHub issues,
    plugin status, MCP logs, and Telegram listener cleanup paths to use
    `safeUnlisten` and cancelled guards where needed.
- Regression coverage:
  - Added MainClient Tauri listener cleanup race coverage for a listener promise
    resolving after unmount.
  - Added async `safeUnlisten` bridge coverage.

## Verification - Runtime Listener Cleanup Fix

- PASS: `npm run test -- __tests__/MainClient.sync.test.tsx -t "safe-unlistens listeners"`
- PASS: `npm run typecheck`
- PASS: `npm run test -- __tests__/bridgeEventListeners.test.ts __tests__/MainClient.sync.test.tsx __tests__/useFontZoomShortcuts.test.tsx __tests__/ai-assistants.console.test.tsx`
  - 4 files / 31 tests.
- PASS: Browser reload smoke on
  `http://localhost:43187/ai_assistants/workflow-runs`.
  - `Save workflow run` still rendered.
  - `Runtime TypeError` not visible.
  - `listeners[eventId].handlerId` not visible.
  - Browser console error count: 0.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.

## Verification - Baseline

- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 174 files / 1178 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.

## Remaining Product Follow-Up

- To dogfood the full graph route with real data, the app needs a UI action that
  persists a `/workflow <featureId>` decision package into
  `.project-manager/project-workflow-runs`.
- Drag/drop graph editing, zoom/minimap, and swimlane grouping remain future
  slices.

## 2026-06-16 - Persistence Slice Kickoff

- Continued F53 after the graph console MVP.
- New goal: allow `/workflow <featureId>` packages to be saved into real Project
  Workflow run sidecars so the Workflow Runs tab can load graph data from disk.
- Safety decision:
  - normal `/workflow <featureId>` remains review-only and does not write files;
  - persistence requires an explicit caller flag;
  - saving a run still does not execute actors, tools, PRs, pushes, or deploys.

## 2026-06-16 - TDD Round 3: Chat Workflow Persistence

- RED:
  - Added `__tests__/chat.agent.test.ts` coverage requiring `/workflow F14` to
    persist a Project Workflow run sidecar only when `persistWorkflowRun: true`.
  - Confirmed failure: `saveProjectWorkflowRun` was not called.
- GREEN:
  - Added `persistWorkflowRun?: boolean` to `SendChatMessageRequest`.
  - Refactored `/workflow` package generation so the command can reuse the same
    decision package and run object for review-only and explicit persistence.
  - Added an async local-command branch that saves the run sidecar through
    `saveProjectWorkflowRun(projectRoot, run)` only when the explicit flag is set.
  - Added `/workflow-save <featureId>` as the user-facing explicit persistence
    command.
  - Updated `/help` to advertise `/workflow-save`.
  - The default `/workflow <featureId>` command remains review-only and does not
    write files.

## Verification - TDD Round 3

- PASS: `npm run test -- __tests__/chat.agent.test.ts -t "persists /workflow"`
- PASS: `npm run test -- __tests__/chat.agent.test.ts -t "workflow-save"`
- PASS: `npm run test -- __tests__/chat.agent.test.ts`
  - 24 tests.
- PASS: `npm run typecheck`
- PASS: `npm run test -- __tests__/chat.agent.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/projectWorkflowEngine.test.ts __tests__/ai-assistants.console.test.tsx`
  - 4 files / 52 tests.

## 2026-06-16 - Persistence Import Fix

- Baseline initially failed in `__tests__/chat.systemPrompt.test.ts` because
  `chatAgent.ts` imported `projectWorkflowRunStore` at module load time.
- Root cause: the run store imports bridge file helpers, while several chat tests
  intentionally mock only the bridge pieces needed for persona/system-prompt
  behavior. Persistence is optional and should not force all chat tests to mock
  filesystem bridge wrappers.
- Fix: moved `saveProjectWorkflowRun` to a dynamic import inside the explicit
  persistence branch. Review-only chat paths no longer load the run store.
- Verification:
  - PASS: `npm run test -- __tests__/chat.systemPrompt.test.ts`
  - PASS: `npm run test -- __tests__/chat.agent.test.ts -t "workflow-save|persists /workflow"`

## Verification - Persistence Slice Baseline

- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 174 files / 1180 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.

## 2026-06-16 - UI Save Action Slice Kickoff

- Committed and pushed completed F53 graph console:
  - `dbd19ad0 feat(pm): add workflow graph execution console`
  - `git push origin main`
  - pre-push `npm run verify:quick` PASS.
- Reopened F53 for a narrow usability slice requested by PM:
  - add a visible `Save workflow run` button in AI Assistants > Workflow Runs;
  - allow a PM to type a feature/work item id and create a review-first Software
    Engineering Loop sidecar without remembering `/workflow-save <featureId>`;
  - reload graph sidecars after save;
  - keep the same safety policy: saving does not execute agents, tools, PRs,
    pushes, deploys, or external commands.
- Planned tests:
  - RED integration test for save button calling `saveProjectWorkflowRun`;
  - focused Workflow Runs rendering tests;
  - route browser smoke and dev issues check;
  - final `npm run verify:baseline`.

## 2026-06-16 - TDD Round 4: Workflow Runs UI Save Button

- RED:
  - Added `__tests__/ai-assistants.console.test.tsx` coverage for saving a
    Project Workflow run sidecar from the Workflow Runs tab.
  - Confirmed failure: test could not find the `Feature or work item id` field,
    because the UI save control did not exist.
- GREEN:
  - Added `SaveWorkflowRunControl` to `AIAssistantsConsoleClient`.
  - Empty Workflow Runs state now lets a PM enter a feature/work item id and
    click `Save workflow run`.
  - Graph header also exposes the same compact save control.
  - Save flow creates a `software-engineering-loop` Project Workflow run,
    persists it through `saveProjectWorkflowRun(projectRoot, run)`, reloads
    `listProjectWorkflowRuns(projectRoot)`, selects the matching run, and shows
    the saved path.
  - Safety remains unchanged: this creates a sidecar only and does not execute
    agents, tools, PRs, pushes, deploys, or external commands.

## Verification - TDD Round 4

- PASS: `npm run test -- __tests__/ai-assistants.console.test.tsx -t "saves a Project Workflow run sidecar"`
  - 1 focused test.
- PASS: `npm run test -- __tests__/ai-assistants.console.test.tsx`
  - 10 tests.
- PASS: `npm run typecheck`
- PASS: `npm run test -- __tests__/chat.agent.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/projectWorkflowEngine.test.ts __tests__/ai-assistants.console.test.tsx`
  - 4 files / 53 tests.
- PASS: Browser smoke opened
  `http://localhost:43187/ai_assistants/workflow-runs`.
  - Empty Project Workflow state rendered.
  - `Save workflow run` control rendered.
  - Browser console error count: 0.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.
