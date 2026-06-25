# F77 TDD Specification

## Test Strategy

- Unit TS: bridge wrapper fallback and static capability/permission wiring.
- Rust unit: approved root listing, blocked requests, redaction, and limits.
- Regression: F64-F77 Agent Runtime tests remain green.
- UI smoke: existing `/integrations-hub/agent-runtime` parser panel still opens.

## Scenarios

| ID | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| F77-S01 | Normal | Approved request with existing root containing session files | List targets | Ready result returns redacted target options with internal target paths |
| F77-S02 | Boundary | Request is not approved | List targets | Blocked result and no targets |
| F77-S03 | Boundary | maxTargets or maxDepth invalid | List targets | Blocked result and no filesystem scan |
| F77-S04 | Security | Filename contains `session-a.json` and file contains private text | List targets | Label/summary omit filename and content |
| F77-S05 | Permission | Tauri command is added | Inspect capability | default capability includes permission; permission file allows command |
| F77-S06 | Fallback | Renderer calls wrapper outside Tauri | Call wrapper | Blocked fallback result explains Tauri requirement |

## Acceptance Criteria

- Focused F77 TS tests pass.
- Focused Rust tests for F77 pass.
- F64-F77 Agent Runtime regression passes.
- `npm run typecheck` passes.
- `npm run docs:check` passes.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passes.
- Browser smoke confirms no console/page errors.
- `npm run verify:baseline` passes before completion.

## Red / Green / Refactor Tracking

- Red: Focused TS suite failed because `listAgentRuntimeRedactedSessionTargets` and permission file were missing; focused Rust suite failed because `AgentRuntimeSessionTargetListRequest` and native helper were missing.
- Green: focused F77 TS suite passed 2/2; focused Rust target lister suite passed 2/2.
- Regression: F64-F77 Agent Runtime regression suite passed with 47 tests across 12 files.
- Static checks: `npm run typecheck` passed; `npm run docs:check` passed; `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- UI smoke: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed; Playwright Chromium route smoke confirmed parser panel and console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 253 files, 1596 passed, 1 skipped; cargo check passed; build passed.
