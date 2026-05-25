---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Sessions guide with no secrets, credentials, or private infrastructure details.
---

# Sessions

The **Sessions** view is your transcript archive for AI conversations and agent runs that Project Manager has captured for the currently selected project. Every saved session — every `assistant` and `user` turn, the model that answered, and the tokens it spent — is browsable here without leaving the desktop shell.

## At a glance

Open **Sessions** from the sidebar (under the *Observe* group) and you land on a two-pane layout:

- **Left panel** — a chronological list of every session for the active project, grouped by date.
- **Right panel** — the full transcript of the session you clicked, plus token totals at the bottom.

The session list is loaded from `<projectRoot>/.project-manager/sessions/`, where each session is a single `.json` file. Sessions are sorted **newest first**.

## Anatomy of the page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SESSIONS                                                                    │  ← page header (left panel)
│ 42 conversation record(s)                                                   │
├──────────────────────┬──────────────────────────────────────────────────────┤
│ 2026-05-25           │ Investigate ingestion crash on .docx with embedded… │  ← session title
│ ▸ Investigate inge…  │ ⚙ claude-opus-4-7   🕒 14:32   12 turns   8.4k tok  ↕ │  ← header strip
│   12 turns · 8.4k    │ ─────────────────────────────────────────────────── │
│   14:32              │                                                      │
│ ▸ Fix bridge typo    │   [AI]  I'll start by reading the ingestion module… │
│   3 turns · 1.2k     │                                                      │
│   13:18              │   [U]   Please trace the panic stack first.         │
├──────────────────────┤                                                      │
│ 2026-05-24           │   [AI]  Reading src-tauri/src/lib.rs::call_anth…     │
│ ▸ Re-map F23 capab…  │         in: 142 · out: 891                          │
│   8 turns · 4.1k     │                                                      │
│   09:47              │                                                      │
├──────────────────────┴──────────────────────────────────────────────────────┤
│ in: 3,210 · out: 5,184 · total: 8,394                                       │  ← token summary footer
└─────────────────────────────────────────────────────────────────────────────┘
```

## Where sessions come from

Project Manager writes a session file every time the dashboard records an AI exchange that it wants to persist. Today the main producer is the dispatched-engineer flow described in ADR-012; the file format is also used by ingestion runs and the in-app chat panel when they decide a turn is worth keeping.

Each `.json` file at `<projectRoot>/.project-manager/sessions/<id>.json` deserializes to the `AgentSession` shape below:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique session identifier (UUID). |
| `title` | string | Human-readable title shown in the list and transcript header. |
| `projectId` | string? | Optional link back to a `ProjectEntry`. |
| `featureId` | string? | If the session was a feature-scoped dispatch, the feature ID it ran for. |
| `agentId` | string? | The adapter / role that produced the session. |
| `model` | string | Model name returned by the provider, e.g. `claude-opus-4-7`. |
| `messages` | `SessionMessage[]` | Ordered list of turns. |
| `startedAt` / `completedAt` | ISO strings | Timestamps; `completedAt` is unset while the session is still active. |
| `totalInputTokens` / `totalOutputTokens` | number | Aggregated across all messages. |
| `status` | `'active' \| 'completed' \| 'error'` | Run lifecycle. |
| `tags` | string[]? | Optional categorisation. |

Each `SessionMessage` has a `role` (`user` / `assistant` / `system`), `content`, `timestamp`, and optional per-turn `inputTokens` / `outputTokens`. System messages are stored but hidden from the transcript pane.

## The session list (left panel)

| Element | Description |
|---|---|
| Sticky date header | Groups every session by its `startedAt` date in the user's locale. |
| Session row | Shows title, turn count, token total, and the start time. The active row is highlighted in dark emerald with an arrow marker. |
| Counter at top | `<n> conversation record(s)` reflects the total returned by the bridge. |
| Empty state | "No conversations yet." shown when the directory is empty or missing. |

Clicking a row swaps the right panel to the transcript view.

## The transcript (right panel)

The right panel has three regions:

1. **Header** — title, plus a meta strip with model, start time, turn count, total tokens, and a coloured status pill:
   - `completed` — emerald
   - `error` — red
   - `active` — amber
   - The `Feature: <id>` line appears below when `featureId` is set.
2. **Message body** — every non-system message rendered as a chat bubble. Assistant turns sit on the left with an `AI` avatar, user turns on the right with a `U` avatar. Per-message `in:` / `out:` token counts appear beneath the bubble when present.
3. **Token summary footer** — fixed at the bottom, showing `in: <n> · out: <n> · total: <n>` formatted in the locale (e.g. `8,394` in en-US, `8 394` in fr-FR).

## How loading works

The view calls `listSessions(<projectRoot>/.project-manager/sessions)` on mount and whenever the project root changes. Under the hood:

| Layer | What happens |
|---|---|
| Bridge wrapper | `lib/bridge/index.ts` → `listSessions()` invokes the `list_sessions` Tauri command. In the browser preview (`npm run dev`) it short-circuits to `[]`. |
| Rust handler | `src-tauri/src/lib.rs::list_sessions` creates the directory if missing, reads every `*.json` file, deserializes anything that matches `AgentSession`, and returns the list sorted newest-first. |
| Renderer | The view sorts the loaded array into date groups and renders the panel above. |

Because the list is read once per project switch, the right way to refresh it after writing a new session externally is to click a different project in the sidebar and back, or restart the app.

## What you can do here

| Action | How |
|---|---|
| Browse all sessions for a project | Switch projects in the sidebar; the panel reloads automatically. |
| Open a transcript | Click any row in the left panel. |
| Read long replies | Scroll within the transcript pane — the bubbles wrap and respect newlines (`whitespace-pre-wrap`). |
| Verify token spend | Read the per-message tokens inside each bubble and the aggregated total in the footer. |
| Confirm the status of a run | Look at the coloured pill in the header (`active` / `completed` / `error`). |

## What you cannot do here (yet)

The view is intentionally read-only in its first iteration. The following are tracked as follow-ups:

- Filtering or searching across sessions
- Deleting / archiving sessions from the UI
- Live updates while a session is still `active`
- Exporting a transcript as Markdown
- Cross-project session views

## Empty state and dry-run mode

| Situation | What you see |
|---|---|
| Directory missing or empty | "No conversations yet. Conversations started through ingestion or AI features will appear here automatically." |
| Browser preview (no Tauri) | `listSessions` returns `[]`, so you also see the empty state. |
| No project selected | The view is not rendered — the sidebar item is hidden until a project is selected on the dashboard. |
| Loading | The counter shows `Loading…` until the bridge call resolves. |

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Search and filter by title, feature, agent, or status | The archive grows quickly once you start dispatching engineers — `Ctrl+F` is the obvious next step. |
| Live "active" sessions | Stream messages from in-flight runs instead of waiting for them to be saved. |
| Delete / archive selected sessions | The current workflow requires removing JSON files manually on disk. |
| Export to Markdown / clipboard | Useful for pasting into postmortems or PR descriptions. |
| Cross-project unified view | A "show all projects" mode for users who jump between repos. |
| Inline cost estimates | Multiply token totals by provider pricing to show approximate spend per session. |
| Tag editing from the UI | The `tags` field already exists on the type but is not yet editable. |

## References

- Source: [`app/ui/views/SessionsView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/SessionsView.tsx)
- Bridge wrapper: [`lib/bridge/index.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/bridge/index.ts) (`listSessions`, `readSession`, `saveSession`)
- Rust handler: [`src-tauri/src/lib.rs`](https://github.com/jason660519/Project-Manager/tree/main/src-tauri/src/lib.rs) (`list_sessions`, `read_session`, `save_session`)
- Type definitions: [`lib/types/index.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/types/index.ts) (`AgentSession`, `SessionMessage`)
- Dispatch flow: [`docs/architecture/ADR-012-dispatch-engineer.md`](https://github.com/jason660519/Project-Manager/tree/main/docs/architecture/ADR-012-dispatch-engineer.md)
