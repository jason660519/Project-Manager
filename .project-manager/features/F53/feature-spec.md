# F53 Feature Spec - Workflow Graph Execution Console

## Problem Definition

F52 can generate Project Workflow decision packages and persistent run sidecars,
but the current `Workflow Runs` tab is still shaped around the older
agent-workflow table model. It does not clearly show how a feature flows through
human, AI agent, tool, review queue, and approval nodes. PMs also cannot inspect
what each node is using: system prompt, engineer/task prompt, tools, memory
files, input handoff, output handoff, evidence, and gates.

## User Value

PMs and discipline leads need a visual workflow map that makes AI/human/tool
orchestration inspectable before anything executes. The graph should answer:

- Which feature/work item is this run for?
- Which node is ready, running, blocked, or done?
- Which actor owns the node?
- Which prompts, tools, and memory files are in scope?
- Which handoff/evidence contract is required next?
- Which approval gate prevents high-risk continuation?

## In Scope

- Use `Workflow Runs` tab as the first product entry point.
- Visualize Project Workflow runs as a graph canvas with connected nodes.
- Provide a run browser/sidebar for selecting runs and seeing aggregate status.
- Provide a node inspector for selected node details.
- Surface node metadata:
  - actor kind and discipline;
  - status and attempts;
  - dependency list;
  - system prompt label;
  - engineer/task prompt label;
  - allowed tools;
  - memory file references;
  - input and output handoff artifact ids;
  - evidence requirements;
  - scorecard status;
  - blocking approval gate.
- Load persisted Project Workflow run sidecars from
  `.project-manager/project-workflow-runs`.
- Persist a reviewed `/workflow <featureId>` package into a Project Workflow run
  sidecar only when the caller explicitly requests persistence.
- Provide an explicit UI action in `Workflow Runs` to save a review-first
  Software Engineering Loop run sidecar for a typed feature/work item id.
- Keep the console review-first. UI actions may prepare a selected state, but no
  actor or command is executed in this slice.
- Keep old agent-workflow data from crashing the tab while project-workflow data
  is introduced.

## Out of Scope

- Drag/drop workflow builder.
- Editing workflow templates.
- Fully automated node execution.
- Starting real external tools from the graph.
- Starting real AI agents from the graph.
- Implicitly writing sidecars on every normal `/workflow <featureId>` chat
  command.
- Project Dashboard feature-detail workflow panel.
- Cross-device collaboration or server sync.

## Success Metrics

- User can open AI Assistants > Workflow Runs and see a graph for at least one
  Project Workflow run.
- A reviewed workflow package can be saved as a sidecar with explicit
  persistence, then appears in the Workflow Runs graph.
- A PM can save a workflow run from the `Workflow Runs` tab without remembering
  `/workflow-save <featureId>`.
- Selecting a node updates the inspector with prompts/tools/memory/handoff and
  evidence requirements.
- Blocked approval gates are visible without reading the raw JSON sidecar.
- Empty/error states explain whether no project is selected, no run sidecars
  exist, or a sidecar is malformed.
- Automated unit/integration coverage confirms graph projection and UI rendering
  for normal, boundary, error, and permission/review-first cases.

## Dependencies

- F52 Project Workflow types and run store:
  - `lib/project-workflows/projectWorkflowEngine.ts`
  - `lib/project-workflows/projectWorkflowRunStore.ts`
- AI Assistants console:
  - `app/ai_assistants/AIAssistantsConsoleClient.tsx`
  - `app/ai_assistants/[sheet]/page.tsx`
- PM workstation UI conventions:
  - `WorkstationFrame`
  - `BottomSheetTabs`
  - existing AI Assistants dark desktop styling

## Constraints

- No renderer-side raw Tauri `invoke`; bridge calls must remain wrapped.
- No automatic execution in this slice.
- No schemaVersion bump unless canonical config shape changes in a breaking way.
- UI must avoid generic marketing layout and stay dense, operational, and
  workstation-like.
- Manual browser smoke is required because this changes a UI tab.

## Proposed UX Direction

Use a graph canvas + inspector layout:

- Left: run browser and aggregate filters.
- Center: workflow graph canvas with node cards and dependency edges.
- Right: selected node inspector with prompt/tool/memory/handoff/evidence/gate
  details.

Swimlane grouping can be added later as a view mode. Rich node cards are used in
the inspector and optional expanded node state, not as the only layout.
