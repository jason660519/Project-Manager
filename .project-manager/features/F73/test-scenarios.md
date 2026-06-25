# F73 Test Scenarios

## Purpose

Map the explicit approved envelope parse action into unit, regression, and route
smoke checks.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F73-S01 | User approves dry run and confirms parsing one target | Parser request is never created | Focused ready action test | Future picker smoke | Passed | F73 spec |
| F73-S02 | User has not approved transcript reading | Parser bypasses approval | Focused needs-approval test | Detail route smoke | Passed | F68/F73 |
| F73-S03 | Target path is missing | Parser is called without a target | Focused missing-target test | Future picker smoke | Passed | F73 spec |
| F73-S04 | Max byte limit is invalid | Parser can read unbounded content | Focused invalid-byte test | None | Passed | F69/F73 |
| F73-S05 | Approval is blocked or unsupported | Blocked workflow appears executable | Focused blocked/unsupported test | Detail route smoke | Passed | F68-F73 |
| F73-S06 | Fixture includes transcript/secret/filename/tool args | Display output leaks private data | Focused display JSON exclusion test | Browser fixture check | Passed | ADR-004 |
| F73-S07 | User opens Agent Runtime detail UI | Parse action state is invisible before F74 | Focused detail-model test | Route smoke | Passed | F73 UI |

## Test Assets

- `.project-manager/features/F73/tests/agentRuntimeSessionEnvelopeParseAction.test.ts`

## Manual Notes

- The route smoke confirms the existing Agent Runtime evidence panel still
  renders and now includes `Session envelope parse action:`.
- F73 does not add a user-visible parse button yet.
