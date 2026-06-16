# F54 Feature Spec - Workflow Execution Drafts & Run-Level Auto Mode

## Problem Definition

F53 visualizes Project Workflow runs but still stops at review-first graph
inspection. PMs need a safe next step: start a node, inspect the exact
agent/tool execution draft, and decide whether to run it manually or allow
safe nodes to proceed under a run-level auto-run policy.

The product must avoid two failure modes:

- turning the graph into decorative status only, with no execution control;
- letting a button silently launch arbitrary agents, shell commands, PRs,
  pushes, deploys, or external writes.

## In Scope

- Add run-level execution modes:
  - `manual_only`
  - `auto_safe_nodes`
  - `paused`
- Add execution draft state to Project Workflow runs.
- `Start node` creates an execution draft for ready nodes.
- Drafts include actor/tool preview, prompt labels, memory files, expected
  handoff, expected evidence, risk level, execution mode, and eligibility
  reason.
- High-risk nodes and nodes blocked by approval gates must never auto-run.
- Paused runs cannot start nodes or auto-run drafts.
- Workflow Runs UI shows mode controls, `Start node`, draft preview, run
  eligibility, and clear blocked reasons.
- `Run draft` records an auditable run request and pending external executor
  result without launching real actors/tools.
- In `auto_safe_nodes` mode, starting an eligible low-risk agent/tool node
  records the draft run request automatically under `Auto Run Policy`.
- Persist updated run sidecars after mode changes, node starts, and draft run
  requests.
- Add a dry-run executor resolver that maps draft `capabilityId` values to
  Integration Hub-owned executor candidates.
- Show the resolved executor candidate in the Workflow Runs draft inspector
  when one exists.
- Build and persist a dry-run execution request package for each
  `run_requested` draft under
  `.project-manager/project-workflow-execution-requests/`.
- Include executor resolution, command preview when available, prompt labels,
  memory files, allowed tools, expected handoff, and expected evidence in each
  request package.
- Default each execution request package to `review_required` with an explicit
  policy gate reason before any future executor may consume it.
- Provide a pure approval transition to `approved_for_executor` that records
  approver and approval time without executing the package.
- Add an Integrations Hub `Execution Requests` sheet that loads those packages
  as dry-run queue rows.
- Add a read-only detail inspector for execution request rows that surfaces the
  package payload: command preview, system/task prompt labels, memory files,
  allowed tools, handoff, evidence, requester, request time, capability id,
  review status, policy gate reason, and safety notice.
- Add an explicit `Approve for executor` control for review-required packages
  that writes `approved_for_executor`, approver, and approval time back to the
  package without executing it.
- Add a pure executor consumption policy helper that future runners must call
  before consuming a package; it blocks unapproved packages and unresolved
  executor candidates.
- Surface the executor consumption policy decision in the Execution Request
  detail inspector so PMs can see why a package is blocked or ready.
- Build dry-run executor handoff records that capture future runner consumption
  attempts as `ready_for_executor` or `blocked_by_policy` evidence without
  executing commands.
- Persist dry-run executor handoff records under
  `.project-manager/project-workflow-execution-records/`.
- Add an Integrations Hub `Execution Records` sheet that loads handoff records
  as audit rows.
- Add a `Record executor handoff` control in the Execution Request detail
  inspector that writes a handoff record without running commands or agents.
- Add a guarded `Run dry-run executor` control that evaluates the same policy
  gate and writes a `dry_run_completed` or `blocked_by_policy` result record
  without spawning a process.
- Route guarded dry-run executor results through a runner adapter contract so
  the UI never hand-builds execution output and future real runners can replace
  the adapter behind the same policy gate.
- Allow the Project Workflow executor resolver to consume an injected executor
  registry so future Integration Hub command/tool inventories can resolve
  cross-discipline capabilities without hard-coding every vertical in workflow
  code.
- Add optional executor metadata to Integration Hub command mappings and a pure
  mapper that turns enabled command mappings into Project Workflow executor
  registry entries.
- Add command mapping detail controls for editing dry-run executor metadata:
  capability id, command, args, command preview, label, and safety notice.
- Add an explicit command mapping execution mode control so executor metadata
  defaults to `dry_run_only` and can only become `live_command_allowed` through
  an intentional PM opt-in.
- Wire the command-mapping executor registry into Workflow Runs persistence so
  auto-requested drafts can produce execution request sidecars resolved from
  Integration Hub command metadata.
- Wire the same combined executor registry into the Workflow Runs graph
  inspector so the visual companion shows the agent/tool candidate from
  Integration Hub without dropping built-in dry-run candidates.
- Add a direct Workflow Runs inspector action that opens the Integration Hub
  `Execution Requests` review queue after a draft reaches `run_requested`.
- When a linked execution request sidecar is known, include `requestId` in that
  navigation so Integration Hub can select the exact request row automatically.
- Add a direct Workflow Runs inspector action that opens Integration Hub
  `Commands` when a draft has no resolved executor candidate, so PMs can assign
  or configure the missing agent/tool command mapping.
- Surface execution request review state and execution record runner evidence
  back in the Workflow Runs node inspector by reading Integration Hub request
  and record sidecars.
- Add read-only navigation from Integration Hub execution request and execution
  record detail sheets back to Workflow Runs so PMs can inspect the related
  run/node context.
- Support Workflow Runs deep-link selection using `workItemId`,
  `workflowRunId`, and `nodeId` query params.
- Add read-only navigation from Workflow Runs execution evidence to the
  Integration Hub `Execution Records` sheet when record evidence exists.
- Support Integration Hub row selection deep links for execution request/record
  rows via `recordId`, `requestId`, `sourceId`, or `rowKey`.
- Add read-only navigation from Integration Hub `Execution Records` details
  back to the source `Execution Requests` row when `requestId` is present.
- Keep Integration Hub row deep-link selection in sync after client-side
  navigation changes the sheet/query, not only on first page load.
- Add a guarded live executor runner path that only spawns a process when an
  execution request is `approved_for_executor`, has a resolved command, and its
  executor metadata explicitly says `live_command_allowed`.
- Keep browser/Next dev mode dry-run only: live executor spawn attempts must be
  blocked with a visible Tauri-runtime-required message instead of falling back
  to a browser mock process.
- Persist live spawn attempts as execution records with `live_spawned`,
  `spawned`, working directory, `pid`, `spawnToken`, policy decision, command
  preview, and safety notice so process evidence stays outside the chat
  transcript.

## Out of Scope

- Ungated arbitrary shell execution.
- Browser-mode command execution fallback.
- Real AI agent spawn.
- Real Integration Hub tool execution.
- PR creation, push, merge, deploy, file deletion, or external API writes.
- Per-node auto-run toggles.
- Drag/drop workflow template editing.

## User Value

- PMs can start workflow nodes without losing auditability.
- Leads can inspect exactly what an agent/tool would do before execution.
- Safe low-risk nodes can eventually auto-run under one run-level policy.
- High-risk actions stay human-gated.

## Success Metrics

- A ready node can be started from the graph and produces one execution draft.
- The run-level execution mode can be changed from the graph UI and is audited.
- A draft run can be requested from the graph UI and records `run_requested`
  plus `pending_external_executor`.
- In auto-safe mode, an eligible draft reaches `run_requested` after `Start node`
  without requiring the human to click `Run draft`.
- A draft with a known capability id resolves to an Integration Hub executor
  candidate with sheet/source metadata and a dry-run command preview.
- A requested draft produces a durable dry-run execution request sidecar that a
  future Integration Hub executor can consume without relying on chat history.
- Integrations Hub shows requested draft packages as `pending_external_executor`
  rows with `review_required` plus dry-run status badges and no executable
  toggle.
- The Integrations Hub row detail inspector makes the request payload readable
  without exposing a `Run` or terminal execution control.
- Execution request packages cannot be consumed by a future executor until they
  pass the explicit review gate.
- Approving a request in Integrations Hub updates the package and UI state but
  still leaves execution to a future executor runner.
- A future executor can only receive a `ready` decision for an approved,
  resolved, dry-run request package.
- The detail inspector shows the same blocked/ready policy decision that a
  future executor runner would receive.
- A future executor handoff attempt can be recorded as evidence even when
  policy blocks consumption.
- Integrations Hub shows handoff records as `Execution Records` audit rows with
  policy state, command preview when present, consumer, timestamp, and safety
  notice.
- Clicking `Record executor handoff` creates an audit record but does not expose
  a terminal/runtime `Run` control.
- Clicking `Run dry-run executor` creates a result audit record with policy
  decision, runner state, exit code for simulated success, stdout/stderr
  previews, and a non-execution safety notice.
- Dry-run runner output is produced through the shared runner adapter entrypoint;
  blocked packages do not call the adapter, and approved packages pass the
  command package plus command preview into the adapter before a result record is
  built.
- Resolver tests prove the default software verification command still works
  while a supplied registry can resolve a non-software capability such as
  construction QA inspection tooling.
- Command mapping registry tests prove Integration Hub command metadata can feed
  the Project Workflow resolver, while disabled or incomplete mappings are
  ignored.
- A PM can edit executor metadata from a command mapping detail sheet and save
  the structured metadata back into the command mapping catalog.
- A PM can explicitly mark a command mapping executor as `live_command_allowed`;
  mappings remain `dry_run_only` unless that mode is selected.
- Workflow Runs persistence passes a non-empty Integration Hub command registry
  into execution request package generation, while preserving the existing
  two-argument package save path when no registry is configured.
- Workflow Runs graph/inspector resolves executor candidates from the combined
  built-in + Integration Hub command mapping registry, so users can see which
  agent/tool command a draft is prepared to hand off to.
- A requested execution draft exposes a review navigation action that takes the
  PM to the Integration Hub execution request queue without executing anything.
- A requested execution draft with linked request evidence opens Integration
  Hub with `requestId` so the exact execution request row can be inspected
  without manual searching.
- An unresolved executor candidate exposes a configure navigation action that
  takes the PM to Integration Hub command mappings without creating or running a
  command.
- A PM inspecting a requested draft can see the linked execution request review
  state and dry-run execution record result from Integration Hub without
  leaving the graph.
- A PM inspecting an Integration Hub execution request or record can return to
  Workflow Runs without approving, running, spawning, or mutating the package.
- A PM opening Workflow Runs with request/record deep-link params lands on the
  matching workflow run and node inspector when matching sidecars are loaded.
- A PM viewing dry-run record evidence in Workflow Runs can open the
  Integration Hub Execution Records sheet without executing or mutating the
  record.
- A PM opening an Integration Hub execution sheet with a row deep link lands on
  the linked request/record detail when the row is loaded.
- A PM inspecting an execution record can open the source execution request row
  without running, approving, or mutating either sidecar.
- A PM can navigate from an execution record detail to the source request detail
  in the same mounted Integration Hub session, and the new `requestId` query is
  used for row selection.
- A PM can click `Run live executor` only for approved, resolved,
  `live_command_allowed` requests; approved `dry_run_only` requests are blocked
  by policy before any spawn adapter is called.
- In Tauri runtime, a live executor run records `live_spawned` with the returned
  working directory, `pid`, and `spawnToken`; in browser dev mode the same
  action shows a controlled Tauri-runtime-required error and creates no fake
  process.
- Execution record details show live spawn evidence including runner state,
  working directory, `pid`, and `spawnToken`.
- A paused run blocks `Start node` with a visible reason.
- Auto-run eligibility is visible at node/draft level but controlled at run level.
- High-risk nodes produce manual/approval-required drafts, never auto-run drafts.
- Focused unit and component tests cover normal, boundary, blocked, and policy
  cases.

## Dependencies

- F52 Project Workflow engine and run sidecar store.
- F53 Workflow Runs graph and inspector UI.
- Integration Hub row/source vocabulary in `lib/integrations/types.ts`.
- Future Integration Hub command/tool policy for real execution.
- Future executor queue consumer that reads execution request packages and runs
  approved commands/tools.

## Constraints

- No renderer-side raw Tauri `invoke`.
- No automatic external side effects in this slice; live command spawn requires
  explicit human approval plus a second explicit `Run live executor` action.
- No schemaVersion bump unless canonical `.project-manager/config.json` shape
  changes incompatibly.
- UI remains workstation-style and dense; no landing-page pattern.
- Workflow Runs visual registry must combine Integration Hub mappings with
  built-in dry-run candidates instead of replacing the built-in registry.
- Workflow Runs review navigation must only appear for `run_requested` drafts
  and must not approve, run, spawn, or mutate the request package by itself.
- Workflow Runs configure navigation must only guide the PM to Integration Hub;
  command mapping creation and executor metadata editing remain owned by the
  Commands sheet.
- Workflow Runs execution evidence display is read-only; approvals, handoff
  recording, and dry-run execution remain owned by Integration Hub detail
  sheets.
- Integration Hub `Open workflow run` navigation is read-only and must not
  trigger approval, handoff recording, dry-run execution, or command creation.
- Workflow Runs deep-link selection is read-only; it must only select run/node
  context and never start nodes, request drafts, approve packages, or execute
  commands.
- Workflow Runs `Open execution record` navigation is read-only and must not
  record handoffs, run dry-runs, approve packages, or create commands.
- Integration Hub row deep-link selection is read-only and must not trigger row
  actions, command execution, dry-run execution, handoff recording, or package
  approval.
- Live command execution remains Tauri-only and must route through the typed
  bridge `spawnAgent()` wrapper; browser mode must never substitute a successful
  fake spawn.
- Live execution policy must reject `dry_run_only` requests even when approved.
