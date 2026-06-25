# F72 Test Scenarios

## Purpose

Map aggregate-only session envelope display risks into focused tests and route
smoke checks.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F72-S01 | Ready aggregate envelope exists | UI hides useful parser result | Focused summary/helper test | Detail route smoke | Passed | F72 spec |
| F72-S02 | Aggregate envelope is absent | UI implies parser already ran | Focused no-envelope test | Detail route smoke | Passed | F72 spec |
| F72-S03 | Aggregate result is blocked | UI looks import-ready despite boundary block | Focused blocked summary test | Detail route smoke | Passed | F69-F72 |
| F72-S04 | Aggregate fixture contains transcript/secret/filename-like fields | Renderer-visible output leaks private data | Focused displayable JSON exclusion test | Browser fixture check | Passed | ADR-004 |
| F72-S05 | Session group already has preview/dry-run/approval copy | F72 overwrites previous workflow copy | F64-F72 regression tests | Route smoke | Passed | F64-F72 |

## Unit Test Backlog

- `.project-manager/features/F72/tests/agentRuntimeSessionEnvelopeSummary.test.ts`

## E2E Candidate Backlog

- Open `/integrations-hub/agent-runtime`, select a runtime row, and confirm the
  existing Agent Runtime Evidence panel and Session import copy still render.
- Confirm console/page errors are 0 and fixture strings such as transcript text,
  `OPENAI_API_KEY=bad`, and `session-a.json` are absent.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or
alongside the fix, then map it to focused tests or manual verification.
