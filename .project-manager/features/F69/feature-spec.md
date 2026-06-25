# F69: Agent Runtime Session Reader Boundary

## Purpose

F68 created an approval contract but still did not cross into native file
boundaries. F69 adds the first Rust-side guardrail for a future transcript
reader: the app can validate that an approved request targets a file under an
allowlisted session root and within a byte limit, while returning only redacted
metadata to the renderer.

## Background

Current flow:

- F64 previews session import readiness.
- F65 adds session-root child counts.
- F66 exposes count-aware preview copy.
- F67 produces a metadata-only dry-run plan.
- F68 requires explicit approval before a future reader request exists.

F69 should now add the bridge/Tauri boundary required by ADR-004 style safety:
native code can inspect filesystem metadata, but the renderer receives no
transcript contents and no target filename.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want native transcript access blocked unless a prior approval contract exists. |
| US-02 | As a maintainer, I want root allowlisting and max-byte checks in Rust before any future parser can read session files. |
| US-03 | As a security-minded user, I want the renderer to receive metadata only, never transcript text, filenames, snippets, or secrets. |

## Functional Requirements

- Register F69 in Development Progress on the Project Progress Dashboard.
- Add `read_agent_runtime_session_boundary` Tauri command.
- Add `readAgentRuntimeSessionBoundary` typed bridge wrapper.
- Add `src-tauri/permissions/read-agent-runtime-session-boundary.json` and
  register it in default capability.
- Request includes `approved`, `rootPaths`, `targetPath`, and `maxBytes`.
- Command blocks when `approved` is not true.
- Command blocks when no allowlisted root exists.
- Command blocks when `targetPath` is outside all allowlisted roots.
- Command blocks when target metadata is missing, target is not a file, or file
  length exceeds `maxBytes`.
- Ready response includes only allowed root path, byte length, max bytes,
  `contentRedacted: true`, and `targetNameRedacted: true`.
- Blocked response includes blocked reasons and no file contents or target
  filename.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep prompt assembly and API calls out of Rust; this command is filesystem
  metadata only.
- Do not return transcript contents, snippets, filenames, parsed messages, or
  raw secrets to the renderer.
- Canonicalize allowlisted roots and target path before containment checks.
- No schemaVersion bump: no persisted canonical config shape changes.

## Acceptance Criteria

1. F69 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Rust helper blocks unapproved requests.
4. Rust helper blocks target paths outside allowlisted roots.
5. Rust helper blocks files over `maxBytes`.
6. Rust helper returns metadata-only ready response for approved in-root files.
7. TypeScript bridge exports request/response types and invokes the command.
8. Capability entry registers the command.
9. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: F69 returns metadata only and redacts target filename. Real
  transcript parsing is deferred to a later feature.
