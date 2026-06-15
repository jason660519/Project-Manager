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
