# F17 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F17-S01 | User opens the affected route or workflow | Blank shell, hidden error, or stale state | Add focused render or behavior test | Browser smoke for affected route | Candidate | Kickoff |
| F17-S02 | User repeats the main action | Duplicate write or stale UI | Add regression test around state update | Manual repeat-action smoke | Candidate | Kickoff |
| F17-S03 | User encounters missing data or permissions | UI implies success when blocked | Add empty/error-state test | Manual blocked-state smoke | Candidate | Kickoff |

## Unit Test Backlog

- Add focused tests once implementation files are known.

## E2E Candidate Backlog

- Add browser/Tauri smoke for the primary user path if the feature touches navigation, xmux, dispatch, keys, or file-system behavior.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
