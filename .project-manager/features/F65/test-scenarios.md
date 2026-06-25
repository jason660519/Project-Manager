# F65 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F65-S01 | User previews runtime with populated session root | Root looks importable but artifact availability is unknown | Covered by scanner + preview count propagation test | Browser smoke detail row | Passed | F65 spec |
| F65-S02 | User previews runtime from older snapshot | UI crashes or shows false zero count | Covered by count omitted compatibility test | Browser fallback smoke | Passed | F65 spec |
| F65-S03 | Native root has nested files | Count suggests recursive parsing happened | Covered by Rust shallow count only test | Not needed | Passed | F65 spec |
| F65-S04 | Malformed snapshot includes counts for non-session/secret paths | Secret/config metadata leaks into preview | Covered by session-only count propagation test | Browser fixture text check | Passed | ADR-004 |
| F65-S05 | Detail panel renders preview details | Group details layout breaks with count text | Covered by focused regression plus browser smoke | `/integrations-hub/agent-runtime` | Passed | F65 spec |

## Unit Test Backlog

- `.project-manager/features/F65/tests/agentRuntimeSessionRootChildCounts.test.ts`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select a runtime row and confirm the
  Session import preview still renders with console/page errors 0.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
