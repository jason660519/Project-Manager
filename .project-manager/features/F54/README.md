# F54 - Workflow Execution Drafts & Run-Level Auto Mode

F54 turns the F53 Workflow Runs graph from a review-only console into a guarded
execution-control surface. Starting a node creates an auditable execution draft
that previews the assigned actor/tool, prompt scope, memory scope, expected
handoff, evidence output, risk, and run-level auto-run eligibility.

## Goal

- Add run-level execution mode: manual-only, auto-run safe nodes, or paused.
- Let PMs start a ready node from the graph.
- Create an execution draft immediately after start.
- Let PMs request a draft run from the UI without typing slash commands.
- Keep high-risk and unapproved work blocked from auto-run.
- Persist execution mode, drafts, events, and dry-run execution request packages
  in Project Workflow sidecars.

## First Slice

- No real shell, agent, PR, push, deploy, or external tool execution.
- `Start node` updates workflow state and creates an execution draft.
- `Run draft` records a `run_requested` lifecycle state and
  `pending_external_executor` result; it does not execute a real actor/tool.
- In `auto_safe_nodes` mode, starting an eligible agent/tool node immediately
  records the draft run request under `Auto Run Policy`.
- Known draft capability ids resolve to Integration Hub executor candidates
  that show sheet/source metadata and a dry-run command preview.
- Requested drafts are exported to
  `.project-manager/project-workflow-execution-requests/` as dry-run packages
  for future Integration Hub executors.
- Integrations Hub exposes those packages in the `Execution Requests` sheet so
  PMs can inspect the pending queue outside Workflow Runs.
- Selecting an Execution Requests row opens a read-only package inspector with
  command preview, prompt labels, memory files, allowed tools, handoff,
  evidence, requester, and safety notice.
- Execution request packages default to `review_required`; a separate approval
  helper can mark them `approved_for_executor` for a future runner without
  executing anything.
- The Execution Request detail inspector includes an `Approve for executor`
  action that writes the approved package back to disk while preserving
  `dry_run_only`.
- Executor consumption has a pure policy helper that blocks unapproved packages
  and unresolved executor candidates before any future runner can consume them.
- The Execution Request detail inspector shows the future executor gate decision
  (`blocked` or `ready`) and the policy reason.
- Future executor handoff attempts can be represented as dry-run handoff records
  (`ready_for_executor` or `blocked_by_policy`) without executing commands.
- Handoff records persist under
  `.project-manager/project-workflow-execution-records/` and appear in the
  Integrations Hub `Execution Records` sheet as audit evidence.
- The Execution Request detail inspector includes a `Record executor handoff`
  action that writes a dry-run handoff record without executing commands or
  agents.
- The Execution Request detail inspector includes a guarded
  `Run dry-run executor` action that writes a `dry_run_completed` or
  `blocked_by_policy` result record without spawning a process.
- Dry-run executor results now flow through a runner adapter contract; approved
  requests call the adapter, while blocked packages are rejected before the
  adapter boundary.
- The executor resolver now accepts an injected registry, so future Integration
  Hub command/tool inventories can resolve cross-discipline capabilities without
  hard-coding the workflow engine to software-only commands.
- Command mappings can now carry optional dry-run executor metadata and be
  converted into a Project Workflow executor registry for future resolver use.
- Command mapping details now expose editor fields for dry-run executor
  capability, command, args, preview, label, and safety notice.
- Workflow Runs now pass non-empty command mapping executor registries into
  execution request package generation, so sidecars can resolve capabilities
  from Integration Hub metadata.
- Workflow Runs graph/inspector now uses a combined built-in + Integration Hub
  executor registry, so visual nodes show the configured agent/tool command
  candidate without losing built-in dry-run candidates.
- Requested drafts now expose `Review execution request`, which takes the PM
  directly from Workflow Runs to the Integration Hub `Execution Requests` queue.
- Unresolved executor candidates now expose `Configure executor`, which takes
  the PM to Integration Hub `Commands` to assign or edit command mapping
  executor metadata.
- Workflow Runs node inspector now reads Integration Hub execution request and
  record sidecars so the PM can see review approval and dry-run result evidence
  without leaving the graph.
- Integration Hub execution request and record detail sheets now include
  read-only `Open workflow run` navigation back to Workflow Runs, closing the
  request/record -> graph inspection loop.
- Workflow Runs now honors `workItemId`, `workflowRunId`, and `nodeId`
  deep-link params so Integration Hub can return the PM to the related run/node
  context.
- Workflow Runs execution evidence now includes a read-only
  `Open execution record` action when dry-run result evidence exists.
- `Open execution record` now carries `recordId`, and Integrations Hub can
  select linked request/record rows from `recordId`, `requestId`, `sourceId`, or
  `rowKey` query params.
- Auto-run is decided at run level, then constrained by node risk, runtime hint,
  approval gates, and Integration Hub readiness.

## Files

- `.project-manager/features/F54/feature-spec.md`
- `.project-manager/features/F54/tdd-spec.md`
- `.project-manager/features/F54/test-scenarios.md`
- `.project-manager/features/F54/implementation-plan.md`
- `.project-manager/features/F54/dev-log.md`
- `lib/project-workflows/projectWorkflowExecutionPackageStore.ts`
- `lib/project-workflows/projectWorkflowExecutionResolver.ts`
- `lib/integrations/load-project-inventory.ts`
- `lib/integrations/mappers/channels.ts`
- `lib/types/channels.ts`
- `app/ui/views/Plugins/_shared/CommandMappingEditForm.tsx`
- `__tests__/projectWorkflowExecutionPackageStore.test.ts`
- `__tests__/integrations.workflowExecutionRequests.test.ts`
- `__tests__/integrations.commandMappingExecutorRegistry.test.ts`
- `__tests__/integrations.executionRequestDetailSheet.test.tsx`
