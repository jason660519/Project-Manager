---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Logs guide with no secrets, credentials, or private infrastructure details.
---

# Logs

The **Logs** view is Project Manager's centralised observability surface. It shows everything that is currently running, everything that ran in this app session, every cron firing, and lets you browse the development-log markdown that engineers (you, or your AI teammates) drop into a feature folder.

## At a glance

Open **Logs** from the sidebar (under the *Observe* group). The view is a single workstation with three tabs at the top:

| Tab | Shows | Live? |
|---|---|---|
| **Runs** | Active processes (with kill button) + recent completed runs | Yes — refreshes as processes emit output |
| **Cron** | Every cron firing grouped by day | Yes — appends as cron jobs fire |
| **Dev Logs** | Per-feature folder of `.md` / `.html` summaries on disk | On-demand — loaded when you select a feature |

The Runs tab gets a small emerald badge next to its name when there is at least one active process so you don't miss long-running jobs while you are on another tab.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Runs (1)]  Cron   Dev Logs                                                 │  ← tab bar
├─────────────────────────────────────────────────────────────────────────────┤
│ ACTIVE                                                                      │
│ ⚡ Feature F23 — re-map capabilities       PID 7421   1m 12s  [Log] [Kill]  │
│    claude --feature F23 --apply                                             │
│ ┌── log (last 50 lines) ───────────────────────────────────────────────┐    │
│ │ [14:32:09] Loading feature plan…                                     │    │
│ │ [14:32:11] Calling provider with model claude-opus-4-7               │    │
│ │ …                                                                    │    │
│ └──────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│ HISTORY                                                                     │
│ ✓ Hourly sync             exit 0       12s     14:30:01                     │
│ ✗ Smoke test              exit 1       38s     14:00:14                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tab 1: Runs

This is the live view of every process that has been spawned through the dispatch bridge in this app session — manual feature dispatches **and** cron firings both end up here.

### Active section

Shown only when there is at least one process running.

| Element | What it does |
|---|---|
| Activity icon | Pulsing emerald dot — signals the process is alive. |
| Feature name + PID | The label the dispatch was tagged with, plus the process ID. |
| Command line | The actual `command + args` that was spawned, in monospace. |
| Elapsed time | Refreshes from `startedAt` to "now". |
| **Log / Hide** | Expand or collapse the live tail (last 50 lines, monospace, wrap on). The body says "Waiting…" while no output has arrived yet. |
| **Kill** | Sends a terminate signal via the bridge's `killRun` command. The row moves to History once the process exits. |

### History section

Lists every completed run from this app session, newest first.

| Field | What it shows |
|---|---|
| Status icon | Green check if `exitCode === 0`, red cross otherwise. |
| Feature name | The label the dispatch was tagged with. |
| Exit | `exit <code>` in green or red. |
| Command preview | The command plus the first two args (full args in the expanded log). |
| Duration | `completedAt - startedAt`, formatted as `12s` or `1m 38s`. |
| Time | Wall-clock completion time in the user's locale. |

Click any row to expand the captured log (last 50 lines). History is **in-memory only** — restarting the app clears it. The bridge keeps a longer per-run log file on disk; the Logs view shows the tail in memory.

### Empty state

```
No runs yet in this session.
Dispatch a feature to see history here.
```

You'll see this if nothing has been spawned since the app started.

## Tab 2: Cron

A daily-grouped chronicle of every cron firing this app session. Each row shows the same status icon, job name, optional PID, and relative time as the Recent Runs section on the Cron Jobs view — but here the view goes back as far as the in-memory `cronHistory` buffer (capped at the most recent 100 entries).

```
2026-05-25
  ✓ Hourly sync       PID 7421     22m ago
  ✓ Hourly sync       PID 7361     1h ago
  ✗ Smoke test        PID 7390     28m ago

2026-05-24
  ✓ Nightly metric    PID 7188     16h ago
```

| Field | Meaning |
|---|---|
| Day header | Locale-formatted date pulled from each entry's `firedAt`. |
| Status icon | Green check for `ok`, red cross for `error` (spawn failed or the process exited non-zero). |
| Name | The job name at the moment it fired (renames after-the-fact are not back-applied). |
| PID | `PID <n>` when the spawn succeeded. Absent on pre-spawn errors. |
| Relative time | `Xs / Xm / Xh / Xd ago`. |

### Empty state

```
No cron runs recorded yet.
Cron jobs appear here as they fire.
```

To start populating this tab, create a job in [Cron Jobs](./cron-jobs.md) and enable it.

## Tab 3: Dev Logs

A simple browser for the markdown / HTML summaries each feature folder collects. This is where engineers drop change logs, post-mortems, and recap docs — and where you go to read them without leaving the dashboard.

### Layout

```
┌────────────────┬──────────────────────────────────────────────────────┐
│ FEATURES       │ [2026-05-25.md] [2026-05-24.md] [overview.md]        │
│ ▸ F01 Ingestion│ ┌──────────────────────────────────────────────────┐ │
│ ▸ F18 Dispatch │ │ 2026-05-24.md                                    │ │
│ ▸ F23 Capab…   │ │                                                  │ │
│                │ │   ## Summary                                     │ │
│                │ │   …                                              │ │
│                │ └──────────────────────────────────────────────────┘ │
└────────────────┴──────────────────────────────────────────────────────┘
```

| Pane | What it does |
|---|---|
| **Features** (left) | One row per feature that has `paths.developmentLogSummaryFolder` set in the project config. Click to load that folder. |
| **File chips** (top right) | Every `.md` / `.html` file in the selected folder, listed flat, sorted **newest filename first** (so `2026-05-25.md` precedes `2026-05-24.md`). Click a chip to load its content. |
| **Content** (bottom right) | Raw text of the selected file in a scrollable monospace pane. |

### Reading order

The view does **not** parse Markdown — it shows the file verbatim. This is intentional: dev logs are often short, structured, and benefit from showing the raw source (front-matter, code fences, exact whitespace).

### Empty states

| Situation | What you see |
|---|---|
| No features have `developmentLogSummaryFolder` set | "No dev log folders configured. Set `paths.developmentLogSummaryFolder` on a feature to see logs here." |
| Feature folder is empty | "No .md / .html files found in `<folder>`." |
| Browser preview (no Tauri) | The bridge can't read disk, so the content area shows "(Unable to read file — Tauri runtime required)." |
| File loaded but empty | `(empty)` placeholder text. |

## Differences from related views

| If you want… | Use… |
|---|---|
| The transcript of an AI conversation (with token totals) | [Sessions](./sessions.md) |
| To create or edit a scheduled job | [Cron Jobs](./cron-jobs.md) |
| Live tail of an active dispatch + kill button | **Logs → Runs** (this view) |
| Past cron firings across the day | **Logs → Cron** (this view) |
| Free-form engineer notes per feature | **Logs → Dev Logs** (this view) |

## Bridge surface

Every piece of data on this view is fed through `lib/bridge/index.ts`:

| Source | Bridge entry point | Notes |
|---|---|---|
| Active runs + history | `spawnAgent`, `onAgentOutput`, `onAgentExit`, `killRun` | Producer is `MainClient`'s dispatch handler. |
| Cron history | The cron heartbeat in `MainClient`. | Kept in React state, capped at 100 entries. |
| Dev-log file lists | `listProjectFiles(folder, depth=1)` | Tauri-only; returns `[]` in the browser preview. |
| File contents | `readFile(path)` | Tauri-only; throws in the browser preview, which the view surfaces as a friendly message. |

## Lifecycle notes

- **In-memory only.** None of the Runs or Cron history is persisted across app restarts. The dev-log files, of course, live on disk and persist forever.
- **Killing a process is asynchronous.** After clicking **Kill**, the row stays in Active until the OS reports the exit; then it moves to History with the actual exit code.
- **Truncation.** The expanded log panel shows `logs.slice(-50)` — the last 50 captured lines. Earlier output is preserved in the underlying log file on disk (see the bridge surface above).
- **No project switching needed.** Active runs, history, and cron firings are global across all projects; the dev-log tab honours the currently-selected project.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Persistent runs / cron history | So you can answer "did anything fail overnight?" after closing the laptop. |
| Search across run logs | Today you can only scroll. |
| Markdown rendering in Dev Logs | Pretty-printed headings, fenced code blocks, internal links. |
| Stream the dev-log folder | Auto-refresh chips when a new file appears (e.g. an engineer just committed today's note). |
| Filter Runs by project / feature | Right now everything shares one list. |
| Export a run log | Save the captured stdout to a file or copy to clipboard. |
| Open the file in the system editor | A "↗" button next to each dev-log chip. |

## References

- Source: [`app/ui/views/LogsView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/LogsView.tsx)
- Producer (active runs, history, cron): [`app/ui/MainClient.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/MainClient.tsx)
- Bridge surface: [`lib/bridge/index.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/bridge/index.ts) (`spawnAgent`, `killRun`, `listProjectFiles`, `readFile`)
- Type definitions: [`lib/types/index.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/types/index.ts) (`ActiveRun`, `CompletedRun`, `CronRun`, `Feature.paths`)
- Related views: [Cron Jobs](./cron-jobs.md), [Sessions](./sessions.md)
