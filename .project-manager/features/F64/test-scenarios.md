# F64 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F64-S01 | User selects runtime with existing session root | Import preview is absent despite evidence | Covered by ready preview test | Browser smoke detail row | Passed | F64 spec |
| F64-S02 | User selects runtime with missing session roots | UI implies import can run | Covered by blocked preview test | Browser smoke blocked-capable detail text | Passed | F64 spec |
| F64-S03 | Runtime does not support sessions | Preview looks actionable | Covered by unsupported preview test | Manual/browser smoke not separately needed; route smoke passed | Passed | F64 spec |
| F64-S04 | Malformed row includes transcript or secret-like data | Preview leaks private history or keys | Covered by displayable JSON exclusion test | Browser fixture text check | Passed | ADR-004 |
| F64-S05 | Detail model renders Session group | Detail panel drifts from preview helper | Covered by group details test | Browser smoke `/integrations-hub/agent-runtime` | Passed | F64 spec |

## Unit Test Backlog

- `.project-manager/features/F64/tests/agentRuntimeSessionImportPreview.test.ts`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm the
  Session group still renders with import preview details and no console errors.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
