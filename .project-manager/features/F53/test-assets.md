# F53 Test Assets

This file maps F53 requirements to executable test files so future engineers can
locate the right checks quickly without duplicating test sources.

## Unit

- `__tests__/projectWorkflowGraphView.test.ts`
  - F53 dashboard metadata and feature artifact existence.
  - Project Workflow run to graph nodes, edges, and metrics.
  - Node inspector prompt/tool/memory/handoff/evidence/scorecard/approval gate
    projection.

## Integration

- `__tests__/ai-assistants.console.test.tsx`
  - AI Assistants > Workflow Runs renders Project Workflow graph canvas.
  - Node inspector shows execution context and review-first safety copy.
  - Empty Project Workflow state explains how to start from `/workflow <featureId>`.
  - Existing legacy AgentWorkflow run rendering remains covered.
- `__tests__/chat.agent.test.ts`
  - `/workflow <featureId>` remains review-only by default.
  - `/help` advertises `/workflow-save <featureId>`.
  - `/workflow <featureId>` persists a Project Workflow run sidecar only when
    `persistWorkflowRun` is explicitly enabled.
  - `/workflow-save <featureId>` is the user-facing explicit persistence command.
  - Persisted run response includes the sidecar path and still does not spawn
    agents or execute tools.

## E2E / Manual Smoke

- Route: `/ai_assistants/workflow-runs`
- Required manual checks:
  - Open in Chrome/Safari/Tauri, not Cursor embedded browser alone.
  - Confirm graph canvas appears for Project Workflow runs.
  - Select nodes and confirm inspector updates.
  - Confirm browser console has no hydration or React errors.
  - Run `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`.

## Current Status

- Unit focused tests: passing.
- Integration focused tests: passing.
- Chat persistence focused tests: passing.
- Manual E2E smoke: pending until dev server/browser verification.
