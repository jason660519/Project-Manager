# F71 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F71-S01 | Approved JSON array session | Parser leaks message text | Rust array envelope test | Native smoke | Passed | F71 spec |
| F71-S02 | Approved JSON object with messages | Nested messages are ignored | Rust object envelope test | Native smoke | Passed | F71 spec |
| F71-S03 | Request is not approved | Parser bypasses F70 boundary | Rust blocked approval test | Native smoke | Passed | F70/F71 spec |
| F71-S04 | Content contains secrets/prompts/tool args | Response leaks sensitive strings | Rust serialized response test | Native smoke | Passed | ADR-004 |
| F71-S05 | Renderer calls bridge wrapper | Command name/capability drifts | TS bridge/capability test | Baseline | Passed | Bridge discipline |
| F71-S06 | Agent Runtime route renders | Previous detail copy regresses | F64-F70 regression tests | `/integrations-hub/agent-runtime` | Passed | F71 spec |

## Unit Test Backlog

- `.project-manager/features/F71/tests/agentRuntimeRedactedSessionEnvelopeParser.test.ts`
- Rust focused tests in `src-tauri/src/lib.rs`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm existing
  Session import copy still renders with console/page errors 0.
- Native parser tests cover array/object messages, boundary reuse, role counts,
  tool-call count, and leakage exclusions.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
