# F79 Feature Spec - Agent Runtime Session Target Diagnostics UI

## Problem Definition

F78 can append diagnostics when native redacted session target hydration is
blocked or fails. Users need those diagnostics to be visible in Agent Runtime UI
without leaking unsafe target details.

## In Scope

- Render `session_target_list_failed` diagnostics in Agent Runtime detail sheet
  through the existing diagnostics block.
- Ensure diagnostics remain hidden when no hydration issue exists.
- Preserve safe copy: diagnostic messages may explain the blocked/fallback state
  but must not expose target filenames, transcript content, API keys, or thrown
  raw error strings.
- Add tests in the F79 feature folder.

## Out of Scope

- Native target discovery changes.
- Additional selector controls.
- Cost/session analytics expansion.
- Tauri shell-only UI.
- Schema migration.

## User Value

When the redacted target selector has no native candidates, users can see whether
Project Manager used the safe manual fallback because native listing was blocked
or unavailable.

## Success Metrics

- Focused UI tests prove the diagnostic is visible for Agent Runtime rows.
- Focused UI tests prove unsafe fixture strings are absent from visible UI.
- F64-F79 regression suite passes.
- Route health, browser smoke, and baseline pass before completion.

## Dependencies and Constraints

- Reuses F78 diagnostic code `session_target_list_failed`.
- Reuses existing Agent Runtime detail diagnostics rendering.
- Must not introduce raw `invoke()` in React components.
- Must follow PM dense workstation style; no new table/sheet layout.
