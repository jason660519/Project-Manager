# F53 Workflow Graph Execution Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a review-first graph console in AI Assistants > Workflow Runs for F52 Project Workflow runs.

**Architecture:** Add a pure graph projection module under `lib/project-workflows/`, then render the projected graph in the existing AI Assistants Workflow Runs sheet. The UI remains manual/review-first and does not execute agents or tools.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, Vitest, React Testing Library, existing bridge wrappers.

---

## File Structure

- Create `lib/project-workflows/projectWorkflowGraphView.ts`
  - Converts `ProjectWorkflowTemplate` + `ProjectWorkflowRun` into graph nodes,
    edges, inspector model, aggregate metrics, and safety labels.
- Modify `lib/project-workflows/index.ts`
  - Export graph view helpers.
- Modify `app/ai_assistants/AIAssistantsConsoleClient.tsx`
  - Load Project Workflow run sidecars.
  - Render graph canvas + run browser + inspector in `WorkflowRunsSheet`.
- Add `__tests__/projectWorkflowGraphView.test.ts`
  - Unit coverage for projection, gates, prompts/tools/memory placeholders, empty
    and blocked states.
- Add or update `__tests__/aiAssistants.workflowRuns.test.tsx`
  - Integration coverage for the Workflow Runs tab graph UI.
- Update `.project-manager/features/F53/dev-log.md`
  - Record RED/GREEN/REFACTOR status and verification output.

## Table / Sheet Layout Classification

The first F53 slice is not a TanStack data table. It modifies an existing
workstation sheet tab and must keep `WorkstationFrame` + `BottomSheetTabs`
through the AI Assistants console. Required table controls are N-A because the
primary UI is a graph canvas, not a Basic Table Sheet.

## Task 1 - Graph View Model

- [ ] Write RED unit tests in `__tests__/projectWorkflowGraphView.test.ts`.
- [ ] Confirm RED with `npm run test -- __tests__/projectWorkflowGraphView.test.ts`.
- [ ] Create `lib/project-workflows/projectWorkflowGraphView.ts`.
- [ ] Export helpers from `lib/project-workflows/index.ts`.
- [ ] Confirm GREEN with the focused unit test.

## Task 2 - Workflow Runs Graph UI

- [ ] Write RED integration test for `WorkflowRunsSheet` rendering Project
  Workflow nodes and inspector fields.
- [ ] Confirm RED with the focused integration test.
- [ ] Modify `AIAssistantsConsoleClient.tsx` to load Project Workflow runs and
  render graph canvas + inspector.
- [ ] Confirm GREEN with focused integration test.

## Task 3 - Empty, Error, and Review-First States

- [ ] Add tests for no project root, no runs, malformed sidecar fallback, and no
  auto execution on render/selection.
- [ ] Implement minimal UI states and safety copy.
- [ ] Confirm focused tests pass.

## Task 4 - Verification and Documentation

- [ ] Run focused tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run verify:baseline`.
- [ ] Run manual browser smoke on `/ai_assistants/workflow-runs`.
- [ ] Append dev-log with coverage, failures, root causes, and remaining risks.

## Self-Review

- Spec coverage: graph canvas, node inspector, prompt/tool/memory/handoff,
  approval gates, review-first behavior, and sidecar loading are covered by tasks.
- Placeholder scan: no implementation TODOs are left in this plan.
- Type consistency: all new modules use the existing `ProjectWorkflow*` F52 types.
