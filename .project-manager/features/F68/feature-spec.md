# F68: Agent Runtime Session Import Approval Boundary

## Purpose

F67 introduced a metadata-only dry-run plan. F68 adds the next safety boundary:
an explicit approval contract that future transcript readers must pass through
before any file contents can be considered. This lets the detail panel show
that import execution is still locked until the user approves the dry run.

## Background

Current flow:

- F64 previews whether session import is ready or blocked.
- F65 attaches child-count metadata to session-root observations.
- F66 makes preview copy count-aware.
- F67 turns preview data into a metadata-only dry-run plan.

F68 should not execute the importer. It should define a stable approval gate
and request shape that later reader work can consume.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want transcript reading to require explicit approval after reviewing a dry run. |
| US-02 | As a maintainer, I want a stable request contract for the future reader so import execution does not bypass dry-run review. |
| US-03 | As a security-minded user, I want approval output to avoid filenames, transcript text, file contents, and raw secrets. |

## Functional Requirements

- Register F68 in Development Progress on the Project Progress Dashboard.
- Add `buildAgentRuntimeSessionImportApproval(dryRun, decision)` as a pure
  helper.
- Approval status is `approved`, `needs_approval`, `blocked`, or `unsupported`.
- A ready dry run with `approved: true` produces a reader request with tool ID,
  label, root paths, mode `transcript_reader_pending`, and artifact candidate
  count when known.
- A ready dry run without approval produces no reader request and an explicit
  reason.
- Blocked and unsupported dry runs produce no reader request and retain blocked
  reasons.
- Agent Runtime detail Session group includes approval-boundary summary after
  preview and dry-run summaries.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep helper pure TypeScript with no filesystem, bridge, Tauri, network, or
  React imports.
- Do not add schema changes, commands, capabilities, or permission entries.
- Do not infer zero artifact candidates when count metadata is absent.

## Acceptance Criteria

1. F68 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Approved ready dry run produces a reader request with root paths only.
4. Unapproved ready dry run produces no reader request and explains approval is required.
5. Blocked and unsupported dry runs produce no reader request and retain reasons.
6. Missing count metadata stays unknown rather than showing false zero.
7. Displayable approval output excludes secret-like fixture strings, filenames,
   and transcript text.
8. Detail model Session group consumes the shared approval summary.
9. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: F68 defines an approval gate and future reader request shape only.
  It does not read files, list directory entries, parse transcripts, write
  records, or calculate cost.
