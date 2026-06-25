# F71: Agent Runtime Redacted Session Envelope Parser

## Purpose

F70 can read bounded content and return structural metadata. F71 adds a native
redacted parser that summarizes session envelope shape without exposing message
text. This creates the first usable import signal while preserving the privacy
boundary.

## Background

Current flow:

- F68 requires explicit approval.
- F69 validates approved root and max-byte boundaries in Rust.
- F70 reads bounded content natively and returns redacted structure only.

F71 should parse enough JSON/JSONL structure to count roles and tool-call-like
items, but it must never return raw content or filenames.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want to know whether an approved session file appears to contain useful messages before importing it. |
| US-02 | As a maintainer, I want aggregate envelope metadata before building normalized session import records. |
| US-03 | As a security-minded user, I want message contents, prompts, tool arguments, filenames, and secrets excluded from every parser response. |

## Functional Requirements

- Register F71 in Development Progress on the Project Progress Dashboard.
- Add `read_agent_runtime_redacted_session_envelope` Tauri command.
- Add `readAgentRuntimeRedactedSessionEnvelope` typed bridge wrapper.
- Add `src-tauri/permissions/read-agent-runtime-redacted-session-envelope.json`
  and register it in default capability.
- Request reuses `approved`, `rootPaths`, `targetPath`, and `maxBytes`.
- Command first applies F70 redacted content reader.
- Ready response includes byte length, message count, role counts, tool-call
  count, redaction flags, and blocked reasons.
- Blocked response includes reasons and no envelope.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Do not return file contents, filenames, snippets, parsed message text, prompts,
  tool arguments, or raw secrets to the renderer.
- No schemaVersion bump: no persisted canonical config shape changes.

## Acceptance Criteria

1. F71 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Native command blocks unsafe requests through F70.
4. Native command parses JSON array and JSON object message containers.
5. Ready response returns aggregate envelope metadata and redaction flags only.
6. Displayable response excludes transcript text, target filenames, prompts,
   tool arguments, and secret-like strings.
7. TypeScript bridge exports request/response types and invokes the command.
8. Capability entry registers the command.
9. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: F71 parser is intentionally aggregate-only. Normalized session
  records and user-visible message rendering remain out of scope.
