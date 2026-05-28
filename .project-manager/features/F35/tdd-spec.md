# F35 TDD Specification

## Suite A: DAG catalog (`agentWorkflowDag.test.ts`)

1. Built-in catalog contains `software-dev-parallel` and `deep-research-parallel`.
2. Each built-in workflow has a stable version, title, trigger, and at least one terminal summarizer/report node.
3. Software Development includes planner, implementer, reviewer, tester, and summarizer roles.
4. Deep Research includes researcher, writer, and summarizer roles.

## Suite B: DAG validation

| Case | Input | Expected |
| --- | --- | --- |
| B1 | Built-in Software Development workflow | Valid |
| B2 | Built-in Deep Research workflow | Valid |
| B3 | Duplicate node ID | Error includes `duplicate_node_id` |
| B4 | Edge points to missing node | Error includes `dangling_edge` |
| B5 | Cycle A -> B -> A | Error includes `cycle_detected` |
| B6 | Node depends on missing ID | Error includes `dangling_dependency` |

## Suite C: Session isolation

1. `buildAgentSessionScope()` preserves project, workflow, run, node, and agent identity.
2. `agentSessionStoreKey()` is deterministic for the same scope.
3. Keys differ when only `nodeId` differs.
4. Keys differ when only `agentId` differs.
5. Unsafe characters are normalized so keys are path-safe.

## Suite D: Tool bundle guardrails

1. Workflow nodes can reference `capability-candidate`, `skill`, `memory`, `mcp`, `command`, `plugin`, and `adapter` refs.
2. Built-in templates do not reference raw secrets.
3. Required tool refs remain explicit in each node so Integrations Hub can later resolve availability.

## Suite E: Documentation and vocabulary contract

1. `feature-spec.md` includes a Glossary section with Coordinator, AI Assistant, AI Engineer, Worker, Workflow, DAG, Memory, ChatSession Store, Runtime Adapter, Agent Harness, Checkpoint, and Resume Point.
2. `feature-spec.md` includes Mermaid diagrams for Control Plane, Software Development, Deep Research, and Memory / Session Isolation.
3. `test-scenarios.md` includes product-level user journeys, not only type-level cases.
4. User-facing guides exist for AI Assistants Control Console and Agent Workflows.
5. `docs:site:check` stays current after guide updates.

## Suite F: Future workflow run state machine

| Case | Input | Expected |
| --- | --- | --- |
| F1 | Node has unmet dependencies | Coordinator keeps node queued |
| F2 | Upstream artifacts complete | Coordinator marks downstream node ready |
| F3 | Tool candidate missing | Worker creation is blocked before runtime start |
| F4 | Runtime failure with retry budget | Node retries and records attempt count |
| F5 | Runtime failure after retry budget | Node becomes failed and WorkflowRun becomes blocked |
| F6 | User resumes node from checkpoint | Session scope matches project + workflow + run + node + agent |

Implemented coverage now lives in `agentWorkflowDag.test.ts`:

- initial WorkflowRun state creates ready root nodes and queued dependent nodes;
- completed dependencies unblock downstream node runs;
- runtime failures retry while budget remains and block after budget exhaustion;
- dispatch prompts include WorkflowRun identity, node contracts, and session isolation rules.

## Suite G: Dispatch template picker

1. Task Dispatch renders a multi-agent DAG workflow template picker.
2. The DAG picker is separate from the legacy single-agent Agent Workflow prompt selector.
3. Selecting a DAG template stores `workflowTemplateId` and initializes a `workflowRunId` in dispatch prompt config.
4. Batch Dispatch can wrap every selected feature with its own initialized WorkflowRun.

## Suite H: WorkflowRun sidecar persistence

1. `workflowRunsDirectory(projectRoot)` resolves to `<projectRoot>/.project-manager/workflow-runs`.
2. `workflowRunPath(projectRoot, runId)` normalizes unsafe run IDs before creating a JSON path.
3. `serializeAgentWorkflowRun()` and `parseAgentWorkflowRun()` round-trip valid runs.
4. `saveAgentWorkflowRun()` writes pretty JSON through the bridge-backed store adapter.
5. Task Dispatch and Batch Dispatch save initialized WorkflowRun records before runtime launch.

## Suite I: AI Assistants Workflow Runs sheet

1. AI Assistants Control Console exposes a `workflow-runs` sheet route.
2. The sheet reads persisted WorkflowRun sidecars for the selected project root.
3. The sheet shows run totals, active/ready/completed/blocked counts, and selected run details.
4. Selected run detail shows node status, dependencies, attempts, runtime profile, isolated session scope, and artifacts.
5. When no project or sidecars exist, the sheet shows an empty state instead of throwing.

## User Scenario Development Tests

| ID | Scenario | Test Level | Expected |
| --- | --- | --- | --- |
| F35-S01 | User dispatches Software Development workflow | Unit now, UI later | Template exposes planner -> parallel implementers -> reviewers/testers -> summarizer dependencies |
| F35-S02 | User dispatches Deep Research workflow | Unit now, UI later | Template exposes parallel search/write branches and final report node |
| F35-S03 | User resumes a failed worker | Unit now | Session scope can identify exact `workflowRunId + nodeId + agentId` |
| F35-S04 | User switches runtime from xmux to CubeSandbox later | Type-level now | Runtime provider is data, not hard-coded behavior |
| F35-S05 | User prevents memory pollution | Unit now | Store key changes by node/agent and never falls back to global chat history |
| F35-S06 | Integrations Hub candidate missing | Future integration | Resolver blocks the node before execution and surfaces a missing capability |
| F35-S07 | User understands Edit Engineer Role fields | Docs now, UI tests later | Glossary maps role fields to Worker creation behavior |
| F35-S08 | User operates AI Assistants Control Console | Docs now, UI tests later | Console guide explains sheets, state, permissions, memory, and audit expectations |
| F35-S09 | User selects a DAG template in Dispatch | Component now | Dispatch exposes multi-agent template picker and wraps prompt with WorkflowRun identity |
| F35-S10 | User inspects created WorkflowRun | Component now | Console Workflow Runs sheet shows the run, node status, isolated session scope, and artifacts |

## Manual Verification Later

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F35-M01 | Development sheet artifact links | Open Project Dashboard > Development > F35 | README/spec/TDD/dev-log links open in the document panel |
| F35-M02 | Dispatch template migration | Open Dispatch modal after UI phase | Software Dev and Deep Research templates are visible |
| F35-M03 | Worker memory isolation | Run two workers in same workflow | Sessions appear as separate records by node and agent |
| F35-M04 | Console guide | Open `/documentation/guides/features/ai-assistants-control-console` | User can understand which sheet controls roles, memory, permissions, and audit |
| F35-M05 | Agent workflow guide | Open `/documentation/guides/features/agent-workflows` | User can understand Software Dev / Deep Research dispatch flow |

## Regression Guards

- Do not mutate the existing flat `DEFAULT_AGENT_WORKFLOWS` prompt catalog.
- Do not introduce a schema bump until workflow persistence lands.
- Do not place raw API keys, SSH keys, or provider secrets in workflow definitions.
