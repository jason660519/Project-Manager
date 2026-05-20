# F15 Feature Spec — GitHub Issues Dashboard Tab

## Purpose

Add a GitHub Issues sheet tab to the Project Progress Dashboard so the user can see, filter, and dispatch work on tracked-project issues without leaving the PM dashboard. This unifies the feature roadmap and the issue tracker in one view, enabling the AI engineer workflow: see issue → dispatch → fix → PR.

## Source References

- `lib/types/index.ts` — `GithubIssue` type (id, number, title, body, state, labels, createdAt, updatedAt, url, user)
- `app/project-progress-dashboard/` — existing sheet tabs pattern (SheetTabs, PhaseTabContent, columns)
- `docs/architecture/ADR-004-api-call-security.md` — API calls and secrets stay outside the renderer
- `docs/product/user-scenarios.md` — Scenario: "See open issues alongside feature progress"

## Functional Requirements

1. Add a new sheet tab `"Issues"` in the dashboard sheet tabs bar, alongside `Development`, `E2E Testing`, `Deployment`, `Operations`.
2. On first visit, show a "Sync Issues from GitHub" button (no auto-fetch).
3. On sync, call a Tauri bridge command `sync_github_issues` that:
   - Reads the project's GitHub URL from config (`.project-manager/config.json` → `project.githubUrl`).
   - Reads `GITHUB_TOKEN` from the OS keychain.
   - Fetches open issues from `GET /repos/{owner}/{repo}/issues`.
   - Returns parsed `GithubIssue[]`.
4. Cache synced issues in `localStorage` key `pm-issues-{projectId}` with a timestamp.
5. Display a table with columns:
   - `#` (issue number)
   - Title
   - State (open / closed) — semantic badge
   - Labels — tag-style chips
   - Updated — relative time ("2 hours ago")
   - Linked Feature — optional manual mapping (user picks from existing feature IDs)
6. Support filtering: by state, by label, text search on title.
7. Support row click → right panel shows issue detail (title, body, labels, url).
8. Support a "Dispatch" button that opens the existing `TaskDispatchModal` with the issue title as the task prompt.
9. If no GitHub token is configured, show a clear message: "Configure GitHub token in Keys view → Sync Issues."
10. Must work in both Tauri and browser mode (browser mode uses the existing api proxy pattern for GitHub API).
11. Do not expose the GitHub token to the renderer at any point.

## Non-Goals

- Creating or editing issues from the dashboard.
- Webhook-based real-time sync.
- Auto-linking issues to features (user does it manually for now).
- Multi-repo support in this iteration.

## Dashboard Contract

This is the canonical `paths.spec` file for F15. The feature overview is `.project-manager/features/F15/README.md`.

## Acceptance Checks

- [ ] Issues tab appears in sheet tabs after adding `PHASE_IDS`-like config
- [ ] Sync button exists and is disabled when no GitHub token is saved
- [ ] Sync loads issues into the table
- [ ] Each row shows number, title, state, labels, updated time
- [ ] Filtering by state/label/search updates the visible rows
- [ ] Row click opens a detail panel with issue body
- [ ] Dispatch button opens TaskDispatchModal with issue title
- [ ] Token never reaches renderer (check via browser DevTools network tab)
- [ ] Cached issues survive page reload (check localStorage)
