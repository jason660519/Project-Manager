# F19 TDD Spec — Plugins → Connect Sheet

This document is **scenario-first**: each `S-NN` is a user-visible behaviour with a deterministic pass/fail. They are written so a future engineer can either (a) walk them manually in the running app, or (b) translate each block into Vitest / Playwright code without re-deriving intent.

The scenarios are partitioned into three groups: navigation, built-in connector lifecycle, custom connector lifecycle. A persistence pass at the bottom re-runs the critical subset after a hard reload to guard against regressions in `localStorage` glue.

## Conventions

- "Sheet" = the visible `ConnectSheet` content area, **not** the whole page.
- "Counter" = the `N / total connected` chip at the top-left of the sheet.
- "localStorage key" = `pm:connect:state`.
- "Clean state" = `localStorage.removeItem('pm:connect:state')` then reload.

---

## Group A — Navigation & Shell

### S-01: Connect tab appears in the sheet bar
**Given** the user is on `/plugins`
**When** the page is loaded
**Then** a `CONNECT` button is visible in the bottom sheet bar, after `COMPANY-AI-APP-DESIGN STANDARDS`.

### S-02: Activating Connect hides the table toolbar
**Given** the user is on the Plugins sheet (default)
**When** the user clicks `CONNECT`
**Then** the search input, "All categories" select, density select, freeze input, and Path/Notes checkboxes are no longer rendered.

### S-03: Activating Connect renders the new sheet
**Given** the user clicked `CONNECT`
**Then** a 5-column table is visible with column headers in this exact order: `CATEGORY`, `TOOL`, `INSTALL METHOD`, `INSTRUCTIONS`, `STATUS`.

### S-04: Switching away from Connect restores the table
**Given** the user is on `CONNECT`
**When** the user clicks `PLUGINS`
**Then** the search/category/density toolbar reappears and the inventory table is shown.

---

## Group B — Built-in Connector Lifecycle

### S-05: First-time empty state
**Given** clean state
**When** the user opens Connect
**Then** all 10 built-in rows show gray dot `Not connected` and a `Connect` button. Counter reads `0 / 10 connected`.

### S-06: Connect a single built-in
**Given** S-05
**When** the user clicks `Connect` on the GitHub row
**Then** the GitHub row's Status cell flips to green dot `Connected` with a `Revoke` button, and the counter reads `1 / 10 connected`.

### S-07: Revoke a connected built-in
**Given** S-06
**When** the user clicks `Revoke` on the GitHub row
**Then** the row returns to `Not connected` + `Connect` and the counter reads `0 / 10 connected`.

### S-08: Multiple built-ins can be connected independently
**Given** S-05
**When** the user clicks `Connect` on GitHub, then `Connect` on Linear, then `Connect` on Notion
**Then** all three rows show `Connected`, the rest show `Not connected`, and the counter reads `3 / 10 connected`.

### S-09: The action button verb is never ambiguous
**Given** any row in any state
**Then** the action button label is either exactly `Connect` (when not connected) or exactly `Revoke` (when connected). The label `Disconnect` MUST NOT appear in the Status column.

> **Rationale.** This was the original defect the user flagged: showing `Connected` (state) next to `Disconnect` (button) reads as two contradictory facts. The fix is to keep the button verb distinct from the state noun.

### S-10: Row categories are correctly assigned
**Then** the Category cell shows the expected category for each built-in:

| Connector | Category |
|---|---|
| Google Calendar | Productivity |
| Google Drive | Productivity |
| GitHub | Dev |
| Vercel | Dev |
| Notion | Productivity |
| Gamma | Productivity |
| Linear | Project |
| Outlook | Ops |
| Outlook Calendar | Ops |
| Canva | Design |

### S-11: Install Method badge renders
**Then** the Install Method column shows a small pill-style badge per row matching the spec (`OAuth 2.0`, `OAuth 2.0 (Azure AD)`, `API Token`, `API Key`).

---

## Group C — Custom Connector Lifecycle

### S-12: Add-your-own button opens the dialog
**Given** the sheet is rendered
**When** the user clicks `+ Add your own connector`
**Then** the `Custom Connector` modal appears, dimming the page behind it. The Name input is auto-focused.

### S-13: Add button is disabled until both fields are non-empty (after trim)
**Given** the dialog is open
**Then** with empty Name and empty Server URL, `Add Connector` is disabled.
**When** the user types `   ` (whitespace only) into Name
**Then** the button stays disabled.
**When** the user clears Name and types `Gmail` into Name and leaves Server URL empty
**Then** the button stays disabled.
**When** the user also types `https://mcp.gmail.example.com/sse` into Server URL
**Then** the button becomes enabled.

### S-14: Submit via the Add Connector button
**Given** S-13 reached the enabled state
**When** the user clicks `Add Connector`
**Then** the dialog closes, and a new row appears under the `CUSTOM` group with name `Gmail`, the entered server URL, a `custom` badge, gray dot `Not connected`, a `Connect` button, and a trash-can icon.

### S-15: Submit via Enter key in Server URL
**Given** the dialog is open with valid Name and Server URL
**When** the user presses Enter while focused in the Server URL field
**Then** the same effect as S-14 happens.

### S-16: Cancel button discards
**Given** the dialog is open with Name=`Discarded` and Server URL=`https://x`
**When** the user clicks `Cancel`
**Then** the dialog closes and no new row is added.

### S-17: X icon discards
**Same as S-16** but the user clicks the X icon. Same expected outcome.

### S-18: Connect / Revoke a custom row
**Given** the Gmail row from S-14 exists
**When** the user clicks `Connect` on the Gmail row
**Then** it flips to `Connected` + `Revoke`. The counter increases by 1 and the denominator is `10 + 1 = 11`.

### S-19: Delete a custom row
**Given** the Gmail row exists in any state
**When** the user clicks the trash-can icon
**Then** the row is removed from the table. The counter denominator decreases by 1. If the row was connected, the counter numerator decreases by 1 too.

### S-20: Multiple custom connectors coexist
**Given** the sheet has no custom rows
**When** the user adds two custom connectors with different names
**Then** both appear under the `CUSTOM` group as separate rows. The counter denominator is `12`.

### S-21: Custom rows allow duplicate names
**Given** a custom row named `My Server` exists
**When** the user opens the dialog and adds another `My Server`
**Then** the add succeeds and there are now two distinct rows with the same display name, each with its own UUID and trash-can.

> **Rationale.** Names are labels, IDs are identity. Forcing uniqueness adds UX friction for a prototype-stage feature.

---

## Group D — Persistence

### S-22: State survives a hard reload
**Given** clean state
**When** the user connects GitHub, adds a custom `Gmail` connector and connects it, then presses F5
**Then** after reload, GitHub still shows `Connected`, the Gmail custom row still exists and still shows `Connected`, and the counter is `2 / 11 connected`.

### S-23: Counter and state match after partial state in `localStorage`
**Given** `localStorage.setItem('pm:connect:state', '{"connected":{"github":true},"custom":[]}')` and a reload
**Then** GitHub shows `Connected`, every other row shows `Not connected`, and the counter is `1 / 10 connected`.

### S-24: Corrupt `localStorage` falls back to empty state
**Given** `localStorage.setItem('pm:connect:state', 'this is not json {')` and a reload
**Then** the sheet renders with all rows `Not connected` and no error in the console. (The malformed value is silently replaced on the next state mutation.)

### S-25: SSR / static export safe
**Given** the app is built via `next build` (static export) and opened in the Tauri webview
**Then** there is no hydration warning in the console, and the sheet renders correctly after first paint.

---

## Group E — Negative / Defensive

### S-26: localStorage write throws
**Given** `localStorage.setItem` is monkey-patched to throw (quota exceeded)
**When** the user clicks `Connect` on any row
**Then** the UI still flips to `Connected` in-memory; no exception bubbles to the console. (Data loss on reload is acceptable in this edge case.)

### S-27: Reload mid-typing in dialog
**Given** the dialog is open with text typed in
**When** the user reloads the page
**Then** the dialog is closed (because dialog state is component-local) and no orphan record was written.

### S-28: Counter denominator with no custom rows
**Given** clean state and no custom rows
**Then** the counter denominator is exactly `10`. (Guards against off-by-one when the custom list is empty.)

---

## Out of Scope for F19

These scenarios are explicitly **not** tested in F19 and are reserved for follow-up features:

- Real OAuth round-trips.
- MCP handshake / capability negotiation for custom URLs.
- Multi-account binding per connector.
- Scope/permission picker.
- Per-project (vs per-install) connection state.

## Manual Test Execution

Until automated tests are wired in (see Open Items in `dev-log.md`), this spec is executed manually. The full pass output lives in [`tdd-report.md`](tdd-report.md) and should be re-recorded any time `ConnectSheet.tsx` changes substantively.
