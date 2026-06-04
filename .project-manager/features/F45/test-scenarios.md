# F45 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F45-S01 | AI engineer makes docs-only changes and wants a quick pre-commit check | Full baseline wastes time or docs checks are skipped accidentally | `verify:quick` dry run / shell syntax check; docs runbook matrix | Not needed; CLI workflow | Planned | User request |
| F45-S02 | AI engineer changes TypeScript or UI and wants confidence before final PR | Type errors, hydration footguns, i18n/native-dialog regressions | `verify:quick` command path includes typecheck and static/client hygiene | Browser smoke remains required only for UI completion | Planned | Existing runbook |
| F45-S03 | AI engineer changes Rust/Tauri bridge code | Rust IPC break or bridge wrapper drift missed by docs-only checks | `verify:quick` command path includes cargo check and typecheck | Manual Tauri smoke remains required for shell behavior | Planned | CLAUDE bridge rules |
| F45-S04 | AI engineer changes schema or storage contract | Narrow checks miss migration/build/test regressions | `verify:quick` escalates to `verify:baseline` | Optional manual config load smoke | Planned | ADR-002 |
| F45-S05 | Maintainer lands PR after local quick checks passed | Quick checks are mistaken for release readiness | Ship docs and runbook require one full `verify:baseline` after syncing main | CI baseline on PR/main | Planned | Ship skill |
| F45-S06 | Standards owner wants recurring governance visibility | Company Standards advisory drift blocks unrelated local commits | Docs identify scheduled governance candidates and non-replacement rule | Company Standards dashboard/report follow-up | Planned | User request |

## Unit Test Backlog

- Add shell syntax check for `scripts/verify-quick.sh`.
- Add dry-run mode if command classification becomes complex enough to unit test.
- Keep `scripts/verify-baseline.sh` unchanged except for references if possible.

## E2E Candidate Backlog

- No new browser E2E is required for this workflow-only slice.
- UI smoke is still required for future work that changes Project Dashboard,
  Development sheet, or Company Standards screens.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
