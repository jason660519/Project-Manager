# F79 Dev Log - Agent Runtime Session Target Diagnostics UI

## 2026-06-23 - Kickoff

### Context

F78 attaches session target hydration diagnostics to Agent Runtime rows. F79
keeps that state visible and safe in the detail UI.

### Design Decision

Use the existing Agent Runtime diagnostics block instead of adding another panel.
The current mapper already normalizes `payload.diagnostics`, so the smallest
high-value slice is focused UI regression coverage plus any copy/safety hardening
needed by the tests.

### Planned Work

1. Write focused Red tests for safe diagnostic rendering and absence.
2. Implement the minimum detail UI/mapper change required by the tests.
3. Run focused and F64-F79 regression tests.
4. Run typecheck, docs, route health, browser smoke, and baseline.

### Verification Log

- Red: `npm test -- --run .project-manager/features/F79/tests/agentRuntimeSessionTargetDiagnosticsUi.test.tsx`
  failed 2/3 because the dedicated `Session target diagnostics` region was not rendered yet.
- Green: focused F79 suite passed 3/3 after adding the dedicated session target diagnostics region.
- Regression: F64-F79 targeted suite passed 65/65 across 16 test files.
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Passed: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`
  with Next dev Issues 0.
- Passed: Playwright browser smoke on `/integrations-hub/agent-runtime`; runtime
  rows and detail signal rendered, unsafe fixture strings absent, console/page
  errors 0.
- Passed: `npm run verify:baseline`; Vitest 255 files, 1603 passed, 1 skipped;
  cargo check passed; build passed.

### Implementation Notes

- Added a dedicated `Session target diagnostics` region inside
  `AgentRuntimeEvidencePanel`.
- `session_target_list_failed` messages are separated from generic diagnostics to
  avoid duplicate rendering and to make the fallback state easy to find.
- The region uses amber warning styling and states that manual session target
  path fallback remains available.
- Unsafe lister failure details remain redacted; focused tests assert fixture
  filenames, secret-like tokens, and transcript text do not appear.

### Remaining Risks

- The UI only renders diagnostics that already arrive on the row payload. Native
  target listing behavior remains owned by F77/F78.
- Existing generic diagnostics without `session_target_list_failed` continue to
  render in the original block.
