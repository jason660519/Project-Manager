# F79 TDD Specification

## Test Strategy

- Unit/UI: render `IntegrationsDetailSheet` with Agent Runtime rows containing
  hydration diagnostics.
- Integration: F64-F79 Agent Runtime regression suite.
- UI smoke: existing `/integrations-hub/agent-runtime` route still opens, detail
  panel renders, Next dev Issues remains 0.

## Scenarios

| ID | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| F79-S01 | Normal | Agent Runtime row has `session_target_list_failed` diagnostic | Detail sheet renders | Diagnostic code and safe message are visible |
| F79-S02 | Boundary | Agent Runtime row has no diagnostics | Detail sheet renders | No hydration diagnostic block is shown |
| F79-S03 | Error | Diagnostic source came from thrown unsafe lister error | Detail sheet renders | Raw filename/API-key fixture strings are absent |
| F79-S04 | Permission | Native lister was blocked | Detail sheet renders | Message explains blocked metadata listing and manual fallback remains available |

## Acceptance Criteria

- Focused F79 tests pass.
- F64-F79 regression tests pass.
- `npm run typecheck` passes.
- `npm run docs:check` passes.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passes.
- Browser smoke confirms console/page errors 0.
- `npm run verify:baseline` passes before completion.

## Red / Green / Refactor Tracking

- Red: focused F79 suite failed 2/3 because `Session target diagnostics` dedicated region is not rendered yet.
- Green: focused F79 suite passed 3/3 after adding the dedicated session target diagnostics region.
- Regression: F64-F79 Agent Runtime regression suite passed 65/65 across 16 test files.
- Baseline: `npm run verify:baseline` passed with Vitest 255 files, 1603 passed, 1 skipped; cargo check and build passed.
