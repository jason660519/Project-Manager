# F68 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F68-S01 | User approves a reviewed dry run | Future reader request bypasses approval or loses roots | Unit test approved reader request | Browser smoke detail row | Passed | F68 spec |
| F68-S02 | User has not approved yet | UI implies import can execute | Unit test needs-approval state | Browser detail smoke | Passed | F68 spec |
| F68-S03 | Browser fallback lacks counts | Approval implies 0 artifacts | Unit test unknown-count request | Browser fallback smoke | Passed | F68 spec |
| F68-S04 | Import is blocked | Reader request is still produced | Unit test blocked approval | Browser route smoke | Passed | F68 spec |
| F68-S05 | Runtime does not support sessions | Unsupported runtime looks executable | Unit test unsupported approval | Detail model smoke | Passed | F68 spec |
| F68-S06 | Malformed dry run includes filenames/transcripts/secrets | Approval output leaks private data | Unit test displayable JSON exclusion | Browser fixture text check | Passed | ADR-004 |
| F68-S07 | Detail model renders Session group | UI duplicates approval logic | Unit/detail model test | `/integrations-hub/agent-runtime` | Passed | F68 spec |

## Unit Test Backlog

- `.project-manager/features/F68/tests/agentRuntimeSessionImportApproval.test.ts`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm Session
  group renders approval-boundary copy with console/page errors 0.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
