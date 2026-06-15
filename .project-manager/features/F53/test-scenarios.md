# F53 Test Scenarios

## Normal Scenarios

### TS1 - Graph Console Loads a Project Workflow Run

Given a selected project and a persisted Project Workflow run  
When the user opens AI Assistants > Workflow Runs  
Then the run browser lists the run, the canvas renders the workflow graph, and
the first ready node is selected.

### TS2 - Node Inspector Shows Execution Context

Given a selected AI agent node  
When the inspector opens  
Then it shows system prompt, engineer/task prompt, tools, memory files, input
handoff, output handoff, evidence, scorecard, attempts, and dependencies.

## Boundary Scenarios

### TS3 - No Runs

Given no Project Workflow runs exist  
When the tab opens  
Then the user sees a Project Workflow empty state and can still use other AI
Assistants tabs.

### TS4 - Multiple Runs

Given multiple Project Workflow runs exist for different work items  
When the user selects each run  
Then the canvas and inspector update without losing the selected sheet.

## Error Scenarios

### TS5 - Malformed Run Sidecar

Given one sidecar is malformed  
When the run store loads runs  
Then malformed data is skipped and valid runs still render.

### TS6 - Missing Project Root

Given no project root is available  
When the tab opens  
Then the loader does not call the bridge and the UI explains that a project must
be selected.

## Permission / Safety Scenarios

### TS7 - Review-First Render

Given a ready AI agent or tool node  
When the user selects it  
Then the UI displays manual/review-first actions only and does not execute
agents or tools.

### TS8 - Human Approval Gate

Given a high-risk node requires approval  
When the gate or high-risk node is selected  
Then the inspector shows the gate title, approver role, and reason before any
continuation action is available.

### TS9 - Save Workflow Run Explicitly

Given AI Assistant chat has a selected project root  
When the user confirms saving the `/workflow F53` package  
Then a Project Workflow run JSON sidecar is written to
`.project-manager/project-workflow-runs`  
And Workflow Runs can load it as graph data.

### TS10 - Default Workflow Command Remains Review-Only

Given the user sends `/workflow F53` without save confirmation  
When the command returns  
Then it produces the decision package only and does not write files.
