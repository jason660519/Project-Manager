# F77 Dev Log - Agent Runtime Native Redacted Session Target Lister

## 2026-06-23 - Kickoff

### Context

F76 introduced a redacted target selector for optional payload metadata. F77
adds the native metadata-only lister that can produce those candidates later in
the inventory flow.

### Design Decision

Use a separate approved lister request rather than overloading the F69 reader
request. The lister never reads file content. It returns internal `targetPath`
for execution and redacted display labels/summaries for UI.

### Planned Work

1. Write focused TS Red tests for bridge/capability wiring.
2. Write Rust unit Red tests for native lister behavior.
3. Implement Rust structs/helper/command plus permission/capability.
4. Implement TS bridge wrapper and types.
5. Run focused TS, focused cargo, F64-F77 regression, route smoke, and baseline.

### Verification Log

- Red TS: focused F77 suite failed because `listAgentRuntimeRedactedSessionTargets` and permission file were missing.
- Red Rust: focused F77 cargo test failed because `AgentRuntimeSessionTargetListRequest` and `list_agent_runtime_redacted_session_targets_from_request` were missing.
- Green TS: focused F77 suite passed 2/2.
- Green Rust: `cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_target_lister -- --nocapture` passed 2/2.
- Regression: F64-F77 Agent Runtime regression suite passed 47/47 across 12 files.
- Passed: `npm run typecheck`.
- Passed: `npm run docs:check`.
- Passed: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Passed: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` with Next dev Issues 0.
- Passed: Playwright Chromium smoke on `/integrations-hub/agent-runtime`; selected Codex CLI, found parser panel, sensitive fixture strings absent, console/page errors 0.
- Passed: `npm run verify:baseline`; Vitest 253 files, 1596 passed, 1 skipped; cargo check passed; build passed.

### Implementation Notes

- Added `list_agent_runtime_redacted_session_targets` native command and typed
  `listAgentRuntimeRedactedSessionTargets` bridge wrapper.
- Added `list-agent-runtime-redacted-session-targets` permission and default
  capability entry.
- Native lister scans approved roots for file metadata only, skips hidden entries
  and directories, bounds max targets/depth, and returns redacted labels/summaries.

### Remaining Risks

- F77 exposes the native lister bridge but does not yet hydrate Integration Hub
  rows with its results. F78 should connect inventory refresh to the lister and
  feed F76 `sessionTargets`.
- The native result includes internal `targetPath` for execution; UI display code
  must continue using redacted `label` / `summary` fields only.
