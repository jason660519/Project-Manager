# F35 Dev Log - Agent Workflow DAG Control Plane

## 2026-05-28 - Kickoff and design slice

### Context

User requested implementation of the proposed multi-agent architecture after first registering the work in Project Dashboard > Development sheet and creating feature artifacts. The key architectural constraint is that every agent must have an isolated ChatSession store to avoid memory pollution.

### Planned Work

1. Add F35 to `.project-manager/config.json`.
2. Create feature artifacts: README, feature spec, TDD spec, test scenarios, dev log.
3. Add ADR-013 for the workflow DAG control plane.
4. Add pure TypeScript workflow DAG definitions and session-scope helpers.
5. Add focused unit tests before wiring runtime execution.

### Design Decision

CubeSandbox is treated as a future `WorkerRuntimeAdapter` provider. The first implementation defines Project Manager's own workflow control-plane contracts so local/xmux and CubeSandbox workers can later share the same DAG model.

### Verification Log

- `npm run test -- --run __tests__/agentWorkflowDag.test.ts __tests__/agentWorkflows.test.ts` - pass, 2 files / 15 tests.
- `npm run typecheck` - pass after changing workflow retry policy to a readonly array contract.
- `npm run docs:site:sync` - pass, synced 71 internal-preview docs and 7 public docs.
- `npm run docs:check` - pass.
- `npm run docs:site:check` - pass.
- `npm run standards:check` - exit 0 with existing P2 hard-coded color warning outside this feature slice.
- `npm run build` - pass. Turbopack reported pre-existing broad dynamic filesystem tracing warnings in `app/api/chat/tools/file/route.ts`.

### Implemented

- Added F35 to `.project-manager/config.json` so the Development sheet can surface this work and artifact links.
- Added `docs/architecture/ADR-013-agent-workflow-dag-control-plane.md`.
- Added `lib/agent-workflows/dagTypes.ts`, `dagDefinitions.ts`, and `sessionScope.ts`.
- Added built-in `software-dev-parallel` and `deep-research-parallel` workflow DAG templates.
- Added session isolation helpers keyed by `projectId + workflowId + workflowRunId + nodeId + agentId`.
- Added `__tests__/agentWorkflowDag.test.ts` covering catalog shape, validation errors, declarative tool refs, and session key isolation.

### Current Progress

- F35 progress set to 40%.
- Complete: control-plane contracts, built-in DAG templates, session namespace helpers, docs, and focused tests.
- Remaining: runtime adapter interface implementation, Dispatch template UI integration, tool candidate resolver, and live session persistence wiring.

## 2026-05-28 - Specification upgrade for shared vocabulary and console usage

### User feedback

The first F35 slice was too implementation-heavy. It defined DAG types and tests but did not explain enough product vocabulary or user operation:

- Coordinator, AI Engineers, Workers, Workflow, Memory, Session, Runtime Adapter, Harness, Checkpoint, and related terms were not clearly defined.
- AI Assistants Control Console behavior was not explained as an operator surface.
- Edit Engineer Role field names were not mapped to Worker creation behavior.
- Dispatch flow diagrams were missing.

### Changes

- Expanded `feature-spec.md` into a product + engineering control-plane spec.
- Added glossary, control-plane flow, Software Development flow, Deep Research flow, memory/session isolation flow, and Edit Engineer Role vocabulary.
- Expanded `test-scenarios.md` into product-level journeys and scenario matrix.
- Expanded `tdd-spec.md` with documentation/vocabulary contract and future WorkflowRun state-machine cases.
- Added user-facing guides:
  - `docs/guides/features/ai-assistants-control-console.md`
  - `docs/guides/features/agent-workflows.md`

### Verification

- `npm run docs:site:sync` - pass, synced 76 internal-preview docs and 9 public docs.
- `npm run docs:check` - pass.
- `npm run docs:site:check` - pass.
- `npm run test -- --run __tests__/agentWorkflowDag.test.ts __tests__/agentWorkflows.test.ts` - pass, 2 files / 15 tests.
- `npm run standards:check` - exit 0 with existing P2 hard-coded color advisory outside this feature slice.
- `npm run typecheck` - pass.

## 2026-05-28 - WorkflowRun state model and Dispatch template picker

### Context

User confirmed colleague committed and pushed the prior work, then requested the next F35 implementation slice: move from specification into an operable flow by adding WorkflowRun / WorkflowNodeRun state model and Dispatch template picker.

### Changes

- Added `AgentWorkflowRun`, `AgentWorkflowNodeRun`, node-run status, run status, artifact record, and node error-kind types.
- Added WorkflowRun helpers:
  - `createAgentWorkflowRun`
  - `listReadyWorkflowNodeRuns`
  - `startWorkflowNodeRun`
  - `completeWorkflowNodeRun`
  - `failWorkflowNodeRun`
  - `buildAgentWorkflowRunPrompt`
- Added DAG workflow template picker to Task Dispatch and Batch Dispatch.
- Kept legacy single-agent `DEFAULT_AGENT_WORKFLOWS` selector separate from new multi-agent DAG templates.
- Extended `FeaturePromptConfig` with optional `workflowTemplateId` and `workflowRunId`.
- Added regression tests for WorkflowRun initialization, dependency unblocking, retry budget blocking, WorkflowRun prompt content, and Dispatch DAG picker rendering.

### Verification

- `npm run test -- --run __tests__/agentWorkflowDag.test.ts __tests__/dispatch.component.render.test.tsx __tests__/dispatch.error-states.test.tsx __tests__/dispatch.kill-confirm.test.tsx __tests__/BatchDispatchModal.state.test.tsx` - pass, 5 files / 47 tests.
- `npm run docs:site:sync` - pass, synced 76 internal-preview docs and 9 public docs.
- `npm run docs:check` - pass.
- `npm run docs:site:check` - pass.
- `npm run standards:check` - exit 0 with existing P2 hard-coded color advisory outside this feature slice.
- `npm run typecheck` - pass.
- `npm run build` - pass.

## 2026-05-28 - WorkflowRun sidecar persistence

### Context

After the state model and Dispatch picker landed, the next gap was persistence. Storing run history directly in `.project-manager/config.json` would bloat feature metadata and require a schema decision too early, so this slice uses file-backed sidecars.

### Changes

- Added `lib/agent-workflows/runStore.ts`.
- Added sidecar path helpers:
  - `workflowRunsDirectory`
  - `workflowRunPath`
- Added persistence helpers:
  - `serializeAgentWorkflowRun`
  - `parseAgentWorkflowRun`
  - `saveAgentWorkflowRun`
  - `readAgentWorkflowRun`
  - `listAgentWorkflowRuns`
- Task Dispatch now saves the initialized WorkflowRun before launching a selected DAG template.
- Batch Dispatch saves one WorkflowRun sidecar per selected feature before launching.
- Sidecars live under `.project-manager/workflow-runs/<runId>.json`.

### Verification

- `npm run test -- --run __tests__/agentWorkflowDag.test.ts __tests__/dispatch.component.render.test.tsx __tests__/dispatch.error-states.test.tsx __tests__/dispatch.kill-confirm.test.tsx __tests__/BatchDispatchModal.state.test.tsx` - pass, 5 files / 50 tests.
- `npm run docs:site:sync` - pass, synced 76 internal-preview docs and 9 public docs.
- `npm run docs:check` - pass.
- `npm run docs:site:check` - pass.
- `npm run standards:check` - exit 0 with existing P2 hard-coded color advisory outside this feature slice.
- `npm run typecheck` - pass.
- `npm run build` - pass.

## 2026-05-28 - AI Assistants Workflow Runs sheet

### Context

After Dispatch began saving WorkflowRun sidecars, the next required control-plane step was visibility. Operators need to inspect the run and worker node state before runtime retry/resume controls are implemented.

### Changes

- Added `workflow-runs` to AI Assistants Control Console sheet routing.
- Passed selected project root from `MainClient` into the Console.
- Added Workflow Runs sheet that loads `.project-manager/workflow-runs/*.json` through `listAgentWorkflowRuns`.
- Added run-level metrics for total, active, ready-node, completed, and blocked counts.
- Added selected-run detail with node status, dependencies, attempts, runtime provider, isolated session scope, and artifacts.
- Added component coverage for rendering a persisted WorkflowRun and per-node session scope.

### Verification

- `npm run test -- --run __tests__/ai-assistants.console.test.tsx __tests__/agentWorkflowDag.test.ts` - pass, 2 files / 25 tests.
- `npm run typecheck` - pass.
