# F19 TDD Report — Plugins → Connect Sheet

Pass/fail log for the scenarios in [`tdd-spec.md`](tdd-spec.md). Executed manually in the running app on 2026-05-24 against `app/ui/views/Plugins/ConnectSheet.tsx` at the state captured in [`dev-log.md`](dev-log.md).

## Summary

| Group | Pass | Fail | Notes |
|---|---|---|---|
| A. Navigation & Shell | 4 / 4 | 0 | |
| B. Built-in connector lifecycle | 7 / 7 | 0 | S-08 surfaced a stale-closure bug; fixed mid-run; re-verified |
| C. Custom connector lifecycle | 10 / 10 | 0 | S-19 selector required `title="Remove"` (no aria-label) — see follow-up |
| D. Persistence | 4 / 4 | 0 | |
| E. Negative / defensive | 3 / 3 | 0 | |
| **Total** | **28 / 28** | **0** | |

## Detailed Results

### Group A — Navigation & Shell

| ID | Result | Evidence |
|---|---|---|
| S-01 | ✅ | `CONNECT` button observed in bottom sheet bar after `COMPANY-AI-APP-DESIGN STANDARDS`. |
| S-02 | ✅ | After activating CONNECT, `document.querySelector('input[placeholder*="Search name"]')` returns null. |
| S-03 | ✅ | Table headers in order: `Category, Tool, Install Method, Instructions, Status`. |
| S-04 | ✅ | Round-trip: switch to PLUGINS (inventory table reappears with 10 columns) → back to CONNECT (state preserved: counter `3/10`, GitHub/Notion/Linear still connected). |

### Group B — Built-in Connector Lifecycle

| ID | Result | Evidence |
|---|---|---|
| S-05 | ✅ | Clean state → all 10 rows show gray dot `Not connected` + `Connect` button. Counter `0 / 10 connected`. |
| S-06 | ✅ | Click `Connect` on GitHub → row becomes `Connected` + `Revoke`. Counter `1 / 10`. |
| S-07 | ✅ | Click `Revoke` on GitHub → back to `Not connected` + `Connect`. Counter `0 / 10`. |
| S-08 | ✅ | After fix — synchronous clicks on GitHub + Linear + Notion all persist. Counter `3 / 10`. `localStorage.pm:connect:state.connected = {github:true, linear:true, notion:true}`. |
| S-09 | ✅ | Page-wide assertion `document.body.innerText.includes('Disconnect')` returns `false`. Action buttons only ever say `Connect` or `Revoke`. |
| S-10 | ✅ | Category mapping audit matches spec exactly (Dev × 2, Ops × 2, Productivity × 4, Project × 1, Design × 1). |
| S-11 | ✅ | Distinct install method badges observed: `OAuth 2.0`, `OAuth 2.0 (Azure AD)`, `API Token`, `API Key`. |

### Group C — Custom Connector Lifecycle

| ID | Result | Evidence |
|---|---|---|
| S-12 | ✅ | `Add your own connector` opens modal; `document.activeElement === nameInp` confirms auto-focus on Name. |
| S-13 | ✅ | All four sub-states verified: empty/empty, whitespace-only Name, Name-only, URL-only → button disabled. Both filled → button enabled. |
| S-14 | ✅ | Clicking `Add Connector` with `Gmail` + `https://mcp.gmail.example.com/sse` closes dialog and adds row under `CUSTOM` with `custom` badge, `Not connected` state. |
| S-15 | ✅ | Enter key in Server URL submits — dialog closed, row added. |
| S-16 | ✅ | After typing `Discarded` + URL and clicking Cancel → no `Discarded` row. |
| S-17 | ✅ | After typing `XCloseTest` and clicking X icon → no `XCloseTest` row. |
| S-18 | ✅ | Clicking Connect on a custom Gmail row flipped counter `3 / 12 → 4 / 12`. |
| S-19 | ✅ | Clicking Remove (the trash icon) on the connected Gmail row dropped counter to `3 / 11` (both numerator and denominator down by 1, matching the spec for deleting a connected custom row). See follow-up: trash button needs `aria-label`. |
| S-20 | ✅ | Two custom rows coexisted side-by-side after two `Add` flows. Denominator `12`. |
| S-21 | ✅ | Both Gmail custom rows existed with distinct UUIDs and distinct server URLs. Duplicate names not rejected. |

### Group D — Persistence

| ID | Result | Evidence |
|---|---|---|
| S-22 | ✅ | F5 reload preserves: 3 built-ins connected, 1 custom Gmail row, counter `3 / 11`. |
| S-23 | ✅ | Pre-set `localStorage` with `{"connected":{"github":true},"custom":[]}` + reload → counter `1 / 10`, only GitHub shows `Connected`. |
| S-24 | ✅ | Pre-set malformed JSON + reload → counter `0 / 10`, no error rendered. |
| S-25 | ✅ | Browser console after reload contains only React DevTools tip and `[HMR] connected` — no hydration warning. |

### Group E — Negative / Defensive

| ID | Result | Evidence |
|---|---|---|
| S-26 | ✅ | After monkey-patching `localStorage.setItem` to throw on the storage key, clicking Connect on Vercel still flipped the UI to `Revoke` and counter `1 / 10`. No error surfaced in the document. |
| S-27 | ✅ | Typed `MidTyping` into Name field, then F5 — on next visit to the sheet, dialog is closed, no `MidTyping` row, `localStorage` is null. Dialog state correctly scoped to component. |
| S-28 | ✅ | Counter denominator is exactly `10` with no custom rows present. |

## Defects Found and Fixed During Execution

### D-01 — Stale-closure state updates

**Surfaced by**: S-08
**Symptom**: When three Connect buttons were clicked in the same React tick, only the last write to `localStorage` survived. UI showed only Notion as connected; GitHub and Linear were silently lost.

**Root cause**: `toggleBuiltin`, `toggleCustom`, `removeCustom`, `addCustom` all read `state` from the rendering closure, then called `persist(...)` with a value derived from that snapshot. React batches `setState` calls so all three handlers ran against the same initial state; the last `setState(next)` won and `saveState` was called three times, each clobbering the previous.

**Fix**: Switched `persist` to accept an updater function and forwarded the functional form to `setState`. All state mutations now read `prev` from React's queue instead of the closure.

```ts
// Before
const persist = (next: ConnectState) => { setState(next); saveState(next); };
const toggleBuiltin = (id: string) =>
  persist({ ...state, connected: { ...state.connected, [id]: !state.connected[id] } });

// After
const persist = (updater: (prev: ConnectState) => ConnectState) => {
  setState((prev) => {
    const next = updater(prev);
    saveState(next);
    return next;
  });
};
const toggleBuiltin = (id: string) =>
  persist((prev) => ({ ...prev, connected: { ...prev.connected, [id]: !prev.connected[id] } }));
```

**Re-verification**: S-08 re-run after fix — `connected: {github:true, linear:true, notion:true}` persisted to `localStorage`, counter shows `3/10`. ✅

## Follow-ups (not blockers for F19)

- **A11y — trash icon label.** The Remove button currently only has `title="Remove"`. Add an `aria-label` to make it discoverable by screen readers and easier to target in automated tests.
- **HMR dev-mode UX.** Editing `ConnectSheet.tsx` causes HMR to reset `activeSheet` back to `plugins`. Cosmetic only — not present in production builds — but distracting during local dev.
- **No automated test harness wired.** The scenarios above were executed by hand-driving the browser via Chrome MCP. Translating them into Vitest + a React testing library + jsdom would let future regressions catch the D-01 bug automatically.
