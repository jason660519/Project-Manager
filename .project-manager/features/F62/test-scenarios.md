# F62 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F62-S01 | User selects a ready Agent Runtime row | Detail sheet omits actionable readiness evidence | Covered by detail model readiness groups | Browser smoke after selecting `Codex CLI` | Passed | F62 spec |
| F62-S02 | User selects a partial/missing runtime row | UI implies success despite missing MCP / Skills / Session / Cost evidence | Covered by missing group states | Browser smoke covered missing browser-preview evidence | Passed | F62 spec |
| F62-S03 | Scanner returns warnings or diagnostics | Troubleshooting evidence is hidden in table badges only | Covered by warning/diagnostic preservation | Browser smoke covered diagnostic-capable panel rendering | Passed | F62 spec |
| F62-S04 | Payload accidentally includes secret-like fields | Renderer exposes file contents or credentials | Covered by displayable model exclusion test | Browser text check for fixture secret strings | Passed | ADR-004 |

## Unit Test Backlog

- `.project-manager/features/F62/tests/agentRuntimeDetailPanel.test.ts`

## E2E Candidate Backlog

- `/integrations-hub/agent-runtime`: select an Agent Runtime row and confirm
  detail content renders without Next dev issues or console/page errors.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
