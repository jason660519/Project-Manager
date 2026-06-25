# F67 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F67-S01 | User previews a counted runtime before import | Dry run hides what would be considered | Unit test ready dry-run plan | Browser smoke detail row | Passed | F67 spec |
| F67-S02 | Browser fallback lacks counts | Dry run implies 0 artifacts | Unit test unknown-count summary | Browser fallback smoke | Passed | F67 spec |
| F67-S03 | Import is blocked | Dry run looks executable | Unit test blocked dry run | Browser route smoke | Passed | F67 spec |
| F67-S04 | Runtime does not support sessions | Unsupported runtime looks importable | Unit test unsupported dry run | Detail model smoke | Passed | F67 spec |
| F67-S05 | Malformed preview includes filenames/transcripts/secrets | Dry-run output leaks private data | Unit test displayable JSON exclusion | Browser fixture text check | Passed | ADR-004 |
| F67-S06 | Detail model renders Session group | UI duplicates dry-run logic | Unit/detail model test | `/integrations-hub/agent-runtime` | Passed | F67 spec |

## Unit Test Backlog

- `.project-manager/features/F67/tests/agentRuntimeSessionImportDryRun.test.ts`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm Session
  group renders dry-run copy with console/page errors 0.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
