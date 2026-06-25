# F69 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F69-S01 | Approved request targets in-root file | Boundary returns content or filename | Rust ready-response test | Native smoke | Passed | F69 spec |
| F69-S02 | Request is not approved | Reader boundary bypasses approval | Rust blocked approval test | Native smoke | Passed | F68/F69 spec |
| F69-S03 | Target escapes allowlisted root | Path traversal reads unrelated file | Rust root-containment test | Native smoke | Passed | F69 spec |
| F69-S04 | Target exceeds max bytes | Large transcript is exposed | Rust max-byte guard test | Native smoke | Passed | F69 spec |
| F69-S05 | Target missing or not a file | UI implies reader succeeded | Rust metadata blocked test | Native smoke | Passed | F69 spec |
| F69-S06 | Renderer calls bridge wrapper | Command name/capability drifts | TS bridge/capability test | Baseline | Passed | Bridge discipline |
| F69-S07 | Agent Runtime route renders | Previous detail copy regresses | F64-F68 regression tests | `/integrations-hub/agent-runtime` | Passed | F69 spec |

## Unit Test Backlog

- `.project-manager/features/F69/tests/agentRuntimeSessionReaderBoundary.test.ts`
- Rust focused tests in `src-tauri/src/lib.rs`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm existing
  Session import copy still renders with console/page errors 0.
- Native boundary tests cover approval, root containment, size guard, and
  redacted metadata response.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
