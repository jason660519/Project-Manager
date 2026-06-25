# F70 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F70-S01 | Approved request reads JSON object | Raw transcript leaks | Rust ready object test | Native smoke | Passed | F70 spec |
| F70-S02 | Approved request reads JSON array | Shape detection wrong | Rust ready array test | Native smoke | Passed | F70 spec |
| F70-S03 | Request is not approved | Reader bypasses F69 boundary | Rust blocked approval test | Native smoke | Passed | F69/F70 spec |
| F70-S04 | Target exceeds max bytes | Large transcript is read/exposed | Rust max-byte guard test | Native smoke | Passed | F70 spec |
| F70-S05 | Content contains secrets/prompts/filenames | Response leaks sensitive strings | Rust serialized response test | Native smoke | Passed | ADR-004 |
| F70-S06 | Renderer calls bridge wrapper | Command name/capability drifts | TS bridge/capability test | Baseline | Passed | Bridge discipline |
| F70-S07 | Agent Runtime route renders | Previous detail copy regresses | F64-F69 regression tests | `/integrations-hub/agent-runtime` | Passed | F70 spec |

## Unit Test Backlog

- `.project-manager/features/F70/tests/agentRuntimeRedactedSessionContentReader.test.ts`
- Rust focused tests in `src-tauri/src/lib.rs`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm existing
  Session import copy still renders with console/page errors 0.
- Native redacted reader tests cover approval, root containment via F69, size
  guard, structural metadata, and leakage exclusions.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
