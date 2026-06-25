# F74: Agent Runtime Session Envelope Parse Executor Boundary

## Purpose

F73 builds a safe parse action request but does not execute it. F74 adds a pure,
injectable executor boundary so future UI can call the F71 native parser through
the typed bridge without duplicating readiness checks or leaking raw session
content.

## Background

- F71 provides `readAgentRuntimeRedactedSessionEnvelope(...)` through the bridge.
- F72 turns aggregate parser results into safe summary copy.
- F73 builds a parser request only after approval, explicit confirmation, target
  path, and byte limit checks.
- The app still needs one reusable executor that refuses non-ready actions and
  maps parser output to display-safe result state.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want parse execution to run only after the approved action contract is ready. |
| US-02 | As a maintainer, I want future UI code to inject the typed parser instead of calling bridge logic ad hoc. |
| US-03 | As a security-minded user, I want parse results to show aggregate summaries only, never transcript text or target filenames. |

## Functional Requirements

- Register F74 in Development Progress on the Project Progress Dashboard.
- Add `executeAgentRuntimeSessionEnvelopeParseAction(...)` as a pure async helper.
- Accept a F73 parse action and an injected parser function.
- If action is not `ready` or has no request, return blocked result and do not
  call parser.
- If action is ready, call parser exactly once with the action request.
- Return parser status, redacted summary, blocked reasons, and the parser result.
- Convert thrown parser errors into blocked results without exposing raw target
  names.

## Technical Requirements

- Reuse F72 `buildAgentRuntimeSessionEnvelopeSummary(...)`.
- Reuse bridge-compatible parser result/request types.
- Export helper/types from `lib/agent-runtime/index.ts`.
- Keep tests in `.project-manager/features/F74/tests/`.
- Do not add schemaVersion changes.

## Acceptance Criteria

1. F74 appears in Development Progress with canonical artifact paths.
2. Ready action invokes parser once and returns aggregate summary.
3. Non-ready action does not invoke parser.
4. Parser blocked result is preserved and summarized.
5. Parser throw is converted to blocked executor result.
6. Displayable executor output excludes transcript text, target filenames, tool
   arguments, and secret-like fixture strings.
7. F64-F74 regression tests remain green.

## Open Decisions

- 2026-06-23: F74 remains pure and injectable. The UI picker/bridge wiring will
  be a later slice so execution and interaction can each be reviewed cleanly.
