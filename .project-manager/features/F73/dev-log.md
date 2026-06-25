# F73 Dev Log - Agent Runtime Approved Session Envelope Parse Action

## 2026-06-23 - Kickoff

### Context

Feature checkpoint created before implementation so Development Progress,
specs, tests, and dev logs stay aligned on the Project Progress Dashboard.

### Planned Work

1. Confirm the approval-gated parse action boundary.
2. Write F73 specs and scenarios before implementation.
3. Write failing tests for ready, unapproved, missing target, invalid max bytes,
   blocked/unsupported, and security behavior.
4. Implement the pure helper and exports.
5. Run focused tests, F64-F73 regression tests, route health, browser smoke, and
   baseline; record evidence.

### Design Decision

F73 only builds the request contract. It does not browse directories, call the
native parser, or persist parser output. This keeps the first explicit action
slice reviewable and protects ADR-004 boundaries.

### Verification Log

- Red focused test: `npm test -- --run .project-manager/features/F73/tests/agentRuntimeSessionEnvelopeParseAction.test.ts` failed before implementation because `lib/agent-runtime/sessionEnvelopeParseAction.ts` did not exist.
- Green focused test: `npm test -- --run .project-manager/features/F73/tests/agentRuntimeSessionEnvelopeParseAction.test.ts` passed 6 tests after adding the helper and exports.
- Regression TS: `npm test -- --run F64-F73 Agent Runtime feature tests` passed 42 tests across 10 files.
- Typecheck: `npm run typecheck` passed.
- Docs: `npm run docs:check` passed.
- UI route health: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed with Next dev Issues 0.
- Browser smoke: Playwright Chromium opened `/integrations-hub/agent-runtime`, selected the Codex CLI row, rendered Agent Runtime Evidence and existing Session import copy, and confirmed fixture secrets/transcript text/filenames/tool args were absent with console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 249 files, 1580 tests passed, 1 skipped; cargo check and build passed.

## 2026-06-23 - UI Integration Update

### Context

User requested F73 enter the UI before moving to F74. The UI integration should
surface the guarded parse action state without adding target selection or
calling the native parser.

### Verification Log

- Red UI focused test: `npm test -- --run .project-manager/features/F73/tests/agentRuntimeSessionEnvelopeParseAction.test.ts` failed because Agent Runtime Session detail did not include `Session envelope parse action:`.
- Green UI focused test: `npm test -- --run .project-manager/features/F73/tests/agentRuntimeSessionEnvelopeParseAction.test.ts` passed 7 tests after wiring the mapper.
- Regression TS: `npm test -- --run F64-F73 Agent Runtime feature tests` passed 43 tests across 10 files after updating F68/F72 exact detail expectations.
- Typecheck: `npm run typecheck` passed.
- Docs: `npm run docs:check` passed.
- UI route health: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed with Next dev Issues 0.
- Browser smoke: Playwright Chromium opened `/integrations-hub/agent-runtime`, selected the Codex CLI row, rendered `Session envelope parse action:`, and confirmed fixture secrets/transcript text/filenames/tool args were absent with console/page errors 0.
- Baseline after UI integration: `npm run verify:baseline` passed; Vitest 249 files, 1581 tests passed, 1 skipped; cargo check and build passed.

### Implementation Notes

- Added `buildAgentRuntimeSessionEnvelopeParseAction(...)` as a pure TypeScript helper.
- The helper emits an F71-compatible `AgentRuntimeSessionBoundaryRequest` only
  when F68 approval is `approved`, parse confirmation is explicit, target path
  is present, and `maxBytes` is positive and finite.
- Display summaries redact the selected target name; the request still carries
  `targetPath` for the future typed bridge call.
- Wired Agent Runtime detail Session group to show the guarded parse-action
  summary after approval copy. This is display-only and never calls Tauri.
