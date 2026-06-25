# F70: Agent Runtime Redacted Session Content Reader

## Purpose

F69 added a native metadata gate but deliberately avoided reading content.
F70 performs the first bounded native content read behind that gate and returns
only redacted structural metadata. This proves the execution path can inspect a
session file without leaking transcript text or filenames to the renderer.

## Background

Current flow:

- F68 produces an explicit approved reader request.
- F69 validates approval, allowlisted root containment, target metadata, and
  max-byte guard in Rust.
- F69 response redacts target filename and content.

F70 should reuse the same safety posture, then read the bounded file internally
to derive non-sensitive structure only.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want the app to inspect approved session files without exposing transcript text in the renderer. |
| US-02 | As a maintainer, I want a native redacted reader contract before building a real session parser. |
| US-03 | As a security-minded user, I want secrets, prompts, tool calls, filenames, and raw content excluded from every response. |

## Functional Requirements

- Register F70 in Development Progress on the Project Progress Dashboard.
- Add `read_agent_runtime_redacted_session_content` Tauri command.
- Add `readAgentRuntimeRedactedSessionContent` typed bridge wrapper.
- Add `src-tauri/permissions/read-agent-runtime-redacted-session-content.json`
  and register it in default capability.
- Request reuses `approved`, `rootPaths`, `targetPath`, and `maxBytes`.
- Command first applies the F69 reader boundary.
- Ready response includes byte length, max bytes, line count, non-empty line
  count, `looksLikeJsonObject`, `looksLikeJsonArray`, `contentRedacted: true`,
  and `targetNameRedacted: true`.
- Blocked response includes reasons and redaction flags only.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep API/model calls out of Rust.
- Do not return file contents, filenames, snippets, parsed messages, prompts,
  tool calls, or raw secrets to the renderer.
- No schemaVersion bump: no persisted canonical config shape changes.

## Acceptance Criteria

1. F70 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Native command blocks unapproved/root-escape/oversized requests via F69 boundary.
4. Native command reads bounded content only after the boundary is ready.
5. Ready response returns structural metadata and redaction flags only.
6. Displayable response excludes transcript text, target filenames, and secret-like strings.
7. TypeScript bridge exports request/response types and invokes the command.
8. Capability entry registers the command.
9. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: F70 reads bounded content only to derive structure. Real session
  parsing and import remain out of scope.
