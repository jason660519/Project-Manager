# F72: Agent Runtime Redacted Session Envelope Detail Summary

## Purpose

F71 introduced a native parser that returns redacted aggregate envelope
metadata. F72 turns that aggregate into safe Session detail copy so a PM or
engineer can see whether approved session evidence contains useful messages
without exposing transcript contents.

## Background

- F64-F68 built the metadata-only session import preview, dry run, and explicit
  approval boundary.
- F69-F70 added native reader boundaries and redacted structural content
  metadata.
- F71 added `read_agent_runtime_redacted_session_envelope`, returning only
  aggregate message and tool-call counts.
- Current Session detail copy is assembled in
  `lib/integrations/mappers/agent-runtime-detail.ts` from pure helpers in
  `lib/agent-runtime/`.
- ADR-004 still applies: API keys and transcript contents must not reach the
  renderer.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want to see aggregate message and tool-call counts for parsed session evidence before building normalized imports. |
| US-02 | As a maintainer, I want a pure summary boundary that can consume F71 output without duplicating UI copy logic. |
| US-03 | As a security-minded user, I want the detail panel to avoid transcript text, filenames, prompts, tool arguments, and raw secrets. |

## Functional Requirements

- Register the work in Development Progress on the Project Progress Dashboard.
- Add `buildAgentRuntimeSessionEnvelopeSummary(...)` as a pure helper.
- Support `ready`, `blocked`, and unavailable aggregate states.
- Include role counts and tool-call count only when a redacted envelope exists.
- Wire optional aggregate metadata into the Session detail group after approval
  copy.
- Preserve existing Session preview, dry-run, and approval summaries.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Do not call Tauri from React or mapper code.
- Do not introduce raw `invoke()` outside `lib/bridge/index.ts`.
- Do not add schemaVersion changes; this is a non-breaking optional payload
  display contract.

## Acceptance Criteria

1. F72 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Feature artifacts are complete enough for a future engineer to continue.
3. A ready aggregate envelope renders one safe summary line with message, role,
   and tool-call counts.
4. Blocked or absent aggregate state does not imply an import has run and does
   not duplicate sensitive details.
5. Existing Session preview, dry-run, and approval copy remain unchanged.
6. Focused tests prove displayable output excludes transcript text, filenames,
   tool arguments, and secret-like fixture strings.
7. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-23: F72 consumes optional aggregate metadata only. The UI does not
  trigger F71 native parsing yet; that belongs in a later explicit-action slice.
