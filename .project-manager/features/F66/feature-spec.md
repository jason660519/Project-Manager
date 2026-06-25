# F66: Agent Runtime Count Aware Session Preview Copy

## Purpose

F65 added numeric child-count metadata, but the visible Agent Runtime detail
panel still only says how many roots are ready. F66 makes that preview copy
count-aware so users can see whether a ready root appears to contain artifact
candidates, while preserving the metadata-only privacy boundary.

## Background

Current flow:

- Native snapshot may provide `sessionRootChildCounts`.
- Scanner attaches `childCount` only to `sessions-root` observations.
- F64 preview exposes root candidates.
- Detail model renders Session group details from preview state.

F66 should put all count-aware wording in the preview helper so the detail model
and UI do not duplicate business logic.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want the import preview to show artifact candidate counts when available so that I can judge whether a future import is worth running. |
| US-02 | As a maintainer, I want count-aware copy centralized in the preview helper so UI rendering stays simple. |
| US-03 | As a security-minded user, I want the preview to show counts only, never filenames or transcript contents. |

## Functional Requirements

- `AgentRuntimeSessionImportPreview` includes `summary`.
- Ready preview with known counts says `N metadata-only root(s) ready with M artifact candidate(s).`
- Ready preview without known counts keeps the existing root-only message.
- Blocked and unsupported preview summaries remain explicit and non-actionable.
- Agent Runtime detail Session group uses `preview.summary`.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep helper pure TypeScript with no filesystem, bridge, Tauri, or network imports.
- Do not add schema changes, commands, capabilities, or permission entries.

## Acceptance Criteria

1. F66 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Preview summary includes artifact candidate counts only when count metadata exists.
4. Detail model Session group details use the shared preview summary.
5. Displayable output excludes secret-like fixture strings, filenames, and transcript text.
6. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: Keep count-aware copy in the preview helper, not the React
  component. The UI renders strings only.
