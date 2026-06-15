# F53 TDD Specification

## Test Strategy

F53 is UI-heavy but must be driven by testable projection logic first.

1. Unit tests validate Project Workflow run to graph view-model projection.
2. Component/integration tests validate the `Workflow Runs` tab renders graph
   nodes and inspector details from Project Workflow data.
3. E2E/manual smoke validates browser rendering, console stability, and no
   hydration/runtime errors on `/ai_assistants/workflow-runs`.

## Test Layers

| Layer | Target | Purpose |
|---|---|---|
| Unit | `lib/project-workflows/projectWorkflowGraphView.ts` | Convert run/template data into graph nodes, edges, inspector facts, gates, and aggregate counts. |
| Integration | `app/ai_assistants/AIAssistantsConsoleClient.tsx` | Render Project Workflow graph view in the existing Workflow Runs sheet. |
| Chat integration | `lib/chat/chatAgent.ts` | Persist `/workflow <featureId>` into a Project Workflow run sidecar only when explicitly requested. |
| E2E/manual | `/ai_assistants/workflow-runs` | Confirm the graph is visible, selectable, and has no browser console or Next dev overlay errors. |

## Scenarios

### S1 Normal - Render Graph Run

Given a Project Workflow run created from the Software Engineering Loop  
When the Workflow Runs sheet loads the run  
Then the canvas shows nodes for Intake, Analysis, Implementation, Verification,
Quality Gate, Human Approval, PR Preparation, and Report  
And edges represent dependency flow  
And the metrics show runs, active runs, ready nodes, and blocked runs.

Acceptance:

- At least 8 graph nodes are rendered.
- At least 7 graph edges are represented in the view model.
- Ready node count is greater than 0 for a queued run.

### S2 Normal - Inspect Node Details

Given the graph contains an AI agent node  
When the user selects the node  
Then the inspector shows actor kind, status, dependencies, attempts, system
prompt label, task prompt label, tools, memory files, input handoff, output
handoff, evidence requirements, and scorecard state.

Acceptance:

- Inspector contains prompt/tool/memory labels.
- Inspector contains the node's handoff artifact id.
- Inspector contains at least one evidence requirement.

### S3 Boundary - Empty Runs

Given a selected project has no Project Workflow run sidecars  
When the Workflow Runs sheet opens  
Then the tab shows an empty state explaining no Project Workflow runs exist yet  
And it does not show stale agent-workflow-only wording as the primary message.

Acceptance:

- Empty state text includes "Project Workflow".
- No runtime error is thrown.

### S4 Error - Malformed Sidecar Is Skipped

Given the run store contains one malformed JSON sidecar and one valid run  
When the loader lists Project Workflow runs  
Then the malformed run is skipped  
And the valid run still appears.

Acceptance:

- Unit/store test confirms malformed entries do not block all runs.
- UI can render the valid run list.

### S5 Permission/Review-First - No Auto Execution

Given a ready AI agent or tool node  
When the graph renders action controls  
Then the UI labels actions as review/prepare/manual-start only  
And no agent spawn, tool command, PR, push, deploy, or external side effect is
performed by simply rendering or selecting a node.

Acceptance:

- Component test asserts no spawn bridge call is made during render/selection.
- Visible copy indicates manual start/review-first behavior.

### S6 Approval Gate

Given a workflow has a human approval gate before a high-risk node  
When the run is displayed  
Then the gate is attached to the blocked/high-risk node in graph or inspector  
And the inspector explains the approver role and reason.

Acceptance:

- Gate title, approver role, and reason are visible for the selected gated node.

### S7 Explicit Persistence - Save Workflow Run Sidecar

Given the chat context has a selected project root and a known feature  
When `/workflow <featureId>` is sent with explicit workflow persistence enabled  
Then the command saves a Project Workflow run sidecar under
`.project-manager/project-workflow-runs`  
And the response includes the saved path  
And no actor/tool command is executed.

Acceptance:

- Store adapter `writeFile` is called once.
- Saved JSON contains `templateId`, `workItemId`, and a ready first node.
- Response contains `Saved workflow run:`.

### S8 Review-Only Default - No Implicit Write

Given the same chat context  
When `/workflow <featureId>` is sent without explicit workflow persistence  
Then the command returns a decision package only  
And no run sidecar is written.

Acceptance:

- Store adapter `writeFile` is not called.
- Response still contains `No actor or command is executed by this package.`

## Red / Green / Refactor Protocol

Each implementation round must follow:

1. Write or update the failing test first.
2. Run the focused test and capture the expected failure.
3. Implement the minimum code needed to pass.
4. Run the focused test again and capture pass.
5. Refactor only after green.
6. Append the dev-log with test status and decision rationale.

## Quantified Completion Criteria

- Unit tests: graph projection normal/boundary/gate coverage passes.
- Integration tests: Workflow Runs sheet renders graph and inspector coverage
  passes.
- E2E/manual: browser smoke on `/ai_assistants/workflow-runs` has no hydration
  or React console errors.
- `npm run verify:baseline` passes before completion is claimed.
