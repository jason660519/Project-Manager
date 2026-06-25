# F76 Dev Log - Agent Runtime Redacted Session Target Selector

## 2026-06-23 - Kickoff

### Context

F75 added a guarded UI execution flow but still relies on pasted full target
paths. F76 adds display-safe target options when candidate metadata already
exists, without adding file discovery or displaying filenames.

### Design Decision

Represent candidates as internal target paths with redacted UI labels. The UI
may use the target path to execute through F75/F74, but visible text must only
include redacted labels and aggregate metadata.

### Planned Work

1. Write focused Red tests for mapper and UI selector behavior.
2. Implement target option mapper and redacted selector.
3. Preserve F75 manual input fallback.
4. Run focused and F64-F76 regression tests.
5. Run typecheck, docs, route health, browser smoke, and baseline.

### Verification Log

- Red: Focused F76 suite failed because the target option helper and selector UI were missing.
- Green: Added redacted session target option mapping and selector UI; focused F76 suite passed 3/3.
- Regression: F64-F76 Agent Runtime regression suite passed 45/45 across 11 files.
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Passed: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` with Next dev Issues 0.
- Passed: Playwright Chromium smoke on `/integrations-hub/agent-runtime`; selected Codex CLI, found parser panel, confirmed live row uses manual fallback when no redacted candidates exist, sensitive fixture strings absent, console/page errors 0.
- Passed: `npm run verify:baseline`; Vitest 252 files, 1594 passed, 1 skipped; cargo check passed; build passed.

### Implementation Notes

- `buildAgentRuntimeRedactedSessionTargetOptions` accepts optional
  `sessionTargets` payload metadata, filters invalid/outside-root entries, and
  returns redacted labels plus internal target paths.
- `IntegrationsDetailSheet` renders a redacted selector only when candidates
  exist; without candidates it keeps the F75 manual target path input.
- Option labels and summaries never include target filenames or candidate
  transcript/tool-argument fields.

### Remaining Risks

- F76 consumes optional `sessionTargets` metadata but does not discover targets
  natively. F77 should add a native metadata-only target lister with redacted
  names and bridge/capability coverage.
- Browser smoke used the live fallback path because the current local row did
  not include `sessionTargets`; focused component tests cover the candidate
  selector path.
