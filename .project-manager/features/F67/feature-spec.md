# F67: Agent Runtime Session Import Dry Run Contract

## Purpose

F64-F66 made session import readiness visible, including aggregate candidate
counts. F67 creates the first importer contract as a dry run: users and future
engineers can see exactly what would be considered for import while the app
still avoids reading transcript contents or listing private filenames.

## Background

Current flow:

- Native snapshot can count first-level children under known session roots.
- Scanner attaches `childCount` only to `sessions-root` observations.
- `buildAgentRuntimeSessionImportPreview` exposes root candidates and summary
  copy.
- Agent Runtime detail panel renders Session group details from shared helper
  output.

F67 should extend this with a dry-run plan that future importer work can reuse.
The plan must stay pure TypeScript and metadata-only.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want to preview which session roots would be imported before any file contents are read. |
| US-02 | As a maintainer, I want a stable dry-run contract so a later importer can add real parsing without changing detail-panel copy. |
| US-03 | As a security-minded user, I want dry-run output to include counts and root paths only, never transcript filenames, file contents, or secrets. |

## Functional Requirements

- Register F67 in Development Progress on the Project Progress Dashboard.
- Add `buildAgentRuntimeSessionImportDryRun(preview)` as a pure helper.
- Dry run has status `ready`, `blocked`, or `unsupported`, matching preview state.
- Ready dry run includes one plan item per existing session root.
- Each plan item includes root path, mode `metadata_only`, and optional
  artifact candidate count.
- Ready summary includes aggregate candidate count only when count metadata is
  known.
- Blocked and unsupported dry runs include preview blocked reasons and zero
  plan items.
- Agent Runtime detail Session group includes dry-run summary after preview
  summary.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep helper pure TypeScript with no filesystem, bridge, Tauri, network, or
  React imports.
- Do not add schema changes, commands, capabilities, or permission entries.
- Do not infer zero artifact candidates when child-count metadata is absent.

## Acceptance Criteria

1. F67 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Ready dry run returns root-level metadata-only items and count-aware summary.
4. Missing count metadata keeps count unknown rather than showing false zero.
5. Blocked and unsupported previews produce no plan items and explain why.
6. Displayable dry-run output excludes secret-like fixture strings, filenames,
   and transcript text.
7. Detail model Session group consumes the shared dry-run summary.
8. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: Dry-run output is a contract, not an importer execution. It does
  not read files, list directory entries, parse transcripts, write records, or
  calculate cost.
