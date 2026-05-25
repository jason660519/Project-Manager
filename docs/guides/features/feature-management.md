---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Features view guide with no secrets, credentials, or private infrastructure details.
---

# Features

The Features view is a **single-project working list** of every feature defined in the active project's `.project-manager/config.json`. It is the place to filter, inspect, batch-select, and dispatch features to AI agents one by one or in groups.

It lives at `/features` in the sidebar and operates on the project currently selected in the [Project Progress Dashboard](dashboard.md). Switch projects from the Dashboard's Projects tab first, then come here for execution.

## How it differs from the Dashboard

| Feature | Project Progress Dashboard | Features view |
|---|---|---|
| Project scope | Multi-project portfolio | Single active project only |
| Tabs / phases | 6 tabs (Projects / Issues / Development / E2E / Deployment / Operations) | Flat list, status filter only |
| Batch dispatch | One row at a time via row Dispatch button | Multi-select + Batch Dispatch modal |
| Custom rows | Yes (local to the dashboard) | No — always backed by real `Feature` records |
| Detail surface | Inline doc panel on click | Side panel with run history + active run telemetry |
| Editable in place | Column-by-column inline edit | Read-only; edits happen in the dispatch modal |

Think of the Dashboard as "where you organise" and the Features view as "where you execute and review what happened".

## At a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│ FEATURES                                                             │  ← page title
│ 47 total · 12 shown · 3 selected                                     │
├──────────────────────────────────────────────────────────────────────┤
│ [All 47] [Blocked 2] [In Progress 12] [To Do 30] [Done 3]            │  ← status filter
│ [🤖 Batch Dispatch (3)] [Deselect]            [🔍 Search...]         │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─Table──────────────────────────────────┐ ┌─Detail Panel─────────┐  │
│ │ ☑ Proj  ID  Cat  Name  Spec  TDD ...   │ │ F12 · IN PROGRESS    │  │
│ │ ☐ A     F01 UI   Login  …                │ │ Progress 60%        │  │
│ │ ☑ A     F02 API  ...                     │ │ Notes / Paths       │  │
│ │ ...                                     │ │ Active run · Logs    │  │
│ └─────────────────────────────────────────┘ └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

| Region | What it does |
|---|---|
| Title strip | Total feature count, count shown after filter, count selected. |
| Filter row | Five status filter pills, optional Batch Dispatch button (only when ≥ 1 row selected), search box on the right. |
| Table | `TableCore` (TanStack Table v8) — one row per `Feature`. |
| Detail Panel | Slides in beside the table when a row is clicked. Visible only on `≥ xl` screens (1280px+). |

## Filtering

### Status pills

| Pill | Matches |
|---|---|
| All | Every feature |
| Blocked | `status === 'on_hold'` |
| In Progress | `status === 'in_progress'` |
| To Do | `status === 'todo'` |
| Done | `status === 'done'` |

Each pill shows the matching count next to its label, so you know whether selecting it will return any rows.

### Search

The search box performs a substring match (case-insensitive) across feature `id`, `name`, and `category`. Search and status filter combine — for example "Blocked + login" returns only blocked features whose name, ID, or category mentions "login".

## Columns

The table is rendered by [`components/table/TableCore.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/table/TableCore.tsx). When multi-select is active the first column is a checkbox; otherwise it is omitted. Subsequent columns:

| Column | Meaning |
|---|---|
| Project | Source project name (only meaningful when running against a merged dataset). Pulled from `feature.metadata.sourceProjectName`. |
| ID | Human-readable feature ID, e.g. `F01`. |
| Category | Colour-coded badge from `feature.category`. |
| Function/Feature | Feature display name. |
| Feature Dev Spec | Path to the dev spec file (mono, truncated; full path in tooltip). |
| TDD Spec | Path to the TDD spec. |
| TDD Progress Report | Path to the latest TDD progress report. |
| Unit & Integration Test | Path to the unit / integration test file. |
| E2E Acceptance Test | Folder containing E2E scripts (`paths.e2eAcceptanceTestScriptFolder`), with a fallback to `paths.test`. |
| Dev Log Summary | Folder for development log summaries. |
| Status | Coloured badge (To Do / In Progress / Done / Blocked). |
| Progress | Visual bar + numeric percentage (0–100). |
| (actions) | **Dispatch** button — opens the single-feature task modal. |

Empty path cells show `—` so the column stays scannable.

## Row interactions

| Click target | Behaviour |
|---|---|
| Checkbox | Toggles the row in the selection set (parent state). |
| Row body | Opens the Detail Panel for that feature; clicking the same row again closes it. |
| Dispatch button | Opens the [Task Dispatch modal](#task-dispatch-modal) with this feature pre-loaded. Bubbling is stopped so the row click does not also fire. |

## Detail panel

The right-hand column appears when a row is selected. It is the same `FeatureDetailPanel` used elsewhere and shows:

| Section | Content |
|---|---|
| Header | Feature ID + status badge + name + category. |
| Progress bar | Current progress with the same colour as the status badge. |
| Notes | Free-form `feature.notes` if present. |
| Paths | Every `feature.paths.*` field rendered as a labelled row with an icon. Empty paths are omitted. |
| Run history | Past `CompletedRun` entries filtered to this feature ID, with exit code + timing. |
| Active run | If the feature has a live run, shows the active PID, command, and a stream of stdout. |
| Dispatch | Footer button that triggers the same modal as the row's Dispatch button. |

Clicking the **×** in the header closes the panel without losing selection.

## Task Dispatch modal

The Task Dispatch modal is the unified entry point for sending a feature to an AI agent or IDE. Implementation: [`components/table/TaskDispatchModal.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/table/TaskDispatchModal.tsx).

What you can configure per dispatch:

| Setting | Notes |
|---|---|
| Target adapter | Any configured agent (`type === 'agent'`) or IDE (`type === 'ide'`). |
| Harness role | Planner / Worker / Evaluator (P/W/E). Each role has its own run state chip. |
| Engineer role | Inject one of your saved engineer roles to add a system prompt, model preference, and working scope. |
| Agent workflow | Optional named workflow (`agent-workflows`) that builds a structured prompt. |
| MCP servers | Toggle which enabled MCP servers are injected into the agent's args. |
| Phase override | Move the feature to DEV / E2E / DEP / OPS as part of the run. |

The modal is also URL-aware. When you click Dispatch, the view writes `?dispatch=<featureId>` to the address bar; closing the modal pops the state back. This means deep links into a specific dispatch survive reloads.

## Batch Dispatch modal

When you tick more than one feature, the **Batch Dispatch (N)** button appears. Clicking it opens `BatchDispatchModal` — implementation: [`components/table/BatchDispatchModal.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/table/BatchDispatchModal.tsx).

The batch modal lets you apply one prompt template to every selected feature at once:

| Template | Use case |
|---|---|
| 從零實作 (Implement from scratch) | New feature, spec-driven |
| 補測試 (Add tests) | Existing implementation needs unit / integration tests |
| Debug | Known bug; agent finds and fixes |
| Code Review | Suggest improvements without writing code |
| 文件補全 (Add docs) | JSDoc + type annotations |

Each feature runs sequentially (so you can watch progress), with per-item phase (`pending` / `running` / `done` / `error`) and a collapsible log block. The kill button stops the active run; remaining items in the queue still progress.

The optional Agent Workflow dropdown lets you wrap every prompt in a structured workflow (e.g. Planner→Worker→Evaluator) instead of a flat prompt.

## Selection model

| Action | State change |
|---|---|
| Click a checkbox | Toggles that ID in the selection set. |
| Click "Deselect" link | Clears the entire selection. |
| Open Batch Dispatch modal | Selection is preserved; runs are scoped to whatever was selected when the modal opened. |
| Filter or search | Selection persists across filter changes — even when the selected rows are not currently visible. |

## Common workflows

| Goal | Steps |
|---|---|
| Implement one feature with a specific agent | Click the row's Dispatch → pick adapter + engineer role → Run. |
| Send 10 in-progress features to "add tests" | Status filter "In Progress" → tick the 10 rows → Batch Dispatch → "補測試" template → choose agent → Run. |
| Audit a feature's run history | Click the row to open the Detail Panel → scroll to Run history. |
| Re-dispatch from a deep link | Open the URL ending in `?dispatch=F12` — the modal opens pre-loaded with that feature. |
| Spot which features are blocked | Status filter "Blocked" — the badge count tells you upfront if there are any. |

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Multi-column sort | Today the table is unsorted; clickable headers with multi-sort would help long lists. |
| Saved filter presets | "My blocked frontend work" as a one-click filter combo. |
| Bulk status change | Today batch only dispatches; bulk move-to-done / move-to-blocked would speed grooming. |
| Inline progress edit | Today progress is read-only here; an inline editor (like the Dashboard) would close the loop. |
| Run history search | The Detail Panel lists run history but does not filter — search by command or model would help diagnose flakes. |

## References

- Page route: [`app/features/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/features/page.tsx)
- View: [`app/ui/views/FeaturesView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/FeaturesView.tsx)
- Table: [`components/table/TableCore.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/table/TableCore.tsx)
- Detail panel: [`app/ui/FeatureDetailPanel.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/FeatureDetailPanel.tsx)
- Single dispatch: [`components/table/TaskDispatchModal.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/table/TaskDispatchModal.tsx)
- Batch dispatch: [`components/table/BatchDispatchModal.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/table/BatchDispatchModal.tsx)
- Agent workflows: [`lib/agent-workflows`](https://github.com/jason660519/Project-Manager/tree/main/lib/agent-workflows)
