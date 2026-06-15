# F52 Test Scenarios

## Scenario 1 - Software Engineering Loop Template

Given a PM selects the built-in Software Engineering Loop template, when the
engine validates it, then the template contains analysis, implementation,
verification, quality gate, human approval, and PR preparation nodes while still
using generic Project Workflow types.

## Scenario 2 - Review-First Run Creation

Given an approved project work item and a workflow template, when the PM creates
a workflow run, then root nodes are ready, dependent nodes are queued, and no
actor or command is executed automatically.

## Scenario 3 - Structured Handoff and Evidence

Given a ready analysis node, when it completes with a handoff artifact and
required evidence, then the run records the artifact and evidence ledger entry
and unblocks eligible downstream nodes.

## Scenario 4 - Missing Evidence Blocks Progress

Given a node with a required evidence contract, when it completes without that
evidence, then the scorecard marks the node blocked and dependent nodes do not
start.

## Scenario 5 - Human Approval Gate

Given a workflow that reaches PR preparation, when required scorecards or human
approval are missing, then approval is blocked and the rendered decision package
explains the remaining gates.

## Scenario 6 - Overbaking Guard

Given a node exceeds its attempt budget or scope lock, when the state machine
recomputes the run, then the loop blocks with a stop-policy reason instead of
continuing to expand scope.
