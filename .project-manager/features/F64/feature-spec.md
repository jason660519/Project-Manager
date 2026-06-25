# F64: Agent Runtime Session Import Preview

## Purpose

F63 tells the app whether session/cost evidence exists. F64 adds the next
metadata-only layer: a preview contract that says which session roots would be
candidates for a future importer and why the importer would be blocked today.
This makes the future session importer easier to implement without coupling it
to UI path filtering or secret handling.

## Background

F57-F63 provide:

- `AgentRuntimeToolRow.paths` with `sessions-root` observations.
- `AgentRuntimeToolRow.capabilities.sessions`.
- F63 Session/Cost summary that never reads files or transcripts.
- F62 detail panel rendering for read-only Agent Runtime evidence.

The preview must stay in the same boundary. It may show path metadata and
readiness, but it must not read file contents, list files inside a session
directory, parse transcripts, or expose secret-bearing config paths.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want to see whether session import is ready or blocked so that I know what setup is missing before running an importer. |
| US-02 | As a maintainer, I want import preview state derived in one helper so that future importer UI and tests do not duplicate path logic. |
| US-03 | As a security-minded user, I want preview output to omit transcript contents and secret-bearing config paths so that local agent history stays private. |

## Functional Requirements

- `buildAgentRuntimeSessionImportPreview(row)` returns a preview for one `AgentRuntimeToolRow`.
- Preview state is `ready`, `blocked`, or `unsupported`.
- Preview includes candidate session roots with `path`, `exists`, and `importMode: metadata_only`.
- Preview includes `blockedReasons` for missing roots or unsupported runtime capability.
- Agent Runtime detail Session group includes a short preview detail line.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep the helper pure TypeScript with no `fs`, bridge, Tauri, or network imports.
- Detail panel changes remain read-only and add no action buttons.

## Acceptance Criteria

1. F64 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Ready preview includes only existing `sessions-root` metadata as importable candidates.
4. Blocked and unsupported previews include explicit reasons.
5. Displayable preview output excludes secret-like fixture strings, transcript text, and secret-bearing config paths.
6. Agent Runtime detail panel still renders Session/Cost evidence with the new preview detail.
7. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: Keep F64 as preview only. File enumeration, transcript parsing,
  importer execution, and cost ledger writes belong to later features.
