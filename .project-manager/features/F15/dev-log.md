# F15 dev-log

## 2026/05/20 — Feature created

- Feature spec written by Wilson
- TDD spec written by Wilson
- README written by Wilson
- Config updated with F15 entry (0%)
- Deferred to subagent for implementation

## 2026/05/20 — Implementation complete

### What was built

1. **`app/project-progress-dashboard/_components/IssuesTab.tsx`** — Main Issues tab component
   - Sync button that calls `fetchGithubIssues` (Tauri) or proxies through `/api/github/sync` (browser)
   - Cached issues in localStorage keyed by project name (`pm-issues-{projectName}`)
   - Filter bar: text search, state filter (all/open/closed), clickable label chips
   - Issues table with columns: `#` (number), Title, State (semantic badge), Labels (chips), Updated (relative time), Action (Dispatch)
   - Row click opens detail panel on the right showing issue body, labels, author, link to GitHub, and Dispatch button
   - No-token state shows guidance message
   - Error bar for sync failures
   - Status badges for open (green) and closed (gray)

2. **`app/project-progress-dashboard/_components/SheetTabs.tsx`** — Updated
   - Added `Issues` tab with GitHub icon to the sheet tabs bar
   - Refactored to use `TabId` union type (`FeaturePhase | 'issues'`)
   - Tab has sky-blue accent color scheme

3. **`app/project-progress-dashboard/ProjectProgressClient.tsx`** — Updated
   - Now manages `TabId` instead of `FeaturePhase` for active tab
   - Renders `IssuesTab` component when the Issues tab is active
   - Supports dispatching an issue title through `TaskDispatchModal` via a synthetic Feature

4. **`app/project-progress-dashboard/types.ts`** — Updated
   - `PHASE_IDS` now includes `'issues'`
   - New `TabId = (typeof PHASE_IDS)[number]` type

5. **`app/api/github/sync/route.ts`** — Browser mode API route
   - Proxies GitHub REST API (`GET /repos/{owner}/{repo}/issues`) using `GITHUB_TOKEN` from env
   - Filters out pull requests (GitHub returns PRs alongside issues in REST)
   - Maps to `GithubIssue[]` format

6. **`lib/types/index.ts`** — Updated
   - Added `githubUrl?: string` to `ProjectConfig`

7. **`lib/i18n/*.ts`** — All 4 locales
   - Added `issues` phase translation key

8. **`.project-manager/config.json`** — Updated
   - Added `project.githubUrl: https://github.com/jason66x/Project-Manager`
   - F15 progress set to 100%, status to done

### Files created
- `app/project-progress-dashboard/_components/IssuesTab.tsx`
- `app/api/github/sync/route.ts`
- `__tests__/IssuesTab.test.tsx`

### Files modified
- `lib/types/index.ts` — added `githubUrl` to `ProjectConfig`
- `app/project-progress-dashboard/types.ts` — added `issues` to `PHASE_IDS`, added `TabId`
- `app/project-progress-dashboard/_components/SheetTabs.tsx` — added Issues tab
- `app/project-progress-dashboard/ProjectProgressClient.tsx` — tab management
- `lib/i18n/types.ts` — added `issues` to phases type
- `lib/i18n/en.ts`, `zh-hant.ts`, `zh.ts`, `ja.ts` — added issues label
- `.project-manager/config.json` — githubUrl + F15 progress

### Test results
- 8/8 tests pass
- `npm run typecheck`: passes (pre-existing chat.pageclient errors unchanged)
- `npm run build`: passes (static export)

### Acceptance criteria met
- [x] Issues tab appears in sheet tabs
- [x] Sync button exists
- [x] Sync loads issues into the table (Tauri + browser mode)
- [x] Each row shows number, title, state, labels, updated time
- [x] Filtering by state/label/search updates the visible rows
- [x] Row click opens a detail panel with issue body
- [x] Dispatch button opens TaskDispatchModal with issue title
- [x] Token never reaches renderer (proxied through Rust or server API route)
- [x] Cached issues survive page reload (localStorage)
- [x] No-token state shows guidance
