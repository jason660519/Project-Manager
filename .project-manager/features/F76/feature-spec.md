# F76 Feature Spec - Agent Runtime Redacted Session Target Selector

## Problem Definition

F75 requires users to paste a full session target path. That is useful for a
guarded first slice, but it encourages filename exposure in the UI and makes the
happy path awkward. F76 introduces a selector for already-known safe target
candidates without adding native discovery in this slice.

## In Scope

- Parse optional Agent Runtime payload metadata:
  - `sessionTargets: Array<{ targetPath, rootPath?, byteLength?, modifiedAt? }>`
- Return display-safe target options:
  - redacted labels such as `Session target 1`
  - optional aggregate metadata such as byte length
  - no filename, basename, transcript preview, or tool args in display fields
- Filter malformed candidates and candidates outside known existing session
  roots.
- Render a select control in the existing redacted parser UI when candidates are
  available.
- Selecting an option sets the internal target path for F75/F74 execution.
- Keep manual path input as fallback when no candidates are available.

## Out of Scope

- Discovering files from disk.
- Listing filenames.
- Rendering transcript content.
- Persisting selected targets.
- Changing bridge permissions.

## User Value

Users get a safer and faster path to choose a session parse target once target
metadata exists, while Project Manager continues to avoid exposing session
filenames or content in the renderer display.

## Success Metrics

- Candidate labels and summaries do not include `session-a.json`,
  `cat secret.txt`, transcript text, or secret-like strings.
- Selecting a redacted target enables parse after approval.
- The parse action receives the internal target path.
- Existing F75 manual path behavior remains available without candidates.
- Focused, regression, route health, browser smoke, and baseline checks pass.

## Dependencies and Constraints

- Reuses F75 parser panel.
- Reuses F73/F74 parse action and executor contracts.
- Does not call raw Tauri `invoke()`.
- Does not invent native file discovery in this slice.
