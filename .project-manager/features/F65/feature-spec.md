# F65: Agent Runtime Session Root Child Counts

## Purpose

F64 previews whether session import is possible, but it cannot indicate whether
an existing session root appears empty or populated. F65 adds a metadata-only
child count contract so future import UI can show approximate artifact
availability without reading transcript contents.

## Background

Current Agent Runtime snapshot data includes existing path metadata and command
availability. Scanner observations expose whether a `sessions-root` exists, and
F64 turns that into an import preview. F65 extends the same metadata-only path:

- Tauri snapshot counts first-level children under known session roots.
- TypeScript scanner copies those counts onto `sessions-root` observations.
- Session Import Preview displays the count per root candidate.

The count is deliberately shallow. It must not recurse, open files, parse JSON,
or include file names/content.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want to see whether a session root has any artifacts before planning an import. |
| US-02 | As a maintainer, I want session artifact availability represented as metadata so import UI does not need filesystem access. |
| US-03 | As a security-minded user, I want only counts, not filenames or contents, exposed to renderer-facing models. |

## Functional Requirements

- `AgentRuntimeFilesystemSnapshot.sessionRootChildCounts` maps absolute session root paths to first-level child counts.
- `AgentRuntimePathObservation.childCount` is set only for `sessions-root` observations when metadata exists.
- `AgentRuntimeSessionImportRootCandidate.childCount` surfaces the count in import preview.
- Native snapshot counts only known Agent Runtime session roots and only after the root exists.
- Missing or unreadable counts remain absent rather than implying zero.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep TypeScript scanner pure and backward compatible with snapshots that omit counts.
- Keep native snapshot output metadata-only and avoid reading file contents.
- Do not add schemaVersion changes; this is runtime snapshot metadata, not persisted canonical config.

## Acceptance Criteria

1. F65 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Scanner attaches child counts to `sessions-root` observations from snapshot metadata.
4. Import preview includes child counts for session root candidates.
5. Native snapshot tests prove shallow counts are emitted without file contents.
6. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: Count first-level entries only. Recursive counts and transcript
  parsing belong to later importer features.
