# F54 Test Scenarios

## Normal

- Start a ready human node in manual-only mode and create a manual execution
  draft.
- Start a safe agent/tool node in auto-safe mode and create an auto-eligible
  draft without running a real actor.
- Switch the whole workflow run to auto-safe mode, start a node, then request
  the draft run and see `run_requested` plus `pending_external_executor`.
- Start an auto-safe eligible Analysis node and see `run_requested`,
  `Auto Run Policy`, and `pending_external_executor` without pressing
  `Run draft`.
- Inspect a known tool draft and see its Integration Hub executor candidate
  without executing it.
- Request a draft run and confirm a dry-run execution request package is
  written under `.project-manager/project-workflow-execution-requests/` with
  `review_required`.
- Open Integrations Hub `Execution Requests` and confirm the package queue row
  is visible without any real executor controls.
- Select an Execution Requests row and confirm the detail inspector shows
  review status, policy gate reason, command preview, prompt labels, memory
  files, allowed tools, handoff, evidence, and safety notice.
- Approve an execution request package and confirm it records
  `approved_for_executor`, approver, and approval time without executing.
- Click `Approve for executor` in the Execution Requests detail inspector and
  confirm the saved package JSON changes while the command remains dry-run only.
- Ask the executor consumption policy to evaluate approved and unapproved
  packages and confirm only approved, resolved dry-run packages return `ready`.
- Open review-required and approved execution request rows and confirm the
  detail inspector shows the same blocked/ready executor gate decision.
- Build dry-run executor handoff records for ready and blocked packages and
  confirm they preserve policy evidence without executing commands.
- Click `Record executor handoff` in an Execution Request detail inspector and
  confirm a record sidecar is written under
  `.project-manager/project-workflow-execution-records/`.
- Open Integrations Hub `Execution Records` and confirm handoff audit rows show
  policy state, command preview when present, consumer, timestamp, and safety
  notice without runtime controls.
- Click `Run dry-run executor` in an approved Execution Request detail
  inspector and confirm a `dry_run_completed` result record is written with
  runner state, exit code, stdout preview, and no spawned process.
- Confirm approved dry-run execution requests flow through the runner adapter
  contract before result records are built.
- Resolve a cross-discipline draft capability from a supplied Integration Hub
  executor registry and confirm software-only defaults are not the product
  boundary.
- Build a Project Workflow executor registry from command mappings that carry
  executor metadata, then resolve a matching workflow draft from that registry.
- Open a command mapping detail sheet, fill executor metadata, save it, and
  confirm the metadata persists as structured command/args/capability data.
- Start an auto-safe Workflow Runs node with command mapping executor metadata
  configured and confirm execution request persistence receives the generated
  Integration Hub registry.
- Open Workflow Runs with command mapping executor metadata configured for an
  agent draft and confirm the node inspector shows the Integration Hub label and
  command preview.
- Confirm adding a command mapping executor candidate does not remove the
  built-in software verification dry-run candidate from Workflow Runs.
- Open Workflow Runs with a `run_requested` draft, click
  `Review execution request`, and confirm the app navigates to
  `/integrations-hub/workflow-execution-requests`.
- Open Workflow Runs with a requested draft whose executor candidate is
  unresolved, click `Configure executor`, and confirm the app navigates to
  `/integrations-hub/commands`.
- Open Workflow Runs with an approved execution request and dry-run execution
  record sidecar and confirm the node inspector shows `Execution Evidence`,
  `approved_for_executor`, `dry_run_completed`, and the runner exit summary.
- Open an Integration Hub execution request detail sheet, click
  `Open workflow run`, and confirm navigation is delegated without approving or
  running the request.
- Open an Integration Hub execution record detail sheet, click
  `Open workflow run`, and confirm navigation is delegated without exposing a
  runtime execution control.
- Open Workflow Runs with `workItemId=F54`, `workflowRunId=<run>`, and
  `nodeId=verification`, and confirm the graph selects the F54 run plus
  Verification node inspector.
- Open Workflow Runs with dry-run execution record evidence, click
  `Open execution record`, and confirm navigation goes to
  `/integrations-hub/workflow-execution-records?recordId=<record>` without
  executing anything.
- Open Integrations Hub with `recordId`, `requestId`, `sourceId`, or `rowKey`
  and confirm the matching execution request/record row is selected when rows
  are loaded.

## Boundary

- Paused run blocks start.
- Unknown node id throws a clear error.
- Node over max attempts blocks through stop policy.

## Error

- Missing workflow sidecar save permission reports a visible error in the UI.
- Malformed legacy sidecar without draft fields still renders safely.
- Draft run request for a blocked or approval-required draft records a blocked
  event rather than executing.

## Permission / Safety

- High-risk nodes never auto-run.
- Nodes blocked by approval gates show approval-required draft status.
- Real command/agent execution remains out of scope for this slice.
- Unknown capability ids show `unresolved` executor policy instead of guessing
  a command.
- Execution request packages are dry-run handoff artifacts only; the future
  Integration Hub executor must still require `approved_for_executor` and
  perform its own policy checks before real execution.
- Integrations Hub may inspect queue packages but must not enable or execute
  them in this slice.
- `Run dry-run executor` must remain simulated: it can write result records but
  must not call `spawnAgent`, `spawnTerminal`, or any shell process.
- Blocked dry-run execution requests must not call the runner adapter.
- Detail inspectors for execution request rows must remain read-only and must
  not include a terminal/runtime `Run` button.
- Detail inspectors for execution record rows must remain read-only audit views
  and must not include a terminal/runtime `Run` button.
- Future executor runners must call the consumption policy and reject
  `review_required` or unresolved packages before attempting execution.
- Unknown capabilities must stay unresolved unless supplied by an explicit
  executor registry entry.
- Disabled or incomplete command mapping executor metadata must not enter the
  executor registry.
- Empty executor metadata fields must not break existing command mapping
  trigger/action/description editing.
- Workflow Runs must not pass an empty executor registry when no command mapping
  executor metadata is configured.
- Workflow Runs visual registry must merge built-in candidates with Integration
  Hub command mapping candidates, not replace the built-ins.
- Workflow Runs `Review execution request` navigation must not approve or run
  the package; approval and dry-run execution stay in Integration Hub.
- Workflow Runs `Configure executor` navigation must not create or execute a
  command; command mapping edits stay in the Commands sheet.
- Workflow Runs execution evidence is read-only feedback from Integration Hub
  sidecars; it must not approve packages, record handoffs, run dry-runs, spawn
  processes, or write request/record files.
- Integration Hub `Open workflow run` navigation must remain read-only and must
  not approve, record, run, spawn, or create commands.
- Workflow Runs query-param selection must remain read-only and must not start
  nodes, request drafts, approve packages, or run commands.
- Workflow Runs `Open execution record` must remain read-only and must not
  record handoffs, run dry-runs, approve packages, spawn processes, or create
  commands.
- Integration Hub row deep links must select rows only; they must not approve,
  record handoffs, run dry-runs, spawn processes, or create commands.
