# F63 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F63-S01 | User selects runtime with session roots | Session import readiness is hidden or inconsistent | Covered by ready session/cost summary test | Browser smoke detail row | Passed | F63 spec |
| F63-S02 | User selects runtime missing session roots | Cost appears ready without evidence | Covered by missing session evidence test | Browser smoke missing state | Passed | F63 spec |
| F63-S03 | User selects runtime with cost unsupported | Cost module shows a false TODO/ready state | Covered by unsupported cost test | Manual smoke not separately needed; UI route smoke passed | Passed | F63 spec |
| F63-S04 | Malformed row includes secret-like fields or transcript text | Renderer-facing summary leaks secrets | Covered by displayable JSON exclusion test | Browser text check for fixture secret strings | Passed | ADR-004 |
| F63-S05 | Detail model renders Session/Cost groups | F62 and F63 duplicate readiness logic and drift | Covered by detail model summary text test | Browser smoke `/integrations-hub/agent-runtime` | Passed | F63 spec |

## Unit Test Backlog

- `.project-manager/features/F63/tests/agentRuntimeSessionCostSummary.test.ts`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm Session /
  Cost groups still render with console/page errors 0.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
