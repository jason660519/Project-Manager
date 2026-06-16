# F54 Workflow Execution Drafts & Run-Level Auto Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guarded execution draft controls to Workflow Runs so starting a node creates an auditable draft governed by run-level auto mode.

**Architecture:** Extend the F52 Project Workflow run state with execution mode and execution drafts, then surface the controls in the F53 Workflow Runs graph inspector. This slice creates and persists drafts only; real actor/tool execution remains blocked for a future Integration Hub executor slice.

**Tech Stack:** TypeScript, React 19, Next.js 16, Vitest, Project Workflow sidecar JSON.

---

### Task 1: Engine State Model

**Files:**
- Modify: `lib/project-workflows/projectWorkflowEngine.ts`
- Test: `__tests__/projectWorkflowEngine.test.ts`

- [ ] Write failing tests for execution mode defaults, draft creation, paused blocking, and high-risk auto-run blocking.
- [ ] Extend run types with `executionMode` and `executionDrafts`.
- [ ] Add `startProjectWorkflowNode` draft creation while preserving stop-policy behavior.
- [ ] Run focused engine tests.

### Task 2: Graph View Projection

**Files:**
- Modify: `lib/project-workflows/projectWorkflowGraphView.ts`
- Test: `__tests__/projectWorkflowGraphView.test.ts`

- [ ] Write failing tests for draft metadata in selected-node inspector.
- [ ] Project run-level execution mode and selected-node drafts into graph view.
- [ ] Run focused graph tests.

### Task 3: Workflow Runs UI Controls

**Files:**
- Modify: `app/ai_assistants/AIAssistantsConsoleClient.tsx`
- Test: `__tests__/ai-assistants.console.test.tsx`

- [ ] Write failing component test for execution mode controls and `Start node`.
- [ ] Add inspector controls for start/draft preview.
- [ ] Persist updated run sidecars after mode and start changes.
- [ ] Run focused component tests.

### Task 4: Verification

**Files:**
- Modify: `.project-manager/features/F54/dev-log.md`

- [ ] Browser smoke `/ai_assistants/workflow-runs`.
- [ ] Run `npm run verify:dev-issues -- --routes /ai_assistants/workflow-runs`.
- [ ] Run `npm run typecheck`.
- [ ] Run focused regression tests.
- [ ] Run `npm run verify:baseline` before completion.
