# ADR-013: Agent Workflow DAG Control Plane

> **Created Date**: 2026-05-28
> **Created By**: Codex
> **Last Modified**: 2026-05-28
> **Modified By**: Codex
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-003 - Prompt Assembly](./ADR-003-prompt-assembly.md), [ADR-004 - API Call Security](./ADR-004-api-call-security.md), [ADR-012 - Schema v8 Engineer Cron Dispatch](./ADR-012-schema-v8-engineer-cron.md)

## Background

Project Manager is moving from single-role dispatches toward multi-agent workflows. The target workflow shape includes Software Development DAGs and Deep Research DAGs with fan-out, review/test gates, summarization, runtime isolation, and explicit tool eligibility.

CubeSandbox is a strong candidate for isolated worker execution because it provides E2B-compatible sandbox APIs, fast VM-backed startup, and session pause/resume behavior. It does not replace Project Manager's product-level orchestration responsibilities: workflow definition, run state, retry policy, artifact routing, tool permission resolution, and memory isolation.

## Decision

Project Manager will own a workflow DAG control plane with these boundaries:

1. Workflow definitions are product-level DAG templates, not runtime scripts.
2. Worker runtimes are selected through a declarative runtime profile and later executed through a `WorkerRuntimeAdapter` boundary.
3. Built-in templates start with:
   - `software-dev-parallel`
   - `deep-research-parallel`
4. Every worker node gets an isolated session scope containing `projectId`, `workflowId`, `workflowRunId`, `nodeId`, and `agentId`.
5. Tool access is represented as references to Integrations Hub candidates, skills, memory files, MCP servers, commands, plugins, or adapters. Workflow definitions must not store raw secrets.
6. CubeSandbox is treated as one future runtime provider, beside `local-process`, `xmux`, `e2b`, `hermes`, and `openclaw`.

## Rationale

- A Project Manager-owned DAG model keeps business workflows stable even if the execution substrate changes.
- Per-agent session scope directly addresses memory pollution risk and avoids reusing global chat history.
- Tool references preserve Integrations Hub as the qualification and enablement source of truth.
- Starting with pure TypeScript definitions and validation lets the dashboard, tests, and docs converge before any sandbox process lifecycle is introduced.
- Keeping prompt assembly in TypeScript remains aligned with ADR-003. Runtime adapters execute prepared work; they do not become hidden prompt assemblers.

## Evaluated Alternatives

| Alternative | Outcome | Reason |
| --- | --- | --- |
| Make CubeSandbox the workflow orchestrator | Rejected | It is an execution substrate; PM still needs product workflows, UI state, artifacts, retry policy, and session isolation. |
| Extend P/W/E dispatch only | Rejected | Planner/Worker/Evaluator is too narrow for Software Dev and Deep Research DAGs with parallel branches and joins. |
| Persist workflows in schema v9 immediately | Deferred | Built-in TS templates are enough for the first slice; schema persistence should land after UI and migration design are clear. |
| Reuse global chat sessions | Rejected | This is the memory pollution failure mode the feature is meant to prevent. |

## Risks & Mitigation

| Risk | Mitigation |
| --- | --- |
| Workflow model grows too abstract | Keep only fields needed by Software Dev and Deep Research templates in F35. |
| Runtime-specific fields leak into definitions | Use declarative runtime provider/profile fields and keep provider behavior behind adapters. |
| Session store fragmentation makes browsing harder | Include workflow/run/node/agent metadata so Sessions UI can group records later. |
| Tool refs point to unavailable candidates | Add resolver and blocked-state UI in a follow-up before execution. |

## Consequences

**Positive**

- Multi-agent workflow planning has a stable control-plane contract.
- Worker memory isolation is enforceable from the first implementation slice.
- CubeSandbox can be integrated later without redesigning Dispatch templates.

**Negative**

- The first slice adds architecture and type surface before user-visible workflow execution.
- A later schema decision is still required for user-authored workflow persistence.

## References

- `.project-manager/features/F35/feature-spec.md`
- `lib/agent-workflows/dagDefinitions.ts`
- `lib/agent-workflows/sessionScope.ts`
- `__tests__/agentWorkflowDag.test.ts`
