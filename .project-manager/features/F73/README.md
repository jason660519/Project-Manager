# F73 - Agent Runtime Approved Session Envelope Parse Action

## Summary

Define the explicit action contract that turns an approved session import
boundary plus one user-selected session target into an F71 redacted envelope
parser request. The slice keeps parsing opt-in and approval-gated; it does not
scan directories, list filenames, or render transcript content.

## Current State

- Status: completed
- Progress: 100%
- Phase: completed
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Add a pure TypeScript helper for building a parser action plan.
- Surface the guarded parse-action state in Agent Runtime Session detail UI.
- Require an approved F68 reader request and explicit parse confirmation.
- Require a caller-provided target path and max byte limit.
- Return display-safe summaries that avoid target filenames and transcript
  content.
- Add focused tests before implementation and record Red/Green evidence.

## Non-Goals

- Directory browsing or automatic target discovery.
- Calling the F71 native parser from React.
- Reading or rendering session contents.
- Persisting parsed envelope results.
- Broad UI changes.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Completion Evidence

- Focused F73 tests: 7 passed, 0 failed.
- F64-F73 Agent Runtime regression tests: 43 passed, 0 failed.
- Typecheck and docs check: passed.
- UI route health: `/integrations-hub/agent-runtime` Next dev Issues 0.
- Browser smoke: Codex CLI detail rendered existing Session import copy and `Session envelope parse action:` with console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 249 files, 1581 tests passed, 1 skipped; cargo check and build passed.
