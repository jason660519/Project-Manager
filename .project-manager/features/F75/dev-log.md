# F75 Dev Log - Agent Runtime Session Envelope UI Execute Flow

## 2026-06-23 - Kickoff

### Context

F74 completed the pure executor boundary. F75 moves that boundary into the
Agent Runtime detail UI while preserving explicit approval, no transcript
display, and no raw component `invoke()` calls.

### Design Decision

Use a parent-injected executor callback. The detail sheet builds a F73 parse
action from row evidence plus UI approval/target state, then passes it upward.
The Integration Hub parent wires that callback to F74 plus the existing bridge
wrapper.

### Planned Work

1. Add focused tests for helper and UI guarded execution.
2. Confirm Red.
3. Implement minimal helper, props, UI controls, and parent wiring.
4. Run focused and F64-F75 regression tests.
5. Run typecheck, docs, route health, browser smoke, and baseline.

### Verification Log

- Red: Focused F75 suite failed 4/4 because the UI parse helper and redacted parser region did not exist.
- Green: Added row-to-parse-action helper, guarded detail-panel controls, injected executor prop, and parent wiring; focused F75 suite passed 4/4.
- Regression: F64-F75 Agent Runtime regression suite passed 42/42 across 10 files.
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Passed: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` with Next dev Issues 0.
- Passed: Playwright Chromium smoke on `/integrations-hub/agent-runtime`; selected Codex CLI, found redacted parser controls, confirmed parser remains disabled when the live row has no existing session root or selected target, sensitive fixture strings absent, console/page errors 0.
- Passed: `npm run verify:baseline`; Vitest 251 files, 1591 passed, 1 skipped; cargo check passed; build passed.

### Implementation Notes

- `IntegrationsDetailSheet` builds a F73 parse action but delegates execution to
  an injected callback.
- `PluginsHubView` wires the callback to F74
  `executeAgentRuntimeSessionEnvelopeParseAction` and the existing
  `readAgentRuntimeRedactedSessionEnvelope` bridge wrapper.
- The detail panel displays action readiness and execution summaries only; thrown
  executor errors are replaced with a fixed redacted blocked message.

### Remaining Risks

- The first UI slice uses a manual target path. F76 should add safe session
  target discovery / selection so users do not need to paste paths.
- The live local smoke row did not have an existing session root, so focused
  component tests provide the ready execution evidence while browser smoke
  validates the real blocked state.
