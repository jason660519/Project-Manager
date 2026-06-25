# F66 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F66-S01 | User previews runtime with counted session roots | Count metadata is hidden | Unit test count-aware summary | Browser smoke detail row | Passed | F66 spec |
| F66-S02 | Browser fallback lacks counts | UI implies 0 artifacts | Unit test no-count summary | Browser fallback smoke | Passed | F66 spec |
| F66-S03 | Import is blocked | Preview copy is vague | Unit test blocked summary | Browser route smoke | Passed | F66 spec |
| F66-S04 | Malformed row includes filenames/transcripts/secrets | Preview leaks private data | Unit test displayable JSON exclusion | Browser fixture text check | Passed | ADR-004 |
| F66-S05 | Detail model renders Session group | UI duplicates copy logic | Unit/detail model test | `/integrations-hub/agent-runtime` | Passed | F66 spec |

## Unit Test Backlog

- `.project-manager/features/F66/tests/agentRuntimeCountAwareSessionPreview.test.ts`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm Session
  import preview detail renders with console/page errors 0.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
