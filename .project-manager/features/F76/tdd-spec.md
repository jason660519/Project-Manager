# F76 TDD Specification

## Test Strategy

- Unit: target candidate mapper filters unsafe/malformed candidates and produces
  redacted display fields.
- Component integration: parser panel renders a redacted select when candidates
  exist and calls the injected executor with the selected internal target path.
- Regression: F64-F76 Agent Runtime suites remain green.
- E2E smoke: `/integrations-hub/agent-runtime` still renders without dev issues.

## Scenarios

| ID | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| F76-S01 | Normal | Payload has valid candidates under an existing sessions root | Build options | Options contain redacted labels and internal target paths |
| F76-S02 | Boundary | Candidate is outside approved roots or malformed | Build options | Candidate is omitted |
| F76-S03 | Permission | Candidate selected but approval unchecked | Render panel | Parse button remains disabled |
| F76-S04 | Normal UI | Candidate selected and approval checked | Click parse | Injected executor receives selected internal target path |
| F76-S05 | Security | Candidate path contains filename and secret-like fixture text exists nearby | Render panel | Display text does not contain filename, transcript text, tool args, or secret-like strings |
| F76-S06 | Fallback | No candidates exist | Render panel | Manual target path input remains available |

## Acceptance Criteria

- Focused F76 tests pass.
- F64-F76 regression tests pass.
- `npm run typecheck` passes.
- `npm run docs:check` passes.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passes.
- Browser smoke confirms parser panel renders and unsafe fixture strings are not
  displayed.
- `npm run verify:baseline` passes before completion.

## Red / Green / Refactor Tracking

- Red: `npm test -- --run .project-manager/features/F76/tests/agentRuntimeRedactedSessionTargetSelector.test.ts` failed because `buildAgentRuntimeRedactedSessionTargetOptions` and the redacted selector UI were missing.
- Green: focused F76 suite passed with 3 tests covering redacted option mapping, invalid/outside-root filtering, selector execution, and manual fallback.
- Regression: F64-F76 Agent Runtime regression suite passed with 45 tests across 11 files.
- Static checks: `npm run typecheck` passed; `npm run docs:check` passed.
- UI smoke: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed; Playwright Chromium route smoke confirmed parser panel fallback state and console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 252 files, 1594 passed, 1 skipped; cargo check passed; build passed.
