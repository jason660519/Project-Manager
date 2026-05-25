---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Project Progress Dashboard guide with no secrets, credentials, or private infrastructure details.
---

# Project Progress Dashboard

The Project Progress Dashboard is the **portfolio view** at the centre of Project Manager. It pulls every project you have imported into a single workstation-style sheet, surfaces feature progress across four lifecycle phases, and lets you dispatch work to local IDEs or AI agents without leaving the page.

The dashboard sits at `/project-progress-dashboard` and is the default landing page when you open the app.

## At a glance

The page is a single `WorkstationFrame` panel. Tabs run along the bottom (Excel-style), so the data table always uses the full vertical space. Switching tabs swaps the content without re-rendering the header.

```
┌─────────────────────────────────────────────────────────────────────┐
│ PROJECT MANAGER         [?] [Bot] [Theme] [Lang]                    │  ← global TopBar
├─────────────────────────────────────────────────────────────────────┤
│ 📈 Project Progress Dashboard           [Export]   [stats cards]    │  ← header
│ Showing 3 selected projects: A, B, C                                │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──Agents (4) · 1 running─┐ ┌──Cron (2/5 enabled)─────┐             │  ← only on Development tab
│ │ [collapsible adapters]   │ │ [collapsible cron list] │             │
│ └──────────────────────────┘ └─────────────────────────┘             │
│                                                                     │
│ ┌─Toolbar: search · align · freeze · hidden · presets · reset · +Row┐│
│ │  [filterable, freezable, resizable phase table]                   ││
│ │  ...rows...                                                       ││
│ └───────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│ [📁 Projects 3] [Issues 12] [Development 47] [E2E 47] [Dep 47] ...  │  ← bottom sheet tabs
└─────────────────────────────────────────────────────────────────────┘
```

| Region | What it does |
|---|---|
| Header title | "Project Progress Dashboard" with the activity icon. Caption underneath lists which dashboard projects are currently selected. |
| Export button | Opens the [Export progress snapshot](#export-progress-snapshot) dialog. |
| Stats cards | Compact phase-specific KPI strip in the header. Only shown when a phase tab is active. |
| Agents / Cron strip | Two collapsible cards visible only on the Development tab. |
| Tab body | Either the Projects manager, GitHub Issues, or one of the four phase tables. |
| Bottom sheet tabs | Six tabs in the order Projects, Issues, Development, E2E Testing, Deployment, Operations. Counts shown as small badges. |

## Tabs

The six bottom tabs share the same panel container; only the content swaps.

| Tab | Icon | Source rows | Purpose |
|---|---|---|---|
| Projects | 📁 | One row per imported project | Add / remove projects, toggle which ones appear on the dashboard, run AI Initialize. |
| Issues | 🐙 | GitHub issues from each selected project's repo | Sync, filter, comment, create issues; dispatch any issue to an agent. |
| Development | `</>` | `Feature[]` with `phase === 'development'` + custom rows persisted in local storage | Day-to-day feature implementation with progress bars, engineer assignment, dispatch. |
| E2E Testing | 🧪 | Same feature pool, filtered to `e2e_testing` | Coverage %, pass/fail counts, per-feature test status. |
| Deployment | 🚀 | Filtered to `deployment` | Production / Staging / Not Deployed status, environment, last deploy date. |
| Operations | 📊 | Filtered to `operations` | Uptime, error rate, response time, recent incidents. |

Tab selection is mirrored into the URL hash (e.g. `#deployment`) so deep links work. The legacy `#testing` hash redirects to `#e2e_testing` on load.

### Persistent per-phase preferences

Each phase remembers its own table state in `localStorage` under `projectManager.progressDashboard.phase.<phase>` — column widths, alignments, frozen rows/cols, hidden rows, saved width presets, and any custom rows you added. Switching tabs preserves these independently.

Tap **Reset** in the toolbar to wipe a single phase's preferences and snap back to defaults.

## Projects tab

The Projects tab is a slim project manager that lives in front of the rest of the dashboard. Each row represents one imported project and exposes:

| Action | Behaviour |
|---|---|
| Click row | Selects that project as the current dashboard project (the one whose features feed the other tabs). |
| Checkbox | Toggles whether the project appears in the multi-project aggregate view. |
| Initialize | Runs the AI Scan on the project root and writes a generated `.project-manager/config.json` to disk. |
| Set GitHub URL | Inline edit or auto-detect from the local `git remote -v`. |
| Delete | Confirmation modal with an optional "also delete the config file from disk" checkbox. |
| Add Project | Modal with two modes — Local folder (with native Finder picker) and GitHub URL import. |
| AI Batch Scan | After importing folders, prompts to run Initialize across everything that lacks a config. |
| Sync from Desktop | Optional callback to re-scan known projects. |
| Generate Report | Builds a markdown weekly status report from completed / in progress / blocked features. |

The header also surfaces a banner if no AI provider key is saved — clicking it jumps to **Keys**. Initialize is disabled until at least one provider has a key.

## Issues tab

The Issues tab merges issues from every dashboard-selected project that has a `githubUrl`. Highlights:

- **Caching** — issues are cached per project under `pm-issues-<sanitised-name>` so the tab opens instantly on subsequent visits.
- **Auto-sync** — every 5 minutes, the tab re-syncs in the background.
- **Per-repo error messages** — friendly translations of "GitHub authorization is required", "rate limit reached", "repository could not be reached", etc.
- **Browser fallback** — when running outside Tauri, the tab proxies through the dev-only `/api/github/sync` Next.js route. Inside the desktop app the request goes through the Rust bridge with the stored GitHub token.
- **Create / edit / comment / close / reopen** — common workflows have inline buttons; bulk comment is available on multi-select.
- **Dispatch issue** — sends the issue title and body straight into the [Task Dispatch modal](#dispatching-work), pre-loaded with a synthetic feature stub.

## Phase tables (Development, E2E, Deployment, Operations)

Every phase tab renders the same `PhaseTable` component with phase-specific columns. The Development tab additionally shows a four-card status summary at the top (Completed, In Progress, Not Started, On Hold).

### Row sources

Each phase row is either:

- **`source: 'feature'`** — backed by a real `Feature` in `.project-manager/config.json`. Edits flow through `onFeaturePatch` and persist to disk.
- **`source: 'custom'`** — a free-form row you added with **+ Add Row**. Stored only in the per-phase `localStorage` bucket, never written to the project config. Useful for tracking ad-hoc work that does not deserve a full feature entry.

Moving a feature row between phases retargets the underlying `Feature.phase`. Moving a custom row migrates its localStorage entry to the destination phase's bucket.

### Stats strip

The header shows compact phase-specific KPI cards from `_lib/aggregations.ts`:

| Phase | Cards |
|---|---|
| Development | Overall % (SP-weighted) · Completed · In Progress · Pending + total SP |
| E2E Testing | Avg coverage % · Passed · Failed · Pending |
| Deployment | Production · Staging · Not Deployed · Latest deploy date |
| Operations | Avg uptime % · Avg error % · Avg response (ms) · Recent incidents |

### Toolbar

| Control | What it does |
|---|---|
| Search box | Substring match across project name, ID, feature name, category, and located section. E2E mode also matches category tokens. |
| Align menu | Set left / center / right alignment per column. |
| Freeze rows / cols | Pin the first N rows or first N columns so they stay visible while scrolling (max 5 each). |
| Hidden toggle | Reveal or re-hide rows you previously hid with the eye icon in the row actions column. |
| Presets | Save the current column-width layout under a name; click to restore later. |
| Reset | Clear all preferences for this phase and reload defaults. |
| Add Row | Open the custom-row creator. |

### Column resize and freeze

Drag the right edge of any column header to resize. Frozen columns stick to the left edge; frozen rows stick under the header. Both contribute sticky `left` / `top` offsets so the rest of the table can scroll independently.

### Category filter

The category column header carries a built-in filter dropdown. On the E2E Testing tab the dropdown uses an opinionated palette and a controlled list of categories from `_lib/e2eCategories.ts`; on other phases it shows whatever categories appear in the data.

### Dispatch button

Each feature row carries a **Dispatch** button. Clicking it opens the [Task Dispatch modal](#dispatching-work) with the feature pre-filled. Custom rows don't have this — they aren't backed by a real feature definition.

## Agents and Cron strip (Development tab only)

Above the table on the Development tab, two collapsible cards:

### Agents (N) · M running

Lists every configured adapter (agents, apps, IDEs) and marks each one **running** if there's a live process whose command matches. Click the cog to jump to the Integrations Hub Plugins page where adapters live.

### Cron (N/M enabled)

Lists scheduled jobs. Each job has:

- Toggle `enabled` / `disabled`
- Interval presets — `1m`, `5m`, `15m`, `30m`, `1h`
- **Run now** button (calls the supplied `onRunCronJob` handler)
- Cog link to the full Cron Jobs page

`last run` and `last status` are shown beneath the job name. The empty state links to **Open Cron Jobs →** to create the first one.

## Dispatching work

Two dispatch entry points share the same modal:

| Trigger | Source |
|---|---|
| Dispatch button on a feature row | Phase table |
| Dispatch on an issue card | Issues tab |

The modal (`TaskDispatchModal`) lets you pick:

- The adapter (agent or IDE) to run
- One of three harness roles — Planner / Worker / Evaluator
- The engineer role to inject (which selects model + system prompt + working scope)
- The agent workflow template (for batched flows)
- Optional MCP server injection flags
- Phase override (DEV / E2E / DEP / OPS)

When you run, the modal spawns the chosen process via the Rust bridge (`spawnAgent`) and streams stdout into the modal log. Active runs appear in the Agents strip and in the per-row "running" chip.

## Export progress snapshot

The Export button in the header opens a dialog that serialises everything currently on screen — all four phases, their aggregates, and any custom rows — into a single JSON payload. You can copy it to the clipboard or download it as `progress-<project>-<ISO timestamp>.json`. Useful for VIS dashboards, cross-tool sync, or sending a status report without screenshots.

## Multi-project mode

If you tick more than one project in the Projects tab, the Development table aggregates rows across every selected project. Each row keeps its origin in a Project column so you can tell where it came from, and per-project paths (README, spec, tdd) link out to the right source folder.

The header caption updates to reflect the selection: `Showing 3 selected projects: A, B, C`. If zero are ticked, the table falls back to the currently active project so the view is never empty.

## Keyboard and URL behaviour

| Behaviour | Where |
|---|---|
| URL hash | Bottom tabs write `#projects`, `#issues`, `#development`, `#e2e_testing`, `#deployment`, `#operations`. |
| Legacy hash | `#testing` redirects to `#e2e_testing` on first load. |
| Dispatch deep link | The Features view (sidebar) responds to `?dispatch=<featureId>` — useful for share URLs. |

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Live phase counts from Rust | Today phase counts re-compute on every render; a Rust-side aggregator would scale better with hundreds of projects. |
| Server-side cron | Cron jobs are currently in-app only; a background scheduler that survives quit would make recurring work first-class. |
| Issue ↔ feature linking | The Issues tab already tracks `linkedFeatureId`; turning that into a bidirectional view would let you click from a phase row to its issue. |
| Persistent Hidden Rows across phases | Hidden state is per-phase; a global hidden index could unify "ignore this row everywhere". |
| Inline progress bars in Operations | Today operations cells are numeric; tiny sparklines could surface trends without leaving the table. |

## References

- Page entry: [`app/project-progress-dashboard/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/page.tsx)
- Client: [`app/project-progress-dashboard/ProjectProgressClient.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/ProjectProgressClient.tsx)
- Sheet tabs: [`app/project-progress-dashboard/_components/SheetTabs.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/SheetTabs.tsx)
- Phase table: [`app/project-progress-dashboard/_components/PhaseTabContent.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/PhaseTabContent.tsx), [`PhaseTable.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/PhaseTable.tsx), [`PhaseTableToolbar.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/PhaseTableToolbar.tsx)
- Projects tab: [`app/ui/views/ProjectsView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/ProjectsView.tsx)
- Issues tab: [`app/project-progress-dashboard/_components/IssuesTab.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/IssuesTab.tsx)
- Aggregations & row builders: [`app/project-progress-dashboard/_lib/aggregations.ts`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_lib/aggregations.ts), [`phaseRows.ts`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_lib/phaseRows.ts), [`usePhasePreferences.ts`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_lib/usePhasePreferences.ts)
- Export: [`app/project-progress-dashboard/_components/ExportProgressDialog.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/ExportProgressDialog.tsx)
- Add custom row: [`app/project-progress-dashboard/_components/AddRowModal.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/AddRowModal.tsx)
- Agents / Cron strip: [`app/project-progress-dashboard/_components/AgentOpsPanel.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/AgentOpsPanel.tsx), [`CronControlPanel.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/project-progress-dashboard/_components/CronControlPanel.tsx)
- Dispatch modal: [`components/table/TaskDispatchModal.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/table/TaskDispatchModal.tsx)
