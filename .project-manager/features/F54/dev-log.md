# F54 Dev Log

## 2026-06-16 - TDD Round 18: Live Spawn Event Channel Evidence

- Decision:
  - Treat the `spawnToken` record as the correlation handle for Tauri live
    process streams, and make the expected event channels visible in the
    Execution Record detail inspector.
  - This remains read-only audit evidence. Execution record details still do
    not expose any run/terminal control.
- RED:
  - Extended the live spawn evidence detail test to require
    `agent-stdout, agent-stderr, agent-exit` in a `live_spawned` record.
  - Confirmed expected failure: the detail inspector showed pid and
    `spawnToken`, but not the stream channel names.
- GREEN:
  - Added an `event channels` metadata row for live records with a
    `runnerSpawnToken`.
- Verification:
  - PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx -t "shows live executor spawn evidence"`
  - PASS: `npm run typecheck`
  - PASS: `npm run verify:dev-issues -- --routes /integrations-hub/workflow-execution-records,/integrations-hub/workflow-execution-requests`
    - `/integrations-hub/workflow-execution-records`: Next dev Issues 0.
    - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
  - PASS: Chrome smoke against
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-records?recordId=f54-smoke-live-event-record`
    with a temporary live record sidecar:
    - record `F54 · Verification` rendered;
    - `spawnToken` `5678` rendered;
    - event channels `agent-stdout, agent-stderr, agent-exit` rendered;
    - no runtime overlay text was present.
  - Note: the temporary smoke sidecar was removed after verification.
- Remaining risk:
  - Full Tauri desktop click-through for `Run live executor` spawning an actual
    process remains a manual shell-runtime gate before marking F54 100%.

## 2026-06-16 - TDD Round 17: Live Spawn Working Directory Evidence

- Decision:
  - Treat live executor working directory as first-class audit evidence.
  - The live runner adapter already receives the working directory; the run
    record must persist it so a PM can later reconstruct where the command was
    spawned without relying on chat or UI state.
  - The Integration Hub live handler now passes the semantically clear `pmRoot`
    as the spawn working directory while still saving records under the
    execution records sidecar root.
- RED:
  - Extended the live package store test to require `workingDir:
    /repo/Project-Manager` in a `live_spawned` record.
  - Extended the execution record detail test to require the live spawn working
    directory to be visible in the inspector.
- GREEN:
  - Added optional `workingDir` to `ProjectWorkflowExecutorRunRecord`.
  - `runProjectWorkflowExecutorLive()` now persists the working directory in
    live spawn records.
  - Execution record details now normalize and render `working dir`.
  - Integration Hub live runner uses `pmRoot` as the working directory argument
    instead of the less precise execution-records-root variable.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.commandMappingExecutorRegistry.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.pluginsHubDeepLink.test.tsx`
  - 5 files / 42 tests.
- PASS: `npm run typecheck`
- PASS: `npm run docs:check`
- PASS: `npm run verify:dev-issues -- --routes /integrations-hub/workflow-execution-records,/integrations-hub/workflow-execution-requests`
  - `/integrations-hub/workflow-execution-records`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 183 files / 1258 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain limited to the pre-existing
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    trace and `next.config.mjs` NFT trace.

## 2026-06-16 - TDD Round 16: Approval-Gated Live Executor First Slice

- Decision:
  - Opened the executor path one guarded step beyond dry-run: live command
    spawn is allowed only when the request is already
    `approved_for_executor`, the executor command is resolved, and the
    Integration Hub command mapping explicitly opts into
    `live_command_allowed`.
  - `dry_run_only` remains the default and is blocked by policy before the live
    runner adapter can be called.
  - Browser/Next dev mode must not fake a live spawn; it shows a controlled
    Tauri-runtime-required error. Real spawn remains Tauri-only through the
    typed `spawnAgent()` bridge wrapper.
  - Live spawn records preserve `pid` and `spawnToken` as audit evidence so the
    execution trail remains outside chat history.
- RED:
  - Added package store tests requiring approved dry-run-only requests to be
    blocked by live policy.
  - Added package store tests requiring approved `live_command_allowed`
    requests to call an injected live runner adapter and persist
    `live_spawned` with `pid` and `spawnToken`.
  - Added command mapping registry coverage requiring explicit
    `live_command_allowed` metadata to survive mapper conversion.
  - Added detail sheet coverage requiring approved live requests to expose
    `Run live executor`.
  - Added command mapping detail coverage requiring the editor to save
    `executor.executionState: live_command_allowed`.
  - Added execution record detail coverage requiring live spawn records to show
    `pid` and `spawnToken`.
- GREEN:
  - Extended `ProjectWorkflowExecutorExecutionState` to
    `dry_run_only | live_command_allowed`.
  - Added `runProjectWorkflowExecutorLive()` and the live runner adapter
    contract in `projectWorkflowExecutionPackageStore`.
  - Exported the live runner through the project-workflows barrel.
  - Added optional `executor.executionState` to command mapping metadata and
    preserved it when building the Project Workflow executor registry.
  - Added `Executor execution mode` to command mapping details, defaulting to
    dry-run-only and only persisting live mode when selected.
  - Added `Run live executor` to approved live request details and wired it in
    Integrations Hub to save live run records.
  - Added `pid` and `spawn token` rows to execution record details.
- Manual E2E smoke:
  - Created a temporary approved F54 live execution request sidecar with
    `live_command_allowed`.
  - Opened
    `http://localhost:43187/integrations-hub/workflow-execution-requests?requestId=f54-smoke-live-request`
    in the in-app browser.
  - Clicked `Rescan` and confirmed the exact request detail opened with
    `Run live executor`.
  - Clicked `Run live executor` in browser/Next dev mode.
  - Confirmed the UI showed:
    `Live executor requires the Tauri desktop runtime. Browser mode remains
    dry-run only.`
  - Confirmed no runtime overlay text appeared and browser console error count
    was 0.
  - Removed the temporary smoke request after verification.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.commandMappingExecutorRegistry.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.pluginsHubDeepLink.test.tsx`
  - 5 files / 42 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records`
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-records`: Next dev Issues 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 183 files / 1258 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain limited to the pre-existing
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    trace and `next.config.mjs` NFT trace.
- Remaining risk:
  - Tauri desktop smoke for actual `spawnAgent()` event tracking remains the
    next slice after this browser-safe live executor gate.

## 2026-06-16 - TDD Round 8: Execution Request Detail Inspector

- Decision:
  - Keep Integrations Hub execution request rows read-only, but make their
    package payload inspectable. PMs need to see what a future executor would
    receive: command preview, prompt labels, memory, tools, handoff, evidence,
    requester, and safety notice.
  - Do not add `Run`, terminal, agent spawn, or command execution controls in
    this slice.
- RED:
  - Added `integrations.executionRequestDetailSheet` component test requiring a
    selected workflow execution request row to show `Execution Request Package`,
    `npm run verify:baseline`, system/task prompt labels, memory files, allowed
    tools, expected handoff/evidence, and the dry-run safety notice.
  - Confirmed expected failure: the existing detail sheet only rendered generic
    metadata and manual notes for the row.
- GREEN:
  - Added a typed read-only workflow execution request payload inspector to
    `IntegrationsDetailSheet`.
  - Added compact token lists for memory files, allowed tools, and expected
    evidence.
  - Kept runtime execution controls absent for `workflow-execution-request`
    rows.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx`
  - 1 file / 1 test.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 26 tests.
- PASS: `npm run typecheck`
- Manual E2E smoke:
  - Wrote a temporary `F54-smoke-detail` execution request package under
    `.project-manager/project-workflow-execution-requests/`.
  - Opened `/integrations-hub/workflow-execution-requests` in the in-app
    browser, selected the temporary row, and confirmed the detail inspector
    showed `Execution Request Package`, `npm run verify:baseline`, prompt
    labels, memory file, allowed tool, and safety notice.
  - Confirmed no runtime/terminal execution controls were visible in the detail
    inspector.
  - Removed the temporary smoke package.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - Result: `Next dev Issues: 0` for both routes on a fresh Chromium check.
- Remaining risk:
  - Detail inspection is now visible, but real executor consumption still needs
    a separate policy-gated runner and fresh TDD/E2E coverage.

## 2026-06-16 - TDD Round 7: Integrations Hub Execution Requests Sheet

- Decision:
  - Surface Project Workflow execution request packages in Integrations Hub as a
    read-only dry-run queue. This makes Integration Hub part of the handoff
    loop without enabling real executor side effects yet.
  - The sheet reads the PM repo root (`pmRepoRoot`) rather than the selected
    managed project root because the queue is owned by Project Manager's own
    `.project-manager/project-workflow-execution-requests/` sidecars.
- RED:
  - Updated `integrations.sheetActions` expectations so
    `workflow-execution-requests` must be a first-class inventory sheet.
  - Added `integrations.workflowExecutionRequests` tests requiring a request
    JSON package to load as an Integration Hub row with dry-run badges,
    `pending_external_executor` status, command preview in payload, and no
    enabled execution toggle.
  - Confirmed expected failures: the sheet id was absent and
    `loadWorkflowExecutionRequestRows` did not exist.
- GREEN:
  - Added `workflow-execution-requests` to Integration Hub sheet types, route
    params, inventory action registry, bottom tabs, active rows, loading/error
    state, and scan/test actions.
  - Added `loadWorkflowExecutionRequestRows()` to
    `lib/integrations/load-project-inventory.ts`.
  - Added an `Execution Requests` sheet banner that clearly states rows are
    dry-run handoff packages and the sheet does not run commands or agents.
  - Scoped Memory, Commands, and Execution Requests sidecar scans to their
    active sheets so inactive probes do not generate browser dev console
    403/404 noise.
  - Reused PM repo root hydration for the Execution Requests sheet so stale
    `/Users/Project-Manager` sample roots do not hit the dev file API.
- Manual E2E smoke:
  - Wrote a temporary execution request package under
    `.project-manager/project-workflow-execution-requests/`.
  - Opened `http://localhost:43187/integrations-hub/workflow-execution-requests`
    in the in-app browser.
  - Confirmed the route loaded after reload, the `Execution Requests` sheet and
    dry-run banner were visible, and the temporary
    `F54-smoke-hub · Verification` row appeared.
  - Browser console error count on fresh dev-issues route check: 0.
  - Removed the temporary smoke package.
- PASS: `npm test -- --run __tests__/integrations.sheetActions.test.ts __tests__/integrations.workflowExecutionRequests.test.ts`
  - 2 files / 4 tests.
- PASS: `npm test -- --run __tests__/integrations.sheetActions.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 5 files / 25 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - Result: `Next dev Issues: 0` for both routes.
- Remaining risk:
  - The sheet is intentionally read-only. Real executor consumption still needs
    policy review, approval gates, and a separately tested runner.

## 2026-06-16 - TDD Round 6: Dry-Run Execution Request Package Queue

- Decision:
  - Keep Integration Hub execution dry-run only, but make the handoff durable.
    A `run_requested` draft now writes an execution request package that a
    future Integration Hub executor can consume without depending on chat
    history or transient React state.
  - Packages live under
    `.project-manager/project-workflow-execution-requests/` and include a
    frozen snapshot of executor resolution, prompts, memory files, allowed
    tools, expected handoff, expected evidence, requester, request time, and
    safety notice.
- RED:
  - Added `projectWorkflowExecutionPackageStore` tests requiring resolved
    `software:verification:tool` drafts to produce a dry-run command package
    with `npm run verify:baseline`.
  - Added coverage for unresolved auto-requested agent drafts so the system
    records an auditable package without guessing a command.
  - Added AI Assistants component assertions requiring both manual `Run draft`
    and auto-safe `Start node` to call execution request package persistence.
  - Confirmed expected failures: the package store import did not exist and UI
    never called `saveProjectWorkflowExecutionRequests`.
- GREEN:
  - Added `lib/project-workflows/projectWorkflowExecutionPackageStore.ts`.
  - Exported package builder/store APIs through `lib/project-workflows/index.ts`.
  - Workflow Runs now persists execution request packages after workflow run
    updates, so manual and auto-safe request paths share one sidecar queue.
  - Package builder enriches feature memory references with README, feature
    spec, TDD spec, test scenarios, and dev log paths while preserving draft
    memory/tool context.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/ai-assistants.console.test.tsx`
  - 2 files / 19 tests.
- PASS: `npm test -- --run __tests__/editor.list-files-route.test.ts __tests__/projectWorkflowRunStore.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/projectWorkflowEngine.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx`
  - 7 files / 52 tests.
- PASS: `npm run typecheck`
- Manual E2E smoke:
  - Opened `http://localhost:43187/ai_assistants/workflow-runs` in the in-app
    browser.
  - Created a temporary `F54-smoke-package` workflow run through the UI `Save
    workflow run` button.
  - Switched the run to `Auto-run safe nodes`, clicked `Start node`, then
    clicked `Run draft`.
  - Confirmed `run_requested`, `pending_external_executor`, and dry-run
    executor text were visible.
  - Confirmed browser console error count: 0.
  - Confirmed a dry-run package was written under
    `.project-manager/project-workflow-execution-requests/` with
    `schemaVersion: 1`, `executionState: dry_run_only`, requester, prompts,
    memory files, allowed tools, handoff, and evidence fields.
  - Removed the temporary smoke run and execution request sidecars.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.

## 2026-06-16 - TDD Round 7: Execution Request Deep Link From Workflow Runs

- RED:
  - Extended the Workflow Runs execution evidence component test so clicking
    `Review execution request` must navigate to
    `/integrations-hub/workflow-execution-requests?requestId=request-1` when
    the inspector has linked Integration Hub request evidence.
  - Confirmed the test failed because the existing button only opened
    `/integrations-hub/workflow-execution-requests`.
- GREEN:
  - Updated the Workflow Runs review callback to accept an optional request id.
  - Preserved the existing queue-only navigation when no linked request row has
    loaded yet.
  - Passed `executionRequestRow.sourceId` from the inspector button so
    Integration Hub row deep-link selection can open the exact request detail.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx -t "opens the Integration Hub execution request queue from a requested draft|shows execution request review state and dry-run record evidence"`
  - 1 file / 2 targeted tests.
- PASS: `npm test -- --run __tests__/integrations.rowDeepLink.test.ts __tests__/ai-assistants.console.test.tsx __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 5 files / 54 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records`
  - Result: all 3 routes report `Next dev Issues: 0`.
- Browser smoke:
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-requests?requestId=request-1`.
  - Confirmed the Integration Hub dry-run queue route rendered without a
    runtime TypeError.
  - Browser console fresh error count: 0.
  - Local smoke project did not have a `request-1` sidecar, so the detail-row
    auto-selection path remains covered by component/unit tests.
- PASS: `npm run verify:baseline`
  - vitest PASS: 182 files / 1249 tests
  - typecheck PASS
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain for broad `/Applications` tracing in the
    dev-only scan-applications route and NFT tracing through `next.config.mjs`;
    baseline completed with `== verify:baseline: PASS ==`.
- Risk / next:
  - This is still read-only navigation. Real executor consumption remains
    dry-run-only and gated by Integration Hub approval policy.

## 2026-06-16 - TDD Round 8: Execution Record To Source Request Navigation

- RED:
  - Added an Integration Hub detail-sheet component test proving an execution
    record with `requestId` should expose `Open execution request`.
  - Confirmed the test failed because execution record detail only supported
    navigation back to Workflow Runs.
- GREEN:
  - Added an optional `onOpenWorkflowExecutionRequest` detail-sheet callback.
  - Rendered a read-only `Open execution request` action for execution records
    that include `requestId`.
  - Wired `PluginsHubView` to route that action to
    `/integrations-hub/workflow-execution-requests?requestId=<request-id>`.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx -t "source execution request"`
  - 1 file / 1 targeted test.
- PASS: `npm test -- --run __tests__/integrations.rowDeepLink.test.ts __tests__/ai-assistants.console.test.tsx __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 5 files / 55 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /integrations-hub/workflow-execution-records,/integrations-hub/workflow-execution-requests`
  - Result: both routes report `Next dev Issues: 0`.
- Browser smoke:
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-records?recordId=record-1`.
  - Confirmed the Integration Hub records sheet rendered without runtime
    TypeError.
  - Browser console fresh error count: 0.
- PASS: `npm run verify:baseline`
  - vitest PASS: 182 files / 1250 tests
  - typecheck PASS
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain for broad `/Applications` tracing in the
    dev-only scan-applications route and NFT tracing through `next.config.mjs`;
    baseline completed with `== verify:baseline: PASS ==`.
- Risk / next:
  - This closes one navigation gap inside Integration Hub, but the actual
    executor remains dry-run-only. A future slice should add a stronger
    end-to-end browser fixture with a temporary request/record sidecar pair so
    row auto-selection is visually smoke-tested, not only component-tested.

## 2026-06-16 - TDD Round 9: Client-Side Deep-Link Refresh And Browser Fixture Smoke

- RED:
  - Added `__tests__/integrations.pluginsHubDeepLink.test.tsx` for
    `PluginsHubView` with real loader flow through mocked `listProjectFiles` /
    `readFile`.
  - First test verifies direct
    `/integrations-hub/workflow-execution-requests?requestId=request-1`
    opens the request detail after async sidecar rows load.
  - Added regression test for the user path:
    record detail with `recordId` -> client-side navigation to request sheet
    with `requestId`.
  - Confirmed failure: the request row loaded, but the detail did not open
    because `rowDeepLink` was memoized with `[]` and kept the stale first query.
- GREEN:
  - Updated `PluginsHubView` to recompute row deep-link state from
    `window.location.search` when the route sheet/search changes.
  - Kept the selection effect read-only; it still only opens matching row
    details and does not approve, run, spawn, record, or mutate sidecars.
- Browser smoke:
  - Created temporary request/record sidecars:
    `f54-smoke-request-deeplink` and `f54-smoke-record-deeplink`.
  - Opened direct request deep link and confirmed the request row/detail loads
    after the filesystem scan settles.
  - Opened record deep link, clicked `Open execution request`, and confirmed the
    app navigated to
    `/integrations-hub/workflow-execution-requests?requestId=f54-smoke-request-deeplink`.
  - Confirmed request detail displayed `Execution Request Package`,
    `f54-smoke-run-deeplink`, and the smoke policy reason.
  - Browser console fresh error count: 0.
  - Removed the temporary sidecars after verification.
- PASS: `npm test -- --run __tests__/integrations.pluginsHubDeepLink.test.tsx -t "updates deep-link selection"`
  - 1 file / 1 targeted test.
- PASS: `npm test -- --run __tests__/integrations.pluginsHubDeepLink.test.tsx __tests__/integrations.rowDeepLink.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 57 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /integrations-hub/workflow-execution-records,/integrations-hub/workflow-execution-requests`
  - Result: both routes report `Next dev Issues: 0`.
- PASS: `npm run verify:baseline`
  - vitest PASS: 183 files / 1252 tests
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain for broad `/Applications` tracing in the
    dev-only scan-applications route and NFT tracing through `next.config.mjs`;
    baseline completed with `== verify:baseline: PASS ==`.
- Risk / next:
  - This fixes stale query selection for mounted Integration Hub sessions.
  - Real executor execution remains intentionally out of scope for this dry-run
    slice; future work should keep using the same approval gate before any
    non-dry-run runner is introduced.

## 2026-06-16 - TDD Round 23: Workflow Runs Execution Evidence Feedback

- Goal:
  - Make the Workflow Runs visual companion reflect Integration Hub execution
    evidence after a request is approved or a dry-run record is written.
  - Keep approvals, handoff recording, and dry-run execution owned by
    Integration Hub; Workflow Runs only displays read-only feedback.
- RED:
  - Added a component test that loads an F54 auto-safe run with a requested
    `Analysis` draft.
  - Mocked Integration Hub execution request rows with
    `approved_for_executor`.
  - Mocked Integration Hub execution record rows with `dry_run_completed` and
    runner result `completed · exit 0`.
  - Confirmed the expected failure: the Workflow Runs inspector did not show
    `Execution Evidence`.
- GREEN:
  - Loaded workflow execution request and record rows alongside Project
    Workflow run sidecars.
  - Passed those rows into the Workflow Runs graph sheet.
  - Matched request/record evidence by workflow run id plus draft id or node id.
  - Added an `Execution Evidence` inspector block that shows request review
    state, policy state when distinct, command preview, record status, and
    runner result summary.
  - Deduplicated identical review/policy states so the inspector does not repeat
    `approved_for_executor`.
- Decisions:
  - Evidence display is read-only and does not call approval, handoff, dry-run,
    shell, terminal, or agent execution APIs.
  - Missing or incomplete sidecars fall back to existing row status/category
    fields, keeping legacy rows safe to inspect.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx`
  - 1 file / 21 tests.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/bridgeEventListeners.test.ts`
  - 5 files / 57 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records`
  - Workflow Runs: Next dev Issues 0.
  - Execution Requests: Next dev Issues 0.
  - Execution Records: Next dev Issues 0.
- Manual browser smoke:
  - Opened `http://127.0.0.1:43187/ai_assistants/workflow-runs`.
  - Confirmed the page renders Project Workflow sidecars, Workflow Graph, F54
    nodes, and execution mode controls.
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-requests`.
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-records`.
  - Browser console error count: 0 on all three changed routes.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 181 files / 1244 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    tracing and `next.config.mjs` NFT trace; baseline still completed with
    `== verify:baseline: PASS ==`.

## 2026-06-16 - TDD Round 24: Integration Hub Back-Navigation To Workflow Runs

- Goal:
  - Close the Integration Hub -> Workflow Runs inspection loop for execution
    request and execution record sidecars.
  - Keep the action read-only: navigation only, no approval, no handoff record,
    no dry-run, no shell/agent/tool execution.
- RED:
  - Added component tests for `Open workflow run` on execution request details
    and execution record details.
  - Confirmed expected failures: the button did not exist.
  - The request test also exposed a robustness issue: a partially shaped
    request payload without `policyGate` could crash the detail sheet while
    evaluating the future executor gate.
- GREEN:
  - Added a typed workflow navigation callback to `IntegrationsDetailSheet`.
  - Added `Open workflow run` buttons to execution request and execution record
    detail sections when workflow/work item/node context exists.
  - Wired `PluginsHubView` to navigate back to `/ai_assistants/workflow-runs`.
  - Wrapped execution gate evaluation so incomplete sidecars omit the gate
    block instead of crashing the inspector.
- Decisions:
  - The callback carries work item id, workflow run id, and node id for future
    deep-linking, but the current UI routes to Workflow Runs because the graph
    route does not yet parse selection query params.
  - The button is intentionally not shown for rows without workflow context.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx`
  - 1 file / 10 tests.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/ai-assistants.console.test.tsx __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 4 files / 51 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records,/ai_assistants/workflow-runs`
  - Execution Requests: Next dev Issues 0.
  - Execution Records: Next dev Issues 0.
  - Workflow Runs: Next dev Issues 0.
- Manual browser smoke:
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-requests`.
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-records`.
  - Opened `http://127.0.0.1:43187/ai_assistants/workflow-runs`.
  - Confirmed all three routes render without `Runtime TypeError`.
  - Browser console error count: 0 on all three changed routes.
  - Current local request/record sheets had no rows matching filters, so button
    visibility for populated sidecars remains covered by component tests.

## 2026-06-16 - TDD Round 25: Workflow Runs Deep-Link Selection

- Goal:
  - Make Integration Hub `Open workflow run` navigation return the PM to the
    relevant Workflow Runs context instead of only opening the generic sheet.
- RED:
  - Added an AI Assistants component test that opens Workflow Runs with
    `workItemId=F54`, `workflowRunId=<target>`, and `nodeId=verification`.
  - Confirmed the expected failure: Workflow Runs still selected the first run
    and default node instead of the linked run/node.
- GREEN:
  - Added read-only deep-link parsing for `workItemId`, `featureId`,
    `workflowRunId`, `runId`, and `nodeId`.
  - Workflow Runs now selects the matching run by id first, then by work item,
    for both initial props and later sidecar loads.
  - Workflow Runs now selects the linked node inspector when the linked run is
    present.
  - Integration Hub `Open workflow run` now includes work item, run id, and node
    id query params when available.
- Decisions:
  - Selection is intentionally read-only: it does not start nodes, request
    drafts, approve packages, record handoffs, run dry-runs, or spawn commands.
  - If params do not match any run, Workflow Runs keeps the existing first-run
    fallback.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx -t "selects a Project Workflow run and node from workflow run deep-link params"`
  - 1 focused test.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 4 files / 52 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records`
  - Workflow Runs: Next dev Issues 0.
  - Execution Requests: Next dev Issues 0.
  - Execution Records: Next dev Issues 0.
- Manual browser smoke:
  - Opened
    `http://127.0.0.1:43187/ai_assistants/workflow-runs?workItemId=F54&nodeId=verification`.
  - Confirmed Workflow Graph, F54, and Verification context are visible.
  - Confirmed no `Runtime TypeError`.
  - Fresh navigation console error count: 0.

## 2026-06-16 - TDD Round 26: Workflow Runs To Execution Records Navigation

- Goal:
  - Let a PM move from Workflow Runs execution evidence to the Integration Hub
    execution record audit sheet when dry-run record evidence exists.
- RED:
  - Extended the Workflow Runs execution evidence component test to click
    `Open execution record`.
  - Confirmed the expected failure: the button was not present.
- GREEN:
  - Added a read-only `Open execution record` action to the execution evidence
    block when a linked execution record row is found.
  - Wired the action to `/integrations-hub/workflow-execution-records`.
- Decisions:
  - The action is intentionally sheet-level navigation for this slice; record
    row deep-linking can follow after the Integrations Hub table supports row
    selection params.
  - It does not call any approval, handoff recording, dry-run runner, shell, or
    agent execution path.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx -t "shows execution request review state and dry-run record evidence"`
  - 1 focused test.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 4 files / 52 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-records`
  - Workflow Runs: Next dev Issues 0.
  - Execution Records: Next dev Issues 0.
- Manual browser smoke:
  - Opened
    `http://127.0.0.1:43187/ai_assistants/workflow-runs?workItemId=F54&nodeId=analysis`.
  - Confirmed Workflow Graph, F54, and Analysis context are visible.
  - Confirmed `Runtime TypeError` is not visible.
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-records`.
  - Confirmed Execution Records route renders.
  - Fresh navigation console error count: 0 on both routes.
  - Current local sidecars do not include an Analysis execution record, so the
    `Open execution record` button is covered by component test data rather
    than live sidecar data in this smoke.

## 2026-06-16 - TDD Round 27: Row-Level Execution Record Deep Links

- Goal:
  - Make Workflow Runs -> Execution Records navigation carry enough context to
    select the linked audit row, not just open the sheet.
- RED:
  - Changed the Workflow Runs evidence test to expect
    `/integrations-hub/workflow-execution-records?recordId=record-1`.
  - Confirmed the expected failure: Workflow Runs only navigated to the sheet.
  - Added a pure Integration Hub row deep-link selector test for `recordId`,
    `sourceId`, and `rowKey`; confirmed the helper did not exist.
- GREEN:
  - `Open execution record` now includes `recordId=<sourceId>`.
  - Added Integration Hub row deep-link parsing for `recordId`, `requestId`,
    `sourceId`, and `rowKey`.
  - Added a selector that matches source id first, then row key.
  - Wired Integrations Hub to select a linked row after active rows load.
- Decisions:
  - Deep-link selection is read-only; it only opens the matching detail row.
  - No approval, handoff recording, dry-run runner, shell, or agent execution is
    triggered by URL params.
- PASS: `npm test -- --run __tests__/integrations.rowDeepLink.test.ts __tests__/ai-assistants.console.test.tsx -t "Integration Hub row deep-link selection|shows execution request review state and dry-run record evidence"`
  - 2 files / 3 targeted tests.
- PASS: `npm test -- --run __tests__/integrations.rowDeepLink.test.ts __tests__/ai-assistants.console.test.tsx __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 5 files / 54 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-records`
  - Workflow Runs: Next dev Issues 0.
  - Execution Records: Next dev Issues 0.
- Manual browser smoke:
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-records?recordId=record-1`.
  - Confirmed Execution Records route renders.
  - Confirmed no `Runtime TypeError`.
  - Fresh navigation console error count: 0.
  - Current local sidecars do not include `record-1`, so no detail row opened;
    matching-row behavior is covered by the selector/component tests.

## 2026-06-16 - TDD Round 20: Workflow Runs Visual Registry From Integration Hub

- RED:
  - Added graph projection coverage for an injected `software:analysis:agent`
    executor registry. The inspector still resolved the draft as `unresolved`
    because `buildProjectWorkflowGraphView` ignored supplied registries.
  - Added AI Assistants component coverage proving a command mapping executor
    candidate should appear in the Workflow Runs node inspector. The UI showed
    the inspector section but not the Integration Hub label/command preview.
- GREEN:
  - Extended `BuildProjectWorkflowGraphViewOptions` with `executorRegistry` and
    passed it through to `resolveProjectWorkflowDraftExecutor`.
  - Built a Workflow Runs visual registry in AI Assistants by combining the
    built-in dry-run executor registry with Integration Hub command mapping
    metadata. Command mappings can extend/override by capability without
    deleting unrelated built-in candidates.
  - Reused the same combined registry for request package persistence when
    Integration Hub mappings exist, while preserving the old two-argument save
    path when no command mapping executor metadata is configured.
- Decision:
  - Integration Hub is an extension/override layer, not a replacement for
    built-in guarded candidates. This keeps the default software verification
    dry-run candidate visible even after a PM adds a custom analysis executor.
- PASS: `npm test -- --run __tests__/projectWorkflowGraphView.test.ts`
  - 1 file / 7 tests.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx`
  - 1 file / 18 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.commandMappingExecutorRegistry.test.ts`
  - 4 files / 44 tests.
- PASS: `npm run typecheck`

## 2026-06-16 - TDD Round 21: Workflow Runs To Execution Request Queue

- RED:
  - Added AI Assistants component coverage for the PM path from a
    `run_requested` execution draft to the Integration Hub execution request
    queue.
  - Confirmed the test failed because the Workflow Runs inspector did not
    expose a `Review execution request` action.
- GREEN:
  - Added a `Review execution request` button inside the Execution Draft
    inspector only when the draft status is `run_requested`.
  - The action navigates to `/integrations-hub/workflow-execution-requests`.
  - The action does not approve, run, spawn, mutate request packages, or call
    any external executor.
- Decision:
  - Workflow Runs should remain the visual orchestration companion. Human
    approval and dry-run executor actions continue to live in Integration Hub
    where the request package and policy gate are visible.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx`
  - 1 file / 19 tests.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx __tests__/projectWorkflowGraphView.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx`
  - 4 files / 50 tests.
- PASS: `npm run typecheck`
- Baseline blocker fixed:
  - Symptom: full `npm run verify:baseline` reached `npm test` with all tests
    passing, but Vitest failed on unhandled Tauri event listener rejections from
    `MainClient.sync.test.tsx`.
  - Root cause: the bridge event listener wrapper treated incomplete
    `window.__TAURI_INTERNALS__` objects as usable Tauri event runtimes, then
    `@tauri-apps/api/event.listen` attempted to read missing
    `transformCallback`.
  - Fix: `lib/bridge/index.ts` now requires a real
    `__TAURI_INTERNALS__.transformCallback` function before registering Tauri
    event listeners; otherwise it returns a no-op unlisten.
  - Regression: `__tests__/bridgeEventListeners.test.ts` covers incomplete
    internals returning a no-op subscription.
- PASS: `npm test -- --run __tests__/bridgeEventListeners.test.ts __tests__/MainClient.sync.test.tsx`
  - 2 files / 17 tests.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx __tests__/projectWorkflowGraphView.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/bridgeEventListeners.test.ts __tests__/MainClient.sync.test.tsx`
  - 6 files / 67 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: browser smoke
  - Opened `/ai_assistants/workflow-runs` and confirmed Workflow Runs content
    loaded with no `Runtime TypeError` and no console error logs.
  - Opened `/integrations-hub/workflow-execution-requests` and confirmed
    Execution Requests content loaded with no `Runtime TypeError` and no console
    error logs.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 181 files / 1241 tests
  - cargo check PASS
  - build PASS

## 2026-06-16 - TDD Round 22: Configure Missing Executor From Workflow Runs

- RED:
  - Added AI Assistants component coverage for an unresolved Analysis draft
    executor candidate.
  - Confirmed the test failed because Workflow Runs showed `unresolved` but did
    not provide a direct path to configure the missing executor.
- GREEN:
  - Added `Configure executor` in the Executor Candidate inspector when the
    candidate state is `unresolved`.
  - The action navigates to `/integrations-hub/commands`.
  - The action does not create, approve, run, spawn, or mutate any external
    command; command mapping edits remain owned by the Commands sheet.
- Decision:
  - Workflow Runs is the orchestration visual companion. Missing executor
    assignment should route PMs to Integration Hub instead of hiding behind
    slash commands or implicit model-specific behavior.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx`
  - 1 file / 20 tests.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx __tests__/projectWorkflowGraphView.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.commandMappingExecutorRegistry.test.ts __tests__/bridgeEventListeners.test.ts`
  - 5 files / 53 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/commands,/integrations-hub/workflow-execution-requests`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/commands`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: browser smoke
  - Opened `/ai_assistants/workflow-runs`; Workflow Runs content loaded, no
    `Runtime TypeError`, no console error logs.
  - Opened `/integrations-hub/commands`; Commands content loaded, no
    `Runtime TypeError`, no console error logs.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 181 files / 1242 tests
  - cargo check PASS
  - build PASS
- Baseline blocker refinement:
  - A later full run reproduced the Tauri event listener race after the
    pre-check passed. Root cause was narrower: test/runtime internals can change
    between `canUseTauriEventRuntime()` and `@tauri-apps/api/event.listen()`.
  - `lib/bridge/index.ts` now also catches event registration failures, logs a
    warning, and returns a no-op subscription so background UI effects do not
    create unhandled promise rejections.
  - Regression added in `__tests__/bridgeEventListeners.test.ts` for
    registration-time `transformCallback` rejection.
- PASS: `npm test -- --run __tests__/bridgeEventListeners.test.ts __tests__/MainClient.sync.test.tsx`
  - 2 files / 18 tests.
- PASS: `npm test`
  - 181 files / 1243 tests.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 178 files / 1207 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain limited to the pre-existing
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    trace and `next.config.mjs` NFT trace.

## 2026-06-16 - TDD Round 9: Approve Execution Request Package

- Decision:
  - Integrations Hub can now move a dry-run execution request from
    `review_required` to `approved_for_executor`.
  - Approval is still not execution. The UI writes the approved package back to
    disk and refreshes the queue; it does not spawn commands, agents, terminals,
    PR actions, deploys, or external writes.
- RED:
  - Added a detail sheet component test requiring an `Approve for executor`
    button for review-required packages.
  - Confirmed the expected failure: no accessible approval button existed.
- GREEN:
  - Added `onApproveWorkflowExecutionRequest` to the execution request detail
    inspector.
  - Added an approval button that is only shown for `review_required` packages.
  - Wired `PluginsHubView` to approve the selected package with
    `approveProjectWorkflowExecutionRequest()`, write the serialized JSON to
    the same package path through the bridge, refresh the queue, and update the
    selected row.
- Manual E2E smoke:
  - Created a temporary review-required F54 execution request package.
  - Opened
    `http://localhost:43187/integrations-hub/workflow-execution-requests` in
    the in-app browser.
  - Selected the row and clicked `Approve for executor`.
  - Read the package JSON from disk and confirmed:
    `reviewStatus: approved_for_executor`,
    `policyGate.state: approved_for_executor`, `approvedBy: Human Lead`,
    `approvedAt` present, and `executionState: dry_run_only`.
  - Confirmed no `Run draft` or `Open terminal` controls were visible.
  - Browser console error count: 0.
  - Removed the temporary smoke package after verification.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx`
  - 1 file / 2 tests.
- PASS: `npm run typecheck`
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 28 tests.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1212 tests
  - cargo check PASS
  - build PASS

## 2026-06-16 - TDD Round 10: Future Executor Consumption Policy

- Decision:
  - Added the first pure policy boundary for future executor runners.
  - This policy does not execute anything; it only answers whether a package is
    blocked or ready for a future executor handoff.
  - A package must be `approved_for_executor` and have a resolved Integration
    Hub executor candidate before the policy returns `ready`.
- RED:
  - Added package store tests requiring:
    - `review_required` packages to be blocked.
    - approved unresolved packages to be blocked.
    - approved resolved dry-run packages to return a ready decision with command
      data.
  - Confirmed expected failure:
    `evaluateProjectWorkflowExecutionRequestConsumption is not a function`.
- GREEN:
  - Added `ProjectWorkflowExecutionRequestConsumptionDecision`.
  - Added `evaluateProjectWorkflowExecutionRequestConsumption()`.
  - Exported the helper and type through `lib/project-workflows/index.ts`.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 1 file / 7 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 31 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1215 tests
  - cargo check PASS
  - build PASS

## 2026-06-16 - TDD Round 11: Executor Gate Visibility

- Decision:
  - The Execution Request detail inspector now shows the same blocked/ready
    executor consumption decision that a future runner would receive.
  - This is still display-only. It does not add a runner, terminal launch, shell
    execution, agent spawn, or external write.
- RED:
  - Added component tests requiring review-required rows to show
    `Executor gate`, `blocked`, and the approval-required reason.
  - Added component tests requiring approved resolved dry-run rows to show
    `Executor gate`, `ready`, the ready reason, and the dry-run command preview.
  - Confirmed expected failures because the detail sheet did not render the
    executor gate.
- GREEN:
  - Imported the pure executor consumption policy into the detail inspector.
  - Rendered a compact `Executor gate` block with state, reason, and command
    preview when ready.
- Manual E2E smoke:
  - Created a temporary approved F54 execution request package.
  - Opened
    `http://localhost:43187/integrations-hub/workflow-execution-requests` in
    the in-app browser.
  - Selected the row and confirmed the detail inspector showed
    `Executor gate`, `ready`, the ready reason, and
    `npm run verify:baseline`.
  - Confirmed no `Run draft` or `Open terminal` controls were visible.
  - Browser console error count: 0.
  - Removed the temporary smoke package after verification.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx`
  - 1 file / 4 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 33 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1217 tests
  - cargo check PASS
  - build PASS

## 2026-06-16 - TDD Round 12: Dry-Run Executor Handoff Record

- Decision:
  - Added a dry-run handoff record type for future executor consumption
    attempts.
  - The record is audit evidence only. It captures ready or blocked policy
    decisions and never executes shell commands, agents, terminals, PR actions,
    deploys, or external writes.
  - Blocked policy attempts are recorded too, so a future runner denial can be
    inspected after the fact.
- RED:
  - Added tests requiring approved ready packages to produce
    `ready_for_executor` handoff records with dry-run command data.
  - Added tests requiring review-required packages to produce
    `blocked_by_policy` handoff records without command execution data.
  - Confirmed expected failure:
    `buildProjectWorkflowExecutorHandoffRecord is not a function`.
- GREEN:
  - Added `ProjectWorkflowExecutorHandoffRecord`.
  - Added `buildProjectWorkflowExecutorHandoffRecord()`.
  - Added `serializeProjectWorkflowExecutorHandoffRecord()`.
  - Exported handoff record helpers and types through the project workflows
    barrel.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 1 file / 9 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 35 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1219 tests
  - cargo check PASS
  - build PASS
- Remaining risk:
  - Execution request packages are not consumed by a real executor yet. The
    next slice should add an Integration Hub queue/read view and policy gate
    before any real command or agent execution is allowed.

## 2026-06-16 - TDD Round 13: Integration Hub Execution Records Sheet

- Decision:
  - Split Integration Hub execution state into two durable surfaces:
    `Execution Requests` for pending/reviewable handoff packages and
    `Execution Records` for audit evidence created when an executor handoff
    attempt is recorded.
  - `Record executor handoff` writes a dry-run audit record only. It never
    launches a terminal, shell command, AI agent, PR action, deploy, or external
    write beyond the sidecar record.
  - Records can capture both `ready_for_executor` and `blocked_by_policy`
    outcomes so future executor denials are traceable.
- RED:
  - Added store test requiring handoff records to persist under
    `.project-manager/project-workflow-execution-records/`.
  - Added Integration Hub inventory tests requiring handoff records to load as
    `workflow-execution-records` rows.
  - Added sheet action test requiring `workflow-execution-records` to be part
    of the inventory scan/test registry.
  - Added detail sheet tests requiring a `Record executor handoff` action and a
    read-only execution record inspector.
  - Confirmed expected failures: missing save function, missing records loader,
    missing sheet id, and missing button.
- GREEN:
  - Added stable handoff record directory/path/save helpers.
  - Added Integration Hub `Execution Records` sheet, loader, row mapper, scan
    action, test action, tab badge, loading/error state, and route banner.
  - Added detail inspector support for execution record payloads.
  - Added `Record executor handoff` action on execution request details; it
    builds and saves a dry-run handoff record through the bridge `writeFile`
    adapter and refreshes request/record inventories.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.sheetActions.test.ts`
  - 3 files / 16 tests.
- PASS: `npm run typecheck`
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.sheetActions.test.ts`
  - 4 files / 22 tests.
- PASS: `npm run typecheck`
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 40 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-records`: Next dev Issues 0.
- Manual Chrome smoke:
  - Created a temporary approved F54 execution request package.
  - Opened `/integrations-hub/workflow-execution-requests`.
  - Selected `F54 · Verification`.
  - Clicked `Record executor handoff`.
  - Confirmed success message and opened
    `/integrations-hub/workflow-execution-records`.
  - Confirmed `F54 · Verification`, `ready_for_executor`, and the audit banner
    were visible.
  - Confirmed there was no runtime `Run` button.
  - Removed the temporary smoke request and generated record sidecars.
  - Browser runtime errors: none observed; Chrome reported one generic 404
    resource console message with no associated route response, while
    `verify:dev-issues` remained 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1224 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain limited to the pre-existing
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    trace and `next.config.mjs` NFT trace.
- PASS: re-run `npm run verify:baseline` after dev-log update
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1224 tests
  - cargo check PASS
  - build PASS
- Remaining risk:
  - Execution records are audit sidecars, not real execution results. A future
    runner must still implement a reviewed command/agent execution boundary,
    runner permissions, stdout/stderr capture, retry/cancel policy, and durable
    result records before true execution is enabled.

## 2026-06-16 - TDD Round 14: Guarded Dry-Run Executor Result

- Decision:
  - Added a runner-shaped dry-run result record before enabling any real
    process execution.
  - `Run dry-run executor` evaluates the same executor consumption policy as a
    future real runner and writes either `dry_run_completed` or
    `blocked_by_policy` to the existing execution records audit directory.
  - This remains simulated. It does not call `spawnAgent`, `spawnTerminal`,
    shell commands, AI agents, PR actions, deploys, or external tools.
- RED:
  - Added store tests requiring approved/resolved packages to produce
    `dry_run_completed` records with runner state, exit code, stdout/stderr
    previews, policy decision, and command preview.
  - Added store tests requiring blocked packages to produce
    `blocked_by_policy` records without exit code or command execution data.
  - Added store persistence test requiring dry-run runner records to write under
    `.project-manager/project-workflow-execution-records/`.
  - Added detail sheet test requiring `Run dry-run executor` to call a guarded
    handler without showing a bare runtime `Run` control.
  - Added inventory/detail tests requiring runner result state to appear in
    Execution Records rows and inspector details.
  - Confirmed expected failures: missing runner record builder, save helper,
    UI action, and runner result display.
- GREEN:
  - Added `ProjectWorkflowExecutorRunRecord`,
    `buildProjectWorkflowExecutorRunRecord()`,
    `serializeProjectWorkflowExecutorRunRecord()`, and
    `saveProjectWorkflowExecutorRunRecord()`.
  - Exported runner record APIs through `lib/project-workflows/index.ts`.
  - Added `Run dry-run executor` action to the Execution Request detail
    inspector.
  - Wired Plugins Hub to write dry-run runner result records through the bridge
    `writeFile` adapter.
  - Added runner result badges and detail fields for Execution Records.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 1 file / 13 tests.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 2 files / 20 tests.
- PASS: `npm test -- --run __tests__/integrations.workflowExecutionRequests.test.ts`
  - 1 file / 4 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.sheetActions.test.ts`
  - 4 files / 26 tests.
- PASS: `npm run typecheck`
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 44 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-records`: Next dev Issues 0.
- Manual Chrome smoke:
  - Created a temporary approved F54 execution request package.
  - Opened `/integrations-hub/workflow-execution-requests`.
  - Selected `F54 · Verification`.
  - Clicked `Run dry-run executor`.
  - Confirmed `Dry-run executor result recorded.`
  - Opened `/integrations-hub/workflow-execution-records`.
  - Confirmed `dry_run_completed`, `completed`, and the stdout preview were
    visible.
  - Confirmed there was no bare runtime `Run` button.
  - Removed the temporary smoke request and generated result record sidecars.
  - Browser runtime errors: none observed; Chrome reported one generic 404
    resource console message with no associated route response, while
    `verify:dev-issues` remained 0.
- Pending verification:
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1228 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain limited to the pre-existing
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    trace and `next.config.mjs` NFT trace.
- PASS: re-run `npm run verify:baseline` after dev-log update
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1228 tests
  - cargo check PASS
  - build PASS
- Remaining risk:
  - True execution still needs a separate reviewed runner boundary with
    permission prompts, command allowlist enforcement, process spawn, stdout /
    stderr capture, cancel/retry behavior, and durable real-result records.

## 2026-06-16 - Kickoff

- Feature: F54 Workflow Execution Drafts & Run-Level Auto Mode.
- Goal: Start node creates an auditable execution draft; run-level mode controls
  manual-only, auto-safe, or paused behavior.
- Scope:
  - execution mode state;
  - execution draft state;
  - start-node draft creation;
  - UI controls and draft preview;
  - sidecar persistence.
- Out of scope:
  - real shell execution;
  - real AI agent spawn;
  - real Integration Hub command/tool execution;
  - PR/push/deploy/external writes.
- Risks:
  - Execution controls can be mistaken for real execution; UI copy must say this
    slice creates drafts only.
  - Auto-run policy must remain run-level while node eligibility is computed.
  - Existing dirty F53 listener/root fixes must be preserved and not reverted.
- Planned test scope:
  - unit: engine state transitions and draft policy;
  - unit: graph projection of draft state;
  - integration: Workflow Runs UI start-node draft preview;
  - manual E2E: route smoke and dev issues check.

## 2026-06-16 - TDD Round 1: Execution Draft State

- RED:
  - Added engine tests proving new runs default to `manual_only` and empty
    `executionDrafts`.
  - Added tests for start-node draft creation, paused-mode blocking,
    auto-safe eligibility, and high-risk auto-run blocking.
  - Confirmed expected failures before implementation: `executionMode` and
    `executionDrafts` were undefined and paused mode did not block start.
- GREEN:
  - Added run-level `executionMode`.
  - Added `ProjectWorkflowExecutionDraft` state.
  - `startProjectWorkflowNode` now creates `execution_draft_created` events and
    a draft preview without running any actor/tool.
  - Paused mode records `execution_draft_blocked` and leaves the node ready.
  - Integration Hub is modeled as policy metadata (`pending_integration_hub`
    for tool drafts) but real tool execution remains out of scope.
- PASS: `npm test -- --run __tests__/projectWorkflowEngine.test.ts`
  - 19 tests.

## 2026-06-16 - TDD Round 2: Graph + UI Draft Controls

- RED:
  - Added graph projection test for selected-node execution draft details.
  - Added AI Assistants component test for `Execution Mode`, `Start node`, sidecar
    persistence, and draft preview.
  - Added regression coverage for save-success/list-empty fallback after manual
    browser smoke showed the empty state could remain after a successful write.
- GREEN:
  - Graph view now projects run-level execution mode and selected-node draft.
  - Workflow Runs graph header shows execution mode.
  - Node inspector shows `Start node` and execution draft details.
  - `Start node` persists the updated run sidecar and reloads sidecars.
  - Save workflow run now falls back to the newly created run if the browser dev
    sidecar reload returns empty immediately after write.
- Manual E2E smoke:
  - Opened `http://localhost:43187/ai_assistants/workflow-runs`.
  - Saved an F54 workflow run from the empty state.
  - Confirmed graph appears with `Execution Mode` and `Start node`.
  - Clicked `Start node`.
  - Confirmed `Execution Draft`, `manual_run_required`, and the manual-only
    eligibility reason appear.
  - Browser console error count: 0.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.
- PASS: `npm test -- --run __tests__/projectWorkflowEngine.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx __tests__/bridgeEventListeners.test.ts __tests__/MainClient.sync.test.tsx __tests__/useFontZoomShortcuts.test.tsx __tests__/IssuesTab.test.tsx __tests__/dispatch.kill-confirm.test.tsx __tests__/BatchDispatchModal.state.test.tsx __tests__/dispatch.early-exit-race.test.tsx`
  - 10 files / 95 tests.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 174 files / 1195 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.

## 2026-06-16 - TDD Round 16: Cross-Discipline Executor Registry Injection

- RED:
  - Added resolver coverage requiring a supplied Integration Hub executor
    registry to resolve a non-software capability:
    `construction:qa:inspection-tool`.
  - Confirmed expected failure: the resolver ignored the supplied registry and
    returned `unresolved`.
- GREEN:
  - Added `ProjectWorkflowExecutorRegistry`.
  - Renamed the built-in software verification mapping to
    `DEFAULT_PROJECT_WORKFLOW_EXECUTOR_REGISTRY`.
  - Updated `resolveProjectWorkflowDraftExecutor()` to accept an optional
    registry argument while preserving the existing default software template
    behavior.
  - Exported the registry constant and type through `lib/project-workflows`.
- Decision:
  - Did not add new command-mapping fields yet. The current channel command
    mapping model has triggers/actions but no capability metadata, so this slice
    creates the resolver seam first. The next safe step is a typed mapper from
    Integration Hub command/tool rows into `ProjectWorkflowExecutorRegistry`.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionResolver.test.ts __tests__/projectWorkflowExecutionPackageStore.test.ts && npm run typecheck`
  - 2 files / 18 tests plus `tsc --noEmit`.

## 2026-06-16 - TDD Round 17: Command Mapping Executor Registry Mapper

- RED:
  - Added mapper tests requiring enabled command mappings with executor metadata
    to build `ProjectWorkflowExecutorRegistry` entries.
  - Added safety tests requiring disabled or incomplete command mappings to be
    ignored.
  - Added integration-style unit coverage proving the generated registry can be
    passed into `resolveProjectWorkflowDraftExecutor()` for a cross-discipline
    capability.
  - Confirmed expected failure:
    `TypeError: buildExecutorRegistryFromCommandMappings is not a function`.
- GREEN:
  - Added optional `executor` metadata to `CommandMapping`:
    `capabilityId`, dry-run command, command preview, label, and safety notice.
  - Added `buildExecutorRegistryFromCommandMappings()` in the channel/command
    mapping mapper layer.
  - Command mapping rows now include the executor capability id as a badge when
    present.
- Decision:
  - This slice intentionally does not add form controls for editing executor
    metadata yet. The typed storage/mapper contract is now in place; the next
    safe slice is the UI editor and persistence path for those fields.
- PASS: `npm test -- --run __tests__/integrations.commandMappingExecutorRegistry.test.ts && npm run typecheck`
  - 1 file / 3 tests plus `tsc --noEmit`.

## 2026-06-16 - TDD Round 18: Command Mapping Executor Metadata Editor

- RED:
  - Added detail sheet coverage requiring command mapping rows to expose
    executor metadata fields and save structured executor metadata:
    capability id, command, args, command preview, label, and safety notice.
  - Confirmed expected failure: `Executor capability` label was not present in
    the command mapping editor.
- GREEN:
  - Added executor metadata state and inputs to `CommandMappingEditForm`.
  - Save now emits `executor` metadata with command args normalized from a
    whitespace-separated field into an ordered string array.
  - Updated `IntegrationsDetailSheet` and `PluginsHubView` command mapping
    update/add patch types so executor metadata persists with the mapping.
- Decision:
  - Kept args parsing simple and deterministic for this slice. Quoted argument
    parsing can be added later if command mappings need shell-like syntax, but
    the stored contract is already structured.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx`
  - 1 file / 8 tests.
- PASS: `npm test -- --run __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.commandMappingExecutorRegistry.test.ts && npm run typecheck`
  - 2 files / 11 tests plus `tsc --noEmit`.
- PASS: `npm run verify:dev-issues -- --routes /integrations-hub/commands`
  - `Next dev Issues: 0`.
- Manual UI smoke:
  - Opened `http://127.0.0.1:43187/integrations-hub/commands`.
  - Opened the `/run` command mapping detail sheet.
  - Filled executor capability, command, args, and preview fields.
  - Saved the mapping and confirmed the table row displayed
    `construction:qa:inspection-tool` as a capability badge.
  - Cleared all executor metadata fields, saved again, reloaded the route, and
    confirmed the smoke capability was gone while `/run` remained.
  - Browser console errors: 0.

## 2026-06-16 - TDD Round 19: Workflow Runs Uses Integration Hub Executor Registry

- RED:
  - Added package-store coverage requiring `buildProjectWorkflowExecutionRequests()`
    to accept an injected Integration Hub executor registry and resolve an
    auto-requested Analysis draft from that registry.
  - Added AI Assistants console coverage requiring Workflow Runs persistence to
    pass a generated command-mapping executor registry into
    `saveProjectWorkflowExecutionRequests()` when command mappings define
    executor metadata.
  - Confirmed expected failures:
    - package builder returned `unresolved` for the injected
      `software:analysis:agent` registry candidate.
    - Workflow Runs persisted request packages with only the existing two
      arguments, so Integration Hub metadata could not affect sidecar
      generation.
- GREEN:
  - `buildProjectWorkflowExecutionRequests()` now accepts an optional
    `ProjectWorkflowExecutorRegistry`.
  - `saveProjectWorkflowExecutionRequests()` can pass the optional registry into
    package generation while preserving the existing default path.
  - Workflow Runs persistence builds a registry from enabled command mappings
    using `buildExecutorRegistryFromCommandMappings(loadChannelCatalog().commandMappings)`.
  - The UI keeps the old two-argument save call when the generated registry is
    empty, preserving existing behavior and tests.
- Decision:
  - This still does not execute commands. It only improves sidecar resolution so
    future executor runners can consume explicit Integration Hub metadata rather
    than hard-coded workflow defaults.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 1 file / 16 tests.
- PASS: `npm test -- --run __tests__/ai-assistants.console.test.tsx`
  - 1 file / 17 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.commandMappingExecutorRegistry.test.ts __tests__/ai-assistants.console.test.tsx && npm run typecheck`
  - 3 files / 36 tests plus `tsc --noEmit`.

## 2026-06-16 - TDD Round 15: Dry-Run Runner Adapter Contract

- RED:
  - Added unit coverage requiring approved execution requests to flow through a
    shared `runProjectWorkflowExecutorDryRun()` runner adapter entrypoint before
    the result record is built.
  - Added safety coverage requiring blocked requests to return
    `blocked_by_policy` without calling the runner adapter.
  - Confirmed expected failure:
    `TypeError: runProjectWorkflowExecutorDryRun is not a function`.
- GREEN:
  - Added `ProjectWorkflowExecutorRunnerAdapter` with a guarded
    `runDryRunCommand()` contract.
  - Added the default dry-run adapter that returns stdout/stderr previews and
    never spawns a shell/process.
  - Added `runProjectWorkflowExecutorDryRun()` so UI actions use the same
    policy gate and adapter boundary that a future real runner must use.
  - Updated Integrations Hub `Run dry-run executor` to call the runner entrypoint
    instead of hand-building runner results in the UI callback.
- Refactor / decision:
  - Kept blocked-package behavior inside the package store; blocked requests
    build an audit record and never cross the runner adapter boundary.
  - Allowed completed dry-run records to store a numeric exit code from the
    adapter, while the default adapter still emits exit code `0`.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 1 file / 15 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.workflowExecutionRequests.test.ts && npm run typecheck`
  - 3 files / 26 tests plus `tsc --noEmit`.
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests,/integrations-hub/workflow-execution-records`
  - `Next dev Issues: 0` on all three changed routes.
- Manual UI smoke:
  - Created a temporary approved request sidecar:
    `.project-manager/project-workflow-execution-requests/f54-smoke-runner-adapter-request.json`.
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-requests`.
  - Used `Rescan`, opened `F54 · Verification`, confirmed executor gate
    `ready`, and clicked `Run dry-run executor`.
  - Confirmed `Dry-run executor result recorded.` appeared after a route reload
    refreshed the latest dev bundle.
  - Opened
    `http://127.0.0.1:43187/integrations-hub/workflow-execution-records`,
    confirmed one `dry_run_completed` record row, opened it, and verified runner
    state plus stdout preview were visible.
  - Confirmed the execution record detail view does not show a runtime
    `Run dry-run executor` action.
  - Browser console errors: 0.
  - Removed the temporary smoke request and generated record.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1230 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.
- Remaining manual gate:
  - In-app browser smoke passed with console errors `[]`.
  - A real Chrome/Safari/Tauri manual smoke is still recommended before marking
    F54 100% or shipping, per `docs/engineering/verification-runbook.md` section 6.

## 2026-06-16 - TDD Round 4: Integration Hub Executor Candidate Resolver

- Decision:
  - Continue keeping F54 dry-run only. Integration Hub now contributes
    executor candidates and command previews; Project Manager still does not
    spawn an external actor/tool from Workflow Runs.
  - `software:verification:tool` is the first registered resolver entry and maps
    to the Integration Hub `commands` sheet with source kind `command-mapping`
    and preview `npm run verify:baseline`.
- RED:
  - Added `projectWorkflowExecutionResolver` unit tests for known and unknown
    draft capability ids.
  - Added graph projection test requiring inspector `executorResolution`.
  - Added AI Assistants component test requiring the Execution Draft inspector
    to show `Executor Candidate`, command preview, and `dry_run_only`.
  - Added route/store coverage for browser dev sidecar listing after manual
    smoke showed reload could not discover persisted Project Workflow sidecars
    outside Tauri.
- GREEN:
  - Added `lib/project-workflows/projectWorkflowExecutionResolver.ts`.
  - Exported resolver types/functions through `lib/project-workflows/index.ts`.
  - Graph inspector now projects `executorResolution`.
  - Workflow Runs inspector now renders Integration Hub executor candidate
    metadata.
  - Added dev-only `/api/editor/list-files` route and browser fallback in
    `listProjectFiles()` so Chrome/Next dev reload can discover workflow run
    sidecars like Tauri does.
- Manual E2E smoke:
  - Created a temporary F54 executor smoke sidecar with a verification tool
    draft and no external execution.
  - Reloaded `http://localhost:43187/ai_assistants/workflow-runs` in the
    in-app browser.
  - Confirmed the reloaded sidecar appeared without relying on React save
    fallback state.
  - Selected the `Verification` node.
  - Confirmed `Executor Candidate`, `Run Project Manager verification baseline`,
    `npm run verify:baseline`, and `dry_run_only` were visible.
  - Browser console error count: 0.
  - Removed the temporary smoke sidecar after verification.
- PASS: `npm test -- --run __tests__/editor.list-files-route.test.ts __tests__/projectWorkflowRunStore.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx`
  - 5 files / 26 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.

## 2026-06-16 - TDD Round 8: Execution Request Review Gate

- Decision:
  - Execution request packages are now explicitly review-gated before any
    future executor can consume them.
  - New packages default to `review_required` with a policy reason.
  - `approved_for_executor` is a pure state transition that records approver
    and approval time; it does not run shell commands, agents, PR actions,
    deploys, or external writes.
  - Integrations Hub exposes the review gate as the Execution Requests row
    category and in the read-only detail inspector.
- RED:
  - Added package store coverage requiring default `review_required` policy
    metadata and an approval helper that preserves `dry_run_only`.
  - Added Integration Hub loader coverage requiring `review_required` category
    and badge mapping.
  - Added detail sheet coverage requiring the inspector to show review status
    and policy reason without runtime execution controls.
- GREEN:
  - Added `ProjectWorkflowExecutionRequestReviewStatus`, `reviewStatus`,
    `policyGate`, `approvedBy`, and `approvedAt` to execution request packages.
  - Added `approveProjectWorkflowExecutionRequest()` and exported it through the
    project workflow barrel.
  - Updated Integrations Hub execution request rows to classify packages by the
    review gate instead of only `dry_run_only`.
  - Updated the Execution Request Package inspector to show review status,
    policy reason, approver, and approval time.
- Manual E2E smoke:
  - Created a temporary dry-run F54 execution request package with
    `review_required`.
  - Opened
    `http://localhost:43187/integrations-hub/workflow-execution-requests` in
    the in-app browser.
  - Confirmed the table row showed `F54 · Verification`, `review_required`,
    `dry_run_only`, and `pending_external_executor`.
  - Opened the row detail inspector.
  - Confirmed `Execution Request Package`, policy reason,
    `npm run verify:baseline`, prompt labels, memory/tool/evidence metadata,
    and safety notice were visible.
  - Confirmed no `Open terminal` or `Run draft` execution controls were visible.
  - Browser console error count: 0.
  - Removed the temporary smoke package after verification.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts`
  - 1 file / 4 tests.
- PASS: `npm test -- --run __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx`
  - 2 files / 3 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowExecutionPackageStore.test.ts __tests__/integrations.workflowExecutionRequests.test.ts __tests__/integrations.executionRequestDetailSheet.test.tsx __tests__/integrations.sheetActions.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 27 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs,/integrations-hub/workflow-execution-requests`
  - `/ai_assistants/workflow-runs`: Next dev Issues 0.
  - `/integrations-hub/workflow-execution-requests`: Next dev Issues 0.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 180 files / 1211 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain limited to the pre-existing
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    trace and `next.config.mjs` NFT trace.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 177 files / 1202 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain limited to the pre-existing
    `app/api/integrations/scan-applications/route.ts` broad `/Applications`
    trace and `next.config.mjs` NFT trace.

## 2026-06-16 - TDD Round 5: Auto-Safe Start Auto-Requests Eligible Draft

- Decision:
  - `auto_safe_nodes` now means a low-risk eligible agent/tool draft is
    automatically moved to `run_requested` after `Start node`.
  - The action is still dry-run/pending-executor only. No shell command, agent
    process, PR, push, deploy, or external write is executed.
- RED:
  - Added engine test requiring `autoRequestEligibleProjectWorkflowDrafts()` to
    mark eligible drafts as `run_requested` with `runRequestedBy: Auto Run
    Policy`.
  - Added AI Assistants component test requiring the Start node UI path to save
    a `run_requested` Analysis draft without pressing `Run draft`.
  - Confirmed expected UI failure: the saved run still had
    `status: auto_run_allowed`.
- GREEN:
  - Added `autoRequestEligibleProjectWorkflowDrafts()` to the Project Workflow
    engine and exported it through `lib/project-workflows/index.ts`.
  - Workflow Runs `Start node` now applies the auto-request policy before
    persisting the sidecar.
  - Execution Draft inspector now shows `runRequestedBy` so `Auto Run Policy`
    is visible to the user.
- Manual E2E smoke:
  - Created a temporary F54 auto-safe sidecar with Intake succeeded and Analysis
    ready.
  - Reloaded `http://localhost:43187/ai_assistants/workflow-runs` in the
    in-app browser.
  - Selected `Analysis`, clicked `Start node`, and did not click `Run draft`.
  - Confirmed `run_requested`, `Auto Run Policy`, and
    `pending_external_executor` were visible.
  - Browser console error count: 0.
  - Removed the temporary smoke sidecar after verification.
- PASS: `npm test -- --run __tests__/editor.list-files-route.test.ts __tests__/projectWorkflowRunStore.test.ts __tests__/projectWorkflowExecutionResolver.test.ts __tests__/projectWorkflowEngine.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx`
  - 6 files / 49 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.
- PASS: `npm run verify:baseline`
  - vitest PASS: 177 files / 1204 tests
  - cargo check PASS
  - build PASS
- PASS: `npm test -- --run __tests__/projectWorkflowEngine.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx`
  - 3 files / 36 tests.
- PASS: `npm test -- --run __tests__/projectWorkflowEngine.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx __tests__/bridgeEventListeners.test.ts __tests__/MainClient.sync.test.tsx __tests__/useFontZoomShortcuts.test.tsx __tests__/IssuesTab.test.tsx __tests__/dispatch.kill-confirm.test.tsx __tests__/BatchDispatchModal.state.test.tsx __tests__/dispatch.early-exit-race.test.tsx`
  - 10 files / 92 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 174 files / 1192 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.

## 2026-06-16 - TDD Round 3: Run-Level Mode Controls + Draft Run Request

- RED:
  - Added engine test for changing run-level execution mode with an audit event.
  - Added engine test for requesting a draft run without executing a real
    external actor/tool.
  - Added AI Assistants component test for the user path:
    `Auto-run safe nodes` -> `Start node` -> `Run draft`.
  - Confirmed expected failures before implementation:
    `requestProjectWorkflowDraftRun` / `setProjectWorkflowExecutionMode` were
    missing from the engine/barrel export, and the UI had no mode buttons or
    `Run draft` action.
- GREEN:
  - Added `execution_mode_changed` and `execution_draft_run_requested` events.
  - Added `run_requested`, `runRequestedBy`, `runRequestedAt`, and
    `executionResult: pending_external_executor` to execution drafts.
  - Added run-level mode controls to the Workflow Graph header.
  - Added `Run draft` in the Execution Draft inspector; it records the request
    and leaves real execution to a future Integration Hub executor.
  - Exported the new engine APIs through `lib/project-workflows/index.ts` so UI
    imports use the canonical project-workflows barrel.
- Manual E2E smoke:
  - Opened `http://localhost:43187/ai_assistants/workflow-runs`.
  - Waited for Project Manager root hydration.
  - Saved an F54 workflow run from the empty state.
  - Switched run mode to `Auto-run safe nodes`.
  - Clicked `Start node`.
  - Clicked `Run draft`.
  - Confirmed `run_requested` and `pending_external_executor` are visible.
  - Browser console error count: 0.
- PASS: `npm test -- --run __tests__/projectWorkflowEngine.test.ts __tests__/projectWorkflowGraphView.test.ts __tests__/ai-assistants.console.test.tsx`
  - 3 files / 40 tests.
- PASS: `npm run typecheck`
- PASS: `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`
  - Result: `Next dev Issues: 0`.
