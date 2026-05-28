# F35 - Agent Workflow DAG Control Plane

## Summary

Introduce the first Project Manager control-plane model for multi-agent workflow DAGs. This feature separates workflow orchestration from worker runtime providers so local/xmux workers can run first, while CubeSandbox, E2B, Hermes, or other runtimes can be added behind the same adapter contract later.

## Current State

- Status: in_progress
- Progress: 84%
- Phase: development
- Owner: Codex
- Created: 2026-05-28

## Scope

- Define typed workflow DAG nodes, dependencies, retry policy, runtime profile, tool bundle references, and output contracts.
- Provide default Software Development and Deep Research workflow templates.
- Define per-agent session scope helpers so worker memory and chat history do not share a global store.
- Define shared vocabulary for Coordinator, AI Assistant, AI Engineer, Worker, Workflow, Memory, Session, Runtime Adapter, Harness, Checkpoint, and Resume Point.
- Document AI Assistants Control Console and Edit Engineer Role terminology before UI expansion.
- Add WorkflowRun / WorkflowNodeRun state helpers and expose DAG template selection in Dispatch.
- Persist initialized WorkflowRuns as `.project-manager/workflow-runs/*.json` sidecars.
- Expose persisted WorkflowRuns in AI Assistants Control Console for run/node/session/artifact inspection.
- Add architecture documentation and tests before any CubeSandbox runtime implementation.

## Non-Goals

- Starting CubeSandbox, E2B, or Docker workers.
- Building the visual DAG editor.
- Replacing the existing P/W/E dispatch modal in this first slice.
- Writing secrets, SSH keys, or provider credentials into workflow definitions.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Related Guides

- `docs/guides/features/ai-assistants-control-console.md`
- `docs/guides/features/agent-workflows.md`
