# F75 TDD Specification

## Test Strategy

- Unit: pure action-building helper for a row + UI approval/target input.
- Component integration: `IntegrationsDetailSheet` renders guarded controls and
  calls the injected executor only when ready.
- Regression: F64-F75 Agent Runtime tests stay green.
- E2E smoke: `/integrations-hub/agent-runtime` route health and browser smoke.

## Scenarios

| ID | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| F75-S01 | Normal | Agent Runtime row has sessions root, approval checked, target path entered | User clicks parse | Injected executor receives one ready parse action; UI shows redacted aggregate summary |
| F75-S02 | Permission | Approval checkbox is not checked | User views panel | Parse button stays disabled; callback is not called; needs-approval reason is visible |
| F75-S03 | Boundary | Approval checked but target path empty | User views panel | Parse button stays disabled; target-required reason is visible |
| F75-S04 | Error | Injected executor rejects with unsafe error text | User clicks parse | UI shows generic redacted failure text without unsafe strings |
| F75-S05 | Native blocked | Injected executor returns blocked summary | User clicks parse | UI shows blocked summary and no transcript content |
| F75-S06 | Unsupported | Row does not advertise sessions support | User views panel | Action remains unavailable and parser is never called |

## Acceptance Criteria

- Focused F75 test file passes.
- F64-F75 Agent Runtime regression passes.
- `npm run typecheck` passes.
- `npm run docs:check` passes.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passes.
- Browser smoke confirms required Agent Runtime copy is visible, console/page
  errors are 0, and known unsafe fixture strings are absent from result output.
- `npm run verify:baseline` passes.

## Red / Green / Refactor Tracking

- Red: `npm test -- --run .project-manager/features/F75/tests/agentRuntimeSessionEnvelopeUiExecuteFlow.test.ts` failed 4/4 because `buildAgentRuntimeSessionEnvelopeUiParseAction` and the redacted parser UI region were missing.
- Green: focused F75 suite passed with 4 tests covering ready action construction, permission + boundary disabled states, injected executor call, redacted thrown errors, and blocked summaries.
- Regression: F64-F75 Agent Runtime regression suite passed with 42 tests across 10 files.
- Static checks: `npm run typecheck` passed; `npm run docs:check` passed.
- UI smoke: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed; Playwright Chromium route smoke confirmed guarded parser controls, disabled blocked state, and console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 251 files, 1591 passed, 1 skipped; cargo check passed; build passed.
