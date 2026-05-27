# F35 Test Scenarios

## Personas

| Persona | Goal | Risk |
| --- | --- | --- |
| Technical lead | Run software development workflow with parallel implementers and review gates | Hidden shared memory biases reviewers |
| Research operator | Fan out research topics and merge a report | Summarizer reads unverified intermediate chatter instead of declared artifacts |
| Maintainer | Add CubeSandbox later without redesigning Dispatch | Runtime-specific details leak into the workflow schema |
| Security reviewer | Audit tool and memory boundaries | Secrets or SSH keys are accidentally serialized into workflow definitions |

## Scenarios

### F35-S01: Software Development fan-out

1. Load `software-dev-parallel`.
2. Inspect node roles and dependencies.
3. Confirm planner is upstream of implementer nodes.
4. Confirm reviewer/tester nodes depend on implementation outputs.
5. Confirm summarizer depends on review and test outputs.

Expected: workflow is acyclic and exposes clear gates for future Dispatch UI.

### F35-S02: Deep Research fan-out

1. Load `deep-research-parallel`.
2. Inspect researcher, writer, and report nodes.
3. Confirm writer nodes depend on search outputs.
4. Confirm report node depends on writer outputs.

Expected: workflow supports parallel search/write branches and one final report artifact.

### F35-S03: Worker memory isolation

1. Build scopes for the same workflow run and two different nodes.
2. Generate store keys.
3. Build scopes for the same node and two different agents.

Expected: every key is unique and path-safe.

### F35-S04: Runtime provider swap

1. Inspect runtime profiles on built-in nodes.
2. Change a copy of a node from `xmux` to `cube-sandbox`.
3. Validate the workflow shape.

Expected: the DAG definition remains valid because runtime provider is declarative.

### F35-S05: Tool bundle resolution boundary

1. Inspect node tool bundle refs.
2. Confirm refs point to source kind and source id only.
3. Confirm no raw secret values exist.

Expected: Integrations Hub can later resolve candidates without workflow definitions storing credentials.

### F35-S06: Failed worker resume

1. Build a session scope for `workflowRunId=run-a`, `nodeId=review-a`, `agentId=reviewer-1`.
2. Generate a restore-point key.
3. Build another scope for `nodeId=review-b`.

Expected: resume target is exact; sibling reviewer history is not loaded.
