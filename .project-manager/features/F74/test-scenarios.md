# F74 Test Scenarios

## Purpose

Map approved envelope parse execution into focused tests and route smoke checks.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F74-S01 | Ready action executes parser | Parser result is ignored | Focused ready executor test | Future picker smoke | Planned | F74 spec |
| F74-S02 | Action is not ready | Parser bypasses approval guard | Focused no-call tests | Detail route smoke | Planned | F73/F74 |
| F74-S03 | Parser returns blocked | UI implies successful parse | Focused blocked parser test | Future parser smoke | Planned | F71/F74 |
| F74-S04 | Parser throws | Error leaks target filename | Focused thrown-error test | Future parser smoke | Planned | ADR-004 |
| F74-S05 | Fixture includes transcript/secret/filename/tool args | Display output leaks private data | Focused display JSON exclusion test | Browser fixture check | Planned | ADR-004 |

## Test Assets

- `.project-manager/features/F74/tests/agentRuntimeSessionEnvelopeParseExecutor.test.ts`

## Manual Notes

- The route smoke confirms the existing Agent Runtime evidence panel and F73
  parse-action copy still render. F74 does not add a visible parse button yet.
