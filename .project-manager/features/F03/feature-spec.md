# F03 — Live Run Inspector

**Status**: in_progress | **Progress**: 30%  
**Category**: Frontend/Monitor  
**Phase**: Development

## Summary

Real-time view of active agent/IDE dispatch runs. Shows run status, output stream, duration, exit codes, and kill controls. Split into two sections: **Active** (currently running) and **History** (completed/failed runs).

## User Stories

| ID | Story |
|----|-------|
| US-01 | As a user, I want to see a live list of **active runs** with their command, PID, duration, and latest log output so I can monitor progress. |
| US-02 | As a user, I want to expand an active run to view its **live log stream** so I can debug or verify execution. |
| US-03 | As a user, I want to **kill** a running process with a confirmation step to avoid accidental termination. |
| US-04 | As a user, I want to see a **run history** list with exit codes and success/failure indicators so I can review past execution results. |
| US-05 | As a user, I want to expand a completed run to inspect its **full log output** for debugging. |
| US-06 | As a user, I want to see an **empty state** when there is no run history yet, with guidance on how to start dispatching. |
| US-07 | As a user, I want all UI labels to be **localized** via the project i18n system. |

## UI Mockup / Structure

```
┌──────────────────────────────────────────────┐
│  RUNS                                        │
│  2 active · 5 in history.                    │
│                                              │
│  ┌─ ACTIVE ───────────────────────────────┐  │
│  │ 🔴 Feature A       PID 12345    35s    │  │
│  │    codex --spec F03              [Log] [Kill]│
│  │  ┌─ Log ────────────────────────────┐  │  │
│  │  │  Starting...                     │  │  │
│  │  │  Analyzing spec...               │  │  │
│  │  └──────────────────────────────────┘  │  │
│  │ 🔴 Feature B       PID 12346    12s    │  │
│  │    cursor --tds F12              [Log] [Kill]│
│  └──────────────────────────────────────┘  │
│                                              │
│  ┌─ HISTORY ──────────────────────────────┐  │
│  │ ✅ Feature C       exit 0     2m30s    │  │
│  │ ❌ Feature D       exit 1     1m05s    │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Acceptance Criteria

### AC-01: Active Run Display
- [ ] Active run card shows: feature name, PID, command + args, elapsed duration
- [ ] Duration updates on each render (uses `Date.now() - run.startedAt`)
- [ ] Green pulse indicator icon on each active run
- [ ] "Kill" button visible (red-themed) next to each active run

### AC-02: Log Expansion (Active)
- [ ] Clicking "View Log" expands the active run to show log lines
- [ ] Clicking "Hide Log" collapses it back
- [ ] When there are no logs yet, shows "Waiting for output…" with a pulsing animation

### AC-03: Kill Confirmation
- [ ] Clicking "Kill" shows a confirmation dialog with feature name and PID
- [ ] Confirmation dialog has "Confirm" and "Cancel" buttons
- [ ] "Confirm" calls `onKillRun(pid)` and removes the dialog
- [ ] "Cancel" removes the dialog without killing
- [ ] Dialog is rendered inline (not a separate modal)

### AC-04: Run History Display
- [ ] History list shows: feature name, exit code, duration, completion time
- [ ] ✅ icon (green) for successful runs, ❌ icon (red) for failed runs
- [ ] History items are clickable to expand logs

### AC-05: Log Expansion (History)
- [ ] Clicking a history run toggles log visibility
- [ ] Only shows logs if `run.logs.length > 0`
- [ ] Shows last 50 log lines

### AC-06: Empty State
- [ ] When `runHistory.length === 0`, shows a centered empty state with Terminal icon
- [ ] Shows helpful text: "No runs yet in this session."
- [ ] Shows hint text: "Dispatch a feature from Dashboard or Features to see history here."

### AC-07: i18n Localization
- [ ] All user-facing strings use `t.runs.*` i18n keys
- [ ] Supports 4 locales: en, zh-hant, zh, ja
- [ ] Hard-coded strings replaced — no raw Chinese/English in JSX text nodes

## Dependencies

- `lib/types/index.ts` — `ActiveRun`, `CompletedRun` types (needed)
- `app/ui/views/RunsView.tsx` — existing implementation (to modify)
- `lib/i18n/types.ts` — needs new `runs` section
- `lib/i18n/en.ts`, `zh-hant.ts`, `zh.ts`, `ja.ts` — needs translations

## Out of Scope

- Live-streaming from Tauri bridge (future work)
- Persisting run history to sessions store (future work)
- Filter by project / engineer role (future work)
- Pause / resume controls (future work)
