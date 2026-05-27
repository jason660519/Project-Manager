# F35: Agent Workflow DAG Control Plane

## Purpose

Give Project Manager a first-class control-plane model for multi-agent workflows before adding external worker runtimes such as CubeSandbox. The model must make workflow orchestration, worker runtime selection, tool/skill/memory eligibility, and per-agent session isolation explicit.

## Background

The target architecture separates three layers:

- **Control plane**: Project Manager owns workflow definitions, node dependencies, retries, run state, logs, metrics, and artifact collection.
- **Definition layer**: named DAG templates such as Software Development and Deep Research describe roles, dependencies, output contracts, and allowed tools.
- **Execution layer**: local process, xmux, CubeSandbox, E2B, Hermes, OpenClaw, or future runtimes execute workers through a common adapter contract.

CubeSandbox is treated as an execution substrate, not the workflow orchestrator. Project Manager must decide what to run, where to resume, which tools are allowed, and how agent memory is isolated.

## User Stories

### US-01: Create a software development workflow template

**As a** technical lead  
**I want** a reusable Software Development DAG with planner, implementer, reviewer, tester, and summarizer nodes  
**So that** Dispatch can eventually create parallel engineering runs with clear gates

### US-02: Create a Deep Research workflow template

**As a** researcher  
**I want** parallel search nodes, writing nodes, and a final report node  
**So that** research work can fan out by topic and merge into a controlled report artifact

### US-03: Keep worker memories isolated

**As a** user running multiple agents  
**I want** every worker to have its own ChatSession namespace  
**So that** one agent's hidden reasoning or memory cannot contaminate another agent

### US-04: Resolve worker tools from approved candidates

**As a** Project Manager operator  
**I want** workflow nodes to reference tool, skill, memory, MCP, and capability candidates by ID  
**So that** Integrations Hub remains the source of truth for what a worker may use

### US-05: Keep runtime provider replaceable

**As a** maintainer  
**I want** CubeSandbox to be one runtime provider behind an adapter contract  
**So that** local/xmux development and later CubeSandbox proof-of-concepts share the same workflow model

## Functional Requirements

- Add typed workflow DAG definitions with stable IDs and version numbers.
- Nodes declare role, runtime profile, model selection mode, session policy, tool bundle, input dependencies, retry policy, and output contract.
- Edges are explicit and acyclic.
- Templates include at least:
  - `software-dev-parallel`
  - `deep-research-parallel`
- Session scope must include `projectId`, `workflowId`, `workflowRunId`, `nodeId`, and `agentId`.
- Session store keys must be deterministic, path-safe, and unique by worker node.
- Helper validation must reject missing node IDs, dangling edges, duplicate node IDs, and cycles.
- The initial implementation must not store API keys, SSH keys, raw secrets, or global memory in workflow definitions.

## Technical Requirements

- Source modules live under `lib/agent-workflows/`.
- Existing flat prompt workflow helpers remain backward compatible.
- New tests live in `__tests__/agentWorkflowDag.test.ts`.
- Architecture rationale is captured in `docs/architecture/ADR-013-agent-workflow-dag-control-plane.md`.
- Feature config points Development sheet to the new artifacts and implementation paths.

## Acceptance Criteria

1. F35 appears in Project Dashboard > Development sheet with README, feature spec, TDD spec, user scenarios, and dev log paths.
2. `listAgentWorkflowDags()` returns the two default DAG templates.
3. DAG validation passes for built-in templates.
4. A deliberately cyclic workflow returns a validation error.
5. Session store keys differ across workflow run/node/agent combinations.
6. Existing `DEFAULT_AGENT_WORKFLOWS` tests continue to pass.
7. `npm run typecheck`, focused vitest suites, `npm run docs:check`, and `npm run standards:check` complete or failures are documented.

## Open Decisions

- Whether workflow definitions should later be persisted in `.project-manager/config.json`, separate `.project-manager/workflows/*.json`, or TypeScript seed templates plus user JSON overrides.
- Whether the long-running scheduler belongs in Tauri/Rust or remains in renderer until workflow execution is stable.
- How much raw prior-node transcript a downstream summarizer may request versus only reading declared artifacts.
