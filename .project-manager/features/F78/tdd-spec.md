# F78 TDD Specification

## Test Strategy

- Unit: hydration helper success, skip, blocked, and thrown lister cases.
- Integration: F64-F78 Agent Runtime regression suite.
- UI smoke: existing Agent Runtime route still opens and parser panel renders.

## Scenarios

| ID | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| F78-S01 | Normal | Row has existing sessions root and lister returns ready targets | Hydrate rows | Row payload gains `sessionTargets`; visible fields omit filenames |
| F78-S02 | Boundary | Row has no existing sessions root | Hydrate rows | Lister is not called; row remains unchanged |
| F78-S03 | Error | Lister returns blocked | Hydrate rows | Row remains; diagnostic records blocked reason |
| F78-S04 | Error | Lister throws unsafe message | Hydrate rows | Row remains; diagnostic uses redacted generic message |
| F78-S05 | Permission | Lister request is built | Inspect call | Request is approved and bounded by max targets/depth |
| F78-S06 | Security | Target path includes filename and fixture content | Serialize visible row fields | Filename/content/secret strings are absent |

## Acceptance Criteria

- Focused F78 tests pass.
- F64-F78 regression tests pass.
- `npm run typecheck` passes.
- `npm run docs:check` passes.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passes.
- Browser smoke confirms console/page errors 0.
- `npm run verify:baseline` passes before completion.

## Red / Green / Refactor Tracking

- Red: focused F78 suite failed 4/4 because `hydrateAgentRuntimeRowsWithSessionTargets` is not exported yet.
- Green: focused F78 suite passed 4/4 after adding hydration helper and Integration Hub wiring.
- Regression: F64-F78 Agent Runtime regression suite passed 62/62 across 15 test files.
- Baseline: `npm run verify:baseline` passed with Vitest 254 files, 1600 passed, 1 skipped; cargo check and build passed.
