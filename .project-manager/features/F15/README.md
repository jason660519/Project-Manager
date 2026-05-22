# F15 — GitHub Issues Dashboard Tab

**Status**: done
**Progress**: 100%
**Category**: Core/Integration
**Implementation**: `app/project-progress-dashboard/_components/IssuesTab.tsx`

## Summary

Add a new "GitHub Issues" sheet tab to the Project Progress Dashboard that syncs issues from tracked GitHub repositories. Each row represents a single GitHub issue with key fields (title, number, state, labels, assignee, linked feature). Agent can view, filter, and dispatch work from this tab.

## Related Files

- `app/project-progress-dashboard/` — dashboard page
- `lib/types/index.ts` — `GithubIssue` type (already exists)
- `lib/bridge/index.ts` — Tauri invoke wrappers
- `src-tauri/src/lib.rs` — GitHub API bridge commands
- `.project-manager/features/F15/feature-spec.md` — full spec
- `.project-manager/features/F15/tdd-spec.md` — test plan

## Acceptance Criteria

- [x] New "Issues" sheet tab appears in the dashboard sheet tabs bar
- [x] Sync button fetches open issues from GitHub for the current project
- [x] Each issue row shows: Title, # Number, State (open/closed), Labels, Updated
- [x] Rows are filterable by state, label, and search
- [x] Agent can click a row to open the issue detail panel
- [x] Dispatch button maps an issue to an AI engineer task
- [x] Synced issues are cached locally to avoid repeated fetches
- [x] GitHub token read path avoids exposing raw token in renderer UI
