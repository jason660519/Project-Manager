# F38 Test Scenarios

## Purpose

Map real user paths and implementation risks to unit, integration, and manual verification candidates for the Quick-Validate Panel.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F38-S01 | User submits empty key | Silent failure or network call fired | Unit: assert no fetch + inline error | Manual: check empty submit | Candidate | Kickoff |
| F38-S02 | User pastes key with wrong format | Wrong error message or silent pass | Unit: mock validatePattern fail | Manual: paste bad key | Candidate | Kickoff |
| F38-S03 | User validates a real valid key | API returns ok:false or no models shown | Unit: mock fetch ok:true + model list | Manual: real Anthropic key | Candidate | Kickoff |
| F38-S04 | API returns invalid-key error | Error string not shown or swallowed | Unit: mock ok:false + errorReason | Manual: expired key | Candidate | Kickoff |
| F38-S05 | Request times out (15 s) | No user feedback or hang | Unit: mock AbortError | Manual: disconnect network | Candidate | Kickoff |
| F38-S06 | Network error (offline) | Raw exception leaks to UI | Unit: mock TypeError | Manual: disable network | Candidate | Kickoff |
| F38-S07 | Provider switch resets state | Previous result bleeds into new provider | Unit: simulate switch + assert reset | Manual: switch provider | Candidate | Kickoff |
| F38-S08 | Existing provider table unaffected | Panel regresses table render | Unit: table still renders with same props | Manual: scroll table | Regression | Kickoff |

## Test Data Rules

- Do NOT use real API keys in unit tests — mock `fetch` or the bridge call.
- Use `sk-ant-test000000000000000000000000000000000000000000000` as Anthropic fixture key (passes format check but is not real).
- No `.env` imports; tests are fully hermetic.

## Unit Test Backlog

- `ApiKeyValidationSheet` renders QuickValidatePanel with correct initial state.
- `QuickValidatePanel` blocks submit when key is empty.
- `QuickValidatePanel` shows format error when key fails `validatePattern`.
- `QuickValidatePanel` fires fetch with correct body on valid input.
- `QuickValidatePanel` shows success badge when API returns `ok: true`.
- `QuickValidatePanel` shows error message when API returns `ok: false`.
- `QuickValidatePanel` shows timeout message on AbortError.
- `QuickValidatePanel` shows network error message on TypeError.

## Conversion Rule

When debugging reveals a new real user path, append a row before the fix and map it to unit or manual verification.
