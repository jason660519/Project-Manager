# F73: Agent Runtime Approved Session Envelope Parse Action

## Purpose

F71 can parse a bounded approved session target natively, and F72 can display
aggregate-only results. F73 adds the missing action contract in between: a safe,
testable way to build the parser request only after the user has reviewed the
dry run, approved reading, and selected one target.

The UI slice surfaces this guarded state in the Agent Runtime Session detail
group before F74 adds the actual picker/call flow.

## Background

- F68 creates an approval-gated reader request with approved root paths only.
- F69/F70/F71 enforce native reader, redacted content, and redacted envelope
  boundaries.
- F72 displays aggregate envelope metadata when it already exists.
- No current helper connects a user-selected target to the F71 parser without
  duplicating approval checks.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want parsing a session envelope to require an explicit approved action rather than happen automatically. |
| US-02 | As a maintainer, I want one helper to build the F71 request so future UI code does not duplicate approval and redaction rules. |
| US-03 | As a security-minded user, I want summaries and logs to avoid selected filenames, transcript text, tool arguments, and raw secrets. |

## Functional Requirements

- Register F73 in Development Progress on the Project Progress Dashboard.
- Add `buildAgentRuntimeSessionEnvelopeParseAction(...)` as a pure helper.
- Show the guarded parse-action state in Agent Runtime Session detail UI.
- Return `ready`, `needs_approval`, `blocked`, or `unsupported`.
- Produce an `AgentRuntimeSessionBoundaryRequest` only when:
  - the F68 approval status is `approved`;
  - the approval has a reader request;
  - the user explicitly confirms parse execution;
  - a non-empty target path is provided;
  - the byte limit is positive and finite.
- Preserve approved root paths from the approval boundary.
- Keep display summaries target-name-redacted.

## Technical Requirements

- Reuse existing `AgentRuntimeSessionImportApproval` and bridge request types.
- Keep this slice pure TypeScript; no React state and no native invocation.
- Export the helper and types from `lib/agent-runtime/index.ts`.
- Wire the helper through `lib/integrations/mappers/agent-runtime-detail.ts`.
- Add focused tests under `.project-manager/features/F73/tests/`.
- Do not add schemaVersion changes.

## Acceptance Criteria

1. F73 appears in Development Progress with canonical artifact paths.
2. Focused tests cover ready, unapproved, missing target, invalid max bytes,
   unsupported/blocked, and security display-output cases.
3. Ready action returns a parser request with `approved: true`, approved root
   paths, selected target path, and max bytes.
4. Non-ready action returns no parser request and explicit blocked reasons.
5. Displayable action JSON excludes transcript text, target filenames, tool
   arguments, and secret-like fixture strings.
6. Regression tests for F64-F73 remain green.
7. `/integrations-hub/agent-runtime` detail smoke shows the guarded parse-action
   copy with no console/page errors.

## Open Decisions

- 2026-06-23: F73 intentionally does not add file selection UI. A later slice
  can add an explicit picker and call `readAgentRuntimeRedactedSessionEnvelope`
  through the typed bridge.
