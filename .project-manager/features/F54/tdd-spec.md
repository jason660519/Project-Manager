# F54 TDD Specification

## Strategy

F54 is execution-adjacent, so state-machine tests come before UI. The first
slice proves that `Start node` creates auditable execution drafts and that
run-level auto mode is policy-gated without executing real actors or tools.

## Test Layers

| Layer | Target | Purpose |
|---|---|---|
| Unit | `lib/project-workflows/projectWorkflowEngine.ts` | Run-level execution mode, start-node draft creation, paused blocking, high-risk auto-run blocking. |
| Unit | `lib/project-workflows/projectWorkflowExecutionResolver.ts` | Draft capability ids resolve to dry-run Integration Hub executor candidates. |
| Store | `lib/project-workflows/projectWorkflowRunStore.ts` | Drafts serialize and parse as part of the run sidecar. |
| Store | `lib/project-workflows/projectWorkflowExecutionPackageStore.ts` | `run_requested` drafts serialize into dry-run execution request packages for future Integration Hub executors. |
| Unit | `lib/project-workflows/projectWorkflowExecutionPackageStore.ts` | Executor consumption policy blocks unapproved or unresolved packages before future runners can consume them. |
| Unit | `lib/project-workflows/projectWorkflowExecutionPackageStore.ts` | Dry-run executor handoff records preserve ready/blocked consumption attempts as audit evidence. |
| Unit | `lib/project-workflows/projectWorkflowExecutionPackageStore.ts` | Dry-run executor run records preserve completed/blocked runner outcomes without process spawn. |
| Unit | `lib/project-workflows/projectWorkflowExecutionPackageStore.ts` | Live executor run records block dry-run-only requests and record approved Tauri spawn evidence. |
| Unit | `lib/integrations/load-project-inventory.ts` | Execution request packages load as Integrations Hub dry-run queue rows. |
| Unit | `lib/integrations/load-project-inventory.ts` | Executor handoff/run records load as Integrations Hub dry-run audit rows. |
| Component | `app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx` | Execution request row details reveal review gate, prompt/tool/memory/handoff/evidence payload without execution controls. |
| Component | `app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx` | Execution request row details show the same blocked/ready executor consumption policy decision future runners use. |
| Component | `app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx` | Execution request rows can record a dry-run handoff attempt and execution record rows remain read-only audit details. |
| Component | `app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx` | Execution request rows can run the dry-run executor and execution record rows show runner result details. |
| Component | `app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx` | Approved live-command execution requests expose an explicit live runner action, and live records show pid/spawn token evidence. |
| Component | `app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx` | Execution request/record detail sheets can navigate back to Workflow Runs without executing or mutating sidecars. |
| Component | `app/ui/views/Plugins/_shared/CommandMappingEditForm.tsx` | Command mappings can save an explicit `live_command_allowed` executor opt-in while defaulting to dry-run-only. |
| Integration | `app/ai_assistants/AIAssistantsConsoleClient.tsx` | Workflow Runs UI renders execution mode controls, Start node, draft preview, and Run draft request state. |
| Integration | `app/ai_assistants/AIAssistantsConsoleClient.tsx` | Workflow Runs inspector loads Integration Hub request/record sidecars and shows read-only execution evidence feedback. |
| Integration | `app/ai_assistants/AIAssistantsConsoleClient.tsx` | Workflow Runs honors request/record deep-link query params for run and node selection. |
| Integration | `app/ai_assistants/AIAssistantsConsoleClient.tsx` | Workflow Runs execution evidence can open Integration Hub Execution Records when dry-run record evidence exists. |
| Unit | `app/ui/views/Plugins/PluginsHubView.tsx` | Integration Hub selects linked execution request/record rows from query params. |
| Manual E2E | `/ai_assistants/workflow-runs`, `/integrations-hub/workflow-execution-requests`, `/integrations-hub/workflow-execution-records` | Browser click path has no runtime errors and shows draft request state plus Integration Hub queue/audit rows. |

## Scenarios

### S1 Normal - Start Ready Node Creates Draft

Given a queued workflow run with a ready Intake node  
When the PM starts the Intake node  
Then the run records `node_started` and `execution_draft_created` events  
And an execution draft exists for Intake  
And no real actor/tool command is executed.

Acceptance:

- Draft status is `manual_run_required` for manual-only mode.
- Draft contains node id, actor kind, prompt labels, memory files, expected
  handoff, expected evidence, risk level, and eligibility reason.

### S2 Boundary - Paused Run Blocks Start

Given a workflow run in `paused` execution mode  
When the PM attempts to start a ready node  
Then the node remains ready  
And no draft is created  
And the run records a blocked event with a clear reason.

### S3 Policy - Auto Safe Nodes

Given a run in `auto_safe_nodes` mode  
When a low-risk AI agent or tool node is started  
Then the draft status is `auto_run_allowed` only if node policy allows safe
auto-run.

### S3b Policy - Auto Safe Node Requests Draft Run

Given a run in `auto_safe_nodes` mode  
And a low-risk AI agent or tool draft is eligible for safe auto-run  
When the node is started from Workflow Runs  
Then Project Manager records `run_requested` with `runRequestedBy:
Auto Run Policy`  
And the execution result remains `pending_external_executor`  
And no real external actor/tool is executed.

### S4 Permission - High Risk Requires Human

Given a high-risk node  
When the run is in `auto_safe_nodes` mode  
Then the draft status is `blocked_needs_approval` or `manual_run_required`  
And the eligibility reason says high-risk nodes cannot auto-run.

### S5 UI - Start Node From Inspector

Given the Workflow Runs tab displays a saved Project Workflow run  
When the PM selects a ready node and clicks `Start node`  
Then the inspector shows the execution draft preview  
And the updated sidecar is saved  
And no spawn bridge call is made.

### S6 UI - Change Mode And Request Draft Run

Given the Workflow Runs tab displays a saved Project Workflow run  
When the PM switches to `Auto-run safe nodes`, clicks `Start node`, then clicks
`Run draft`  
Then the updated sidecar is saved after each lifecycle change  
And the inspector shows `run_requested` and `pending_external_executor`  
And no real external actor/tool is executed.

### S7 Policy - Resolve Executor Candidate From Integration Hub Metadata

Given an execution draft has capability id `software:verification:tool`  
When the draft is inspected or prepared for a run request  
Then Project Manager resolves a dry-run executor candidate owned by Integration
Hub metadata  
And the candidate includes the `commands` sheet, `command-mapping` source kind,
`npm run verify:baseline` preview, and `dry_run_only` execution state  
And no shell command is executed.

### S8 Store - Persist Dry-Run Execution Request Package

Given a draft is in `run_requested`
When the workflow run is persisted after `Run draft` or auto-safe start
Then Project Manager writes a package under
`.project-manager/project-workflow-execution-requests/`
And the package includes executor resolution, prompt labels, memory files,
allowed tools, expected handoff, expected evidence, requester, requested time,
`dry_run_only`, `review_required`, and a policy gate reason
And no shell command or external actor is executed.

### S9 Integration Hub - Inspect Execution Request Queue

Given execution request packages exist in the project sidecar queue
When the PM opens `/integrations-hub/workflow-execution-requests`
Then Integrations Hub shows an `Execution Requests` sheet
And each package appears as a `review_required` dry-run
`pending_external_executor` row
And the sheet does not expose command execution or agent execution controls.

### S10 Integration Hub - Inspect Request Payload

Given a PM selects an execution request row
When the detail sheet opens
Then it shows review status, policy gate reason, command preview, system prompt
label, task prompt label, memory files, allowed tools, expected handoff,
expected evidence, requester, and safety notice
And it does not show a runtime `Run` or terminal execution control.

### S11 Policy - Approve Request Without Executing

Given a dry-run execution request package is `review_required`
When a lead clicks `Approve for executor` in Integrations Hub
Then the package becomes `approved_for_executor`
And it records approver and approval time
And the row/detail UI refresh to the approved state
And it remains `dry_run_only` until a separate executor runner consumes it.

### S12 Policy - Gate Future Executor Consumption

Given a future executor asks whether it can consume a package
When the package is still `review_required`
Then the policy returns `blocked`
And the reason says approval is required.

Given a package is `approved_for_executor`
But the executor candidate is unresolved
Then the policy returns `blocked`
And the reason says no resolved Integration Hub executor exists.

Given a package is `approved_for_executor`
And has a resolved dry-run executor command
Then the policy returns `ready`
And includes the dry-run command preview data without executing it.

### S13 UI - Inspect Executor Gate Decision

Given a PM opens a review-required execution request
When the detail inspector renders
Then it shows `Executor gate`, `blocked`, and the approval-required reason.

Given a PM opens an approved resolved dry-run execution request
When the detail inspector renders
Then it shows `Executor gate`, `ready`, the ready reason, and the dry-run
command preview.

### S14 Store - Record Future Executor Handoff Attempt

Given a package is approved and has a ready consumption decision
When a future executor handoff record is built
Then the record status is `ready_for_executor`
And it includes request id, workflow run id, node id, dry-run command data,
policy decision, consumer, timestamp, and a non-execution safety notice.

Given policy blocks a package
When a future executor handoff record is built
Then the record status is `blocked_by_policy`
And it includes the blocked policy decision without command execution data.

### S15 Integration Hub - Persist And Inspect Handoff Records

Given a PM opens an execution request row
When they click `Record executor handoff`
Then Project Manager writes a dry-run record under
`.project-manager/project-workflow-execution-records/`
And the `Execution Records` sheet can load the audit row
And the record detail inspector shows policy state, command preview when
present, consumer, timestamp, and safety notice
And no runtime `Run` or terminal execution control is shown.

### S16 Integration Hub - Run Dry-Run Executor Result

Given an execution request row is approved and resolved
When the PM clicks `Run dry-run executor`
Then Project Manager evaluates the same executor consumption policy
And calls the shared dry-run runner adapter with the approved command package
And writes a result record under
`.project-manager/project-workflow-execution-records/`
And the result status is `dry_run_completed`
And the record includes runner state, exit code `0`, stdout/stderr previews,
policy decision, command preview, and safety notice
And no process is spawned.

Given policy blocks the request
When the dry-run executor is run
Then the result record status is `blocked_by_policy`
And the dry-run runner adapter is not called
And no exit code or command execution data is recorded.

### S17 Integration Hub - Executor Registry Injection

Given a Project Workflow draft has a capability id outside the default software
template
When the resolver receives a supplied executor registry entry for that
capability
Then the draft resolves to the supplied Integration Hub command/tool candidate
And the resolved candidate preserves sheet/source metadata, command preview,
command args, and safety notice.

Given no supplied or default registry entry matches the capability
When the resolver evaluates the draft
Then the capability remains `unresolved`
And Project Manager does not guess a command.

### S18 Integration Hub - Command Mapping Executor Registry

Given an enabled Integration Hub command mapping includes executor metadata
When Project Manager builds the workflow executor registry
Then the mapping becomes a dry-run executor candidate keyed by capability id
And the candidate preserves command mapping source id, command preview, command
args, label, and safety notice.

Given a command mapping is disabled or lacks complete executor metadata
When Project Manager builds the workflow executor registry
Then the mapping is ignored.

Given a registry was built from command mappings
When the Project Workflow resolver receives that registry
Then a matching cross-discipline draft capability resolves through the supplied
Integration Hub command mapping.

### S19 Integration Hub - Command Mapping Executor Metadata Editor

Given a PM opens a command mapping detail sheet
When they enter executor capability id, command, args, and preview
And they save the mapping
Then Project Manager persists structured executor metadata on the command
mapping
And the args field is normalized into an ordered argument array.

Given a command mapping has no executor metadata
When the detail sheet opens
Then the executor fields are empty and existing trigger/action/description
editing still works.

### S20 Workflow Runs - Persist Requests With Integration Hub Registry

Given Integration Hub command mappings include enabled executor metadata
When a Workflow Run starts an auto-safe node and records a requested draft
Then Project Manager builds an executor registry from those mappings
And passes the registry into execution request package generation
And the generated sidecar can resolve the draft capability from Integration Hub
metadata.

Given no command mapping executor metadata is configured
When Workflow Runs persists requested drafts
Then Project Manager preserves the existing request save path without passing an
empty registry.

### S21 Workflow Runs - Visual Companion Uses Integration Hub Registry

Given a Workflow Run inspector is showing a node with an execution draft
And Integration Hub command mappings define executor metadata for the draft
capability
When Project Manager builds the graph view
Then the inspector resolves the executor candidate from the supplied registry
And shows the Integration Hub label and command preview.

Given built-in dry-run executor candidates exist
And Integration Hub command mappings define additional candidates
When Workflow Runs builds its visual executor registry
Then Project Manager combines the built-in registry with Integration Hub
metadata
And command mapping candidates can extend or override by capability without
removing unrelated built-in candidates.

### S22 Workflow Runs - Review Requested Drafts In Integration Hub

Given a Workflow Run node inspector is showing a draft with status
`run_requested`
When the PM clicks `Review execution request`
Then Project Manager navigates to `/integrations-hub/workflow-execution-requests`
And does not execute an agent, tool, shell command, or external side effect.

Given the selected draft also has a linked execution request sidecar
When the PM clicks `Review execution request`
Then Project Manager navigates to
`/integrations-hub/workflow-execution-requests?requestId=<request-id>`
And Integration Hub can select that exact request row after rows load.

Given a draft has not reached `run_requested`
When the PM views the execution draft inspector
Then the Integration Hub review navigation action is not shown.

### S23 Workflow Runs - Configure Missing Executor Candidate

Given a Workflow Run node inspector is showing an execution draft
And the executor candidate resolves to `unresolved`
When the PM clicks `Configure executor`
Then Project Manager navigates to `/integrations-hub/commands`
And does not create, approve, or execute an external command.

Given the executor candidate is resolved
When the PM views the executor candidate block
Then the existing candidate label and command preview remain visible.

### S24 Workflow Runs - Inspect Integration Hub Execution Evidence

Given a Workflow Run node inspector is showing a requested execution draft
And Integrations Hub has an approved execution request sidecar for that draft
And Integrations Hub has a dry-run execution record sidecar for that draft
When the PM selects the workflow node
Then the inspector shows `Execution Evidence`
And it shows the request review state, dry-run record status, and runner result
summary
And it does not approve, run, spawn, or mutate either sidecar.

Given request and record sidecars are missing or malformed
When the PM opens Workflow Runs
Then the graph still renders the execution draft and executor candidate safely
And no external execution is attempted.

### S25 Integration Hub - Navigate Back To Workflow Runs

Given a PM is inspecting an Integration Hub execution request
When they click `Open workflow run`
Then Project Manager navigates to Workflow Runs with the related work item,
workflow run id, and node id context available to the callback
And it does not approve, run, spawn, record handoff, or mutate the package.

Given a PM is inspecting an Integration Hub execution record
When they click `Open workflow run`
Then Project Manager navigates to Workflow Runs with the related work item,
workflow run id, and node id context available to the callback
And it does not expose a runtime execution control.

Given an execution request payload is missing optional policy gate fields
When the detail sheet renders
Then the detail sheet does not crash
And unavailable gate state is omitted instead of blocking navigation.

### S26 Workflow Runs - Select Run And Node From Deep Link

Given Workflow Runs opens with `workflowRunId` and `nodeId` query params
When Project Manager renders initial or loaded Project Workflow sidecars
Then it selects the matching run by id
And it selects the matching node in the inspector.

Given Workflow Runs opens without a matching `workflowRunId`
But with a matching `workItemId`
When Project Manager renders Project Workflow sidecars
Then it selects the matching work item run.

Given no query param matches any run
When Workflow Runs renders
Then it falls back to the existing first-run selection behavior.

### S27 Workflow Runs - Open Execution Records From Evidence

Given a Workflow Runs node inspector has linked execution record evidence
When the PM clicks `Open execution record`
Then Project Manager navigates to `/integrations-hub/workflow-execution-records`
And it does not run a dry-run executor, record a handoff, approve a package, or
spawn any external actor/tool.

Given no execution record sidecar exists for the selected draft
When the PM views execution evidence
Then the execution record navigation action is not shown.

### S28 Integration Hub - Select Request Or Record Row From Deep Link

Given Integrations Hub opens an execution records sheet with `recordId`
When rows are loaded
Then the row with matching `sourceId` is selected for detail inspection.

Given Integrations Hub opens with `requestId`, `sourceId`, or `rowKey`
When rows are loaded
Then the matching request/record row is selected.

Given no row matches the deep link
When the sheet renders
Then no detail sheet is opened and no row action is executed.

### S29 Integration Hub - Navigate From Record To Source Request

Given a PM is inspecting an Integration Hub execution record with `requestId`
When they click `Open execution request`
Then Project Manager navigates to
`/integrations-hub/workflow-execution-requests?requestId=<request-id>`
And it does not approve, run, record a handoff, spawn, or mutate either sidecar.

Given an execution record has no `requestId`
When the detail inspector renders
Then the source request navigation action is not shown.

### S30 Integration Hub - Refresh Deep Link After Client-Side Navigation

Given a PM opens an execution record detail with `recordId`
And then navigates inside Integration Hub to execution requests with
`requestId`
When the execution request rows load
Then the source request detail opens in the same mounted Integration Hub session
And the stale `recordId` query is not reused for request row selection.

### S31 Policy - Live Executor Requires Explicit Live Opt-In

Given an execution request is `approved_for_executor`
And the resolved executor command is still `dry_run_only`
When the live executor runner evaluates the request
Then it returns `blocked_by_policy`
And the live runner adapter is not called
And the reason says a dry-run-only request cannot be spawned as a live command.

Given an execution request is `approved_for_executor`
And the resolved executor command is `live_command_allowed`
When the live executor runner evaluates the request
Then it calls the live runner adapter with the resolved command, args, command
preview, request package, and working directory
And it records `live_spawned` with runner state `spawned`, working directory,
`pid`, and `spawnToken`.

### S32 Integration Hub - Configure And Run Live Executor

Given a PM opens a command mapping detail sheet
When they select `Live command allowed`, enter executor command metadata, and
save
Then Project Manager persists `executor.executionState:
live_command_allowed`
And dry-run-only remains the default when no live mode is selected.

Given a PM opens an approved execution request with `live_command_allowed`
When the detail inspector renders
Then it shows `Run live executor`
And clicking it writes a live spawn record only through the guarded runner path.

Given the same live action is clicked in browser/Next dev mode
When the Tauri runtime is unavailable
Then the UI shows a controlled Tauri-runtime-required error
And no browser fallback process is recorded.

### S33 Integration Hub - Inspect Live Spawn Evidence

Given a live executor record exists with runner state `spawned`
When the PM opens the Execution Records detail sheet
Then it shows `live_spawned`, `spawned`, `pid`, `spawnToken`, policy reason,
working directory, command preview, and safety notice
And no additional runtime execution control is shown from the record detail.

## Red / Green / Refactor

1. Write the failing unit or component test.
2. Run the focused test and capture the expected failure.
3. Implement the smallest code path.
4. Re-run the focused test.
5. Refactor only after green.
6. Update `dev-log.md` with test results and decisions.
