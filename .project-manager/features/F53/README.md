# F53 - Workflow Graph Execution Console

F53 upgrades the AI Assistants `Workflow Runs` tab from a run table into a
workflow graph execution console. The console visualizes Project Workflow runs as
node graphs so a PM can see which human, AI agent, tool, review queue, vendor, or
authority node is active, what prompts/tools/memory it is using, and which
handoff/evidence/approval contract blocks the next step.

## Goal

Create a review-first graph console for F52 Project Workflow runs:

- Graph canvas for workflow node dependencies.
- Node cards showing actor kind, status, prompt/tool/memory summary, inputs, and
  outputs.
- Inspector for selected node details, required handoff, evidence, scorecards,
  and approval gates.
- Existing `Workflow Runs` tab remains the entry point.

## First Slice

- Replace the old agent-workflow-only view with a Project Workflow graph view.
- Keep execution manual and non-destructive.
- Use F52's `ProjectWorkflowRun` model and sidecar store.
- Preserve the existing PM workstation layout and bottom sheet contract.
- Add `/workflow-save <featureId>` as the explicit way to save a review-first
  Project Workflow run sidecar without executing nodes.

## Out of Scope

- Automatic agent launch.
- Arbitrary drag/drop workflow editing.
- Feature detail workflow panel.
- External PR creation, push, merge, or deploy.

## Commands

- `/workflow <featureId>`: generate a review-only decision package.
- `/workflow-save <featureId>`: save the review-first Project Workflow run
  sidecar for the Workflow Runs graph; no node is executed.

## Files

- `.project-manager/features/F53/feature-spec.md`
- `.project-manager/features/F53/tdd-spec.md`
- `.project-manager/features/F53/test-scenarios.md`
- `.project-manager/features/F53/test-assets.md`
- `.project-manager/features/F53/implementation-plan.md`
- `.project-manager/features/F53/dev-log.md`
