# F35 Test Scenarios

## Purpose

Translate the Agent Workflow DAG Control Plane into real user journeys that future unit, integration, browser, and Tauri tests can cover. These scenarios are product-level, not just type-level.

## Personas

| Persona | Goal | Risk |
| --- | --- | --- |
| Technical lead | Run software development workflow with parallel implementers and review gates. | Hidden shared memory biases reviewers or hides implementation risk. |
| Research operator | Fan out research topics and merge a report. | Summarizer reads unverified intermediate chatter instead of declared artifacts. |
| Maintainer | Add CubeSandbox later without redesigning Dispatch. | Runtime-specific details leak into the workflow schema. |
| Security reviewer | Audit tool and memory boundaries. | Secrets or SSH keys are accidentally serialized into workflow definitions. |
| New operator | Understand terms in AI Assistants Console and Edit Engineer Role. | User configures wrong model, memory, scope, or capability because labels are unclear. |

## Scenario Matrix

| Scenario ID | User path | Risk | Unit / integration coverage | E2E / manual candidate | Status |
| --- | --- | --- | --- | --- | --- |
| F35-S01 | User opens Development sheet and sees F35 artifacts. | Follow-up engineer cannot find spec/TDD/dev log. | Config JSON path check. | Dashboard document-link click. | Covered by config + manual candidate |
| F35-S02 | User reads glossary before configuring workflows. | Product terms drift across Console, Engineers, Dispatch, and Sessions. | Docs existence / heading check candidate. | Documentation page review. | Candidate |
| F35-S03 | User dispatches Software Development workflow. | Nodes run in wrong order or skip review/test gates. | `agentWorkflowDag.test.ts` validates node roles and dependencies. | Dispatch modal workflow template later. | Partially covered |
| F35-S04 | User dispatches Deep Research workflow. | Branches do not fan out or report node merges raw memory. | `agentWorkflowDag.test.ts` validates branch dependencies. | Console workflow run view later. | Partially covered |
| F35-S05 | Reviewer Worker fails and resumes. | Resume loads sibling worker's session. | Session key tests vary by node/agent/run. | Sessions view grouping later. | Covered at unit level |
| F35-S06 | Summarizer runs after parallel workers. | Summarizer reads private transcripts instead of declared artifacts. | Artifact contract and session policy tests candidate. | Manual artifact-only handoff review later. | Candidate |
| F35-S07 | User edits Engineer Role primary model and fallback chain. | CLI/direct provider behavior is misunderstood. | Engineer detail tests candidate. | Edit Engineer Role field walkthrough. | Candidate |
| F35-S08 | User assigns capability in Edit Engineer Role. | Worker receives untested tool or unsupported capability. | Capability resolver tests candidate. | Integrations Hub -> Engineers -> Dispatch manual flow. | Candidate |
| F35-S09 | User switches runtime preference from xmux to CubeSandbox. | Workflow model becomes provider-specific. | Runtime provider type tests covered. | CubeSandbox PoC later. | Partially covered |
| F35-S10 | Permission blocks command execution. | Worker runs risky command without approval. | Permission gate tests candidate. | Console Permissions sheet later. | Candidate |
| F35-S11 | Coordinator retries a runtime failure. | Retry loops forever or hides failure. | WorkflowRun state-machine tests candidate. | Run log manual review later. | Candidate |
| F35-S12 | Operator audits memory access. | Worker memory pollution is invisible. | Session scope tests covered. | Audit sheet memory-access event later. | Partially covered |

## Detailed User Journeys

### F35-S03: Software Development fan-out

1. User selects a Development feature.
2. User chooses `Software Development` workflow.
3. Coordinator creates a WorkflowRun.
4. Planner Worker produces `implementation-plan`.
5. Implementer Workers run in parallel.
6. Reviewer Workers read implementation artifacts, not hidden implementer transcripts.
7. Tester/Evaluator Workers run after reviews.
8. Summarizer reads declared outputs and writes handoff.

Expected: workflow is acyclic, gates are visible, every node has a session scope and output contract.

### F35-S04: Deep Research fan-out

1. User opens AI Assistants Control Console.
2. User starts Deep Research with topics A/B/C.
3. Coordinator creates parallel search Workers.
4. Writer Workers synthesize only their assigned topic artifacts.
5. Report Worker merges topic drafts and source notes.

Expected: source notes and report sections are artifacts; private branch transcripts are not merged by default.

### F35-S05: Failed Worker resume

1. `review-a` fails after writing partial logs.
2. User selects Resume.
3. Coordinator resolves `projectId + workflowId + workflowRunId + nodeId + agentId`.
4. Runtime adapter resumes from the matching checkpoint.

Expected: `review-a` resumes its own checkpoint; `review-b` session remains unread and untouched.

### F35-S07: Edit Engineer Role field comprehension

1. User opens AI Assistants Control Console -> AI Engineers.
2. User opens Edit Engineer Role.
3. User reviews Role Name, Slug, Default Agent, Primary Model, Fallback Chain, Skills, System Prompt, Capabilities, Test Prompt, Working Scope.
4. User saves a Reviewer role.
5. Dispatch uses the role in a workflow node.

Expected: each field has a clear purpose and maps to Worker creation behavior.

### F35-S08: Tool bundle resolution

1. Role requests Eyes and browser/search tools.
2. Adapter declares only text and shell support.
3. Integrations Hub has no passed Eyes candidate.
4. Coordinator blocks Worker creation.

Expected: UI explains missing/unsupported capability before runtime execution begins.

## Conversion Rule

When implementing UI or runtime slices, convert each scenario into:

- one unit test for data contract or state machine behavior;
- one integration test for component-level wiring;
- one browser/Tauri manual script when runtime or desktop permissions are involved.
