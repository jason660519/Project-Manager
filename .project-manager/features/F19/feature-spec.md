# F19 Feature Spec — Plugins → Connect Sheet

## Problem Statement

The Integrations Hub (`/plugins`) inventories what is **installed** on disk — plugins, skills, channels, memory, slash commands, and company standards. It has no representation for the **identities** the workspace is allowed to act on behalf of: Google accounts, GitHub repos, Notion workspaces, Microsoft tenants, custom MCP servers.

Without a single place to view and manage these identities, users:
- Cannot tell at a glance which external tools the workspace can already reach.
- Have no path to register a new MCP server connector without editing config files.
- Mix transient credentials between providers because there is no UX surface to claim or revoke them.

## User Stories

1. **At-a-glance audit** — As a Developer setting up a new machine, I can open `/plugins` → Connect and immediately see which built-in connectors (Google Calendar, GitHub, Notion, …) are already linked to this workspace and which are not.
2. **One-click connect/revoke** — As a User, I can connect or revoke a single built-in connector with one click, without leaving the Integrations Hub.
3. **Custom MCP registration** — As a Power User, I can register an arbitrary MCP server by entering a name and an SSE/HTTP URL, and it appears in my Connect sheet alongside the built-ins.
4. **Disambiguated state and action** — As a User, when I look at a connector row I can tell **what state it is in** (Connected vs Not connected) and **what action I would take next** (Revoke vs Connect) without confusion.
5. **Persistence across reloads** — As a User, when I refresh the app my connection state and custom connectors survive — I do not have to re-add Gmail every time I open the project.
6. **Removal of mistakes** — As a User, if I add a custom connector with the wrong URL I can delete it without it ever having been connected.

## Acceptance Criteria

### AC-1: Sheet exists in the Hub
- [x] `'connect'` is a valid `IntegrationSheet` discriminant in [`lib/integrations/types.ts`](../../../lib/integrations/types.ts).
- [x] `PluginsHubView` renders a `CONNECT` tab in the bottom sheet bar.
- [x] Activating CONNECT hides the table-style toolbar (search, category filter, density) — those controls are not meaningful here.
- [x] Activating CONNECT renders `ConnectSheet` instead of the `IntegrationsTable`.

### AC-2: 10 built-in connectors
- [x] All ten built-ins are present: Google Calendar, Google Drive, GitHub, Vercel, Notion, Gamma, Linear, Outlook, Outlook Calendar, Canva.
- [x] Each row exposes the five columns: Category, Tool (name + icon), Install Method, Instructions, Status.
- [x] Rows are grouped visually by category in this order: `Dev → Ops → Productivity → Project → Design → Custom`.

### AC-3: Status model (the fix for "Connected vs Disconnect" confusion)
- [x] When a row is in the connected state, the Status cell shows: green dot + `Connected` text + a `Revoke` button.
- [x] When a row is in the not-connected state, the Status cell shows: gray dot + `Not connected` text + a `Connect` button.
- [x] The button verb (`Revoke` / `Connect`) is always the **action**, never echoes the current state.
- [x] Toggling the button flips the state instantly; no confirmation dialog (this is a local boolean today — when real OAuth lands, AC-3 needs revisiting).

### AC-4: Custom connector add flow
- [x] Top-right of the sheet has `+ Add your own connector` button.
- [x] Clicking the button opens a modal titled `Custom Connector` with description `Enter a custom name and an MCP server URL`.
- [x] The modal has two text inputs: `Name` (placeholder `My Connector`) and `Server URL` (placeholder `https://mcp.example.com/sse`).
- [x] The `Add Connector` button is disabled until both inputs are non-empty after trimming.
- [x] Pressing Enter in the Server URL field with both fields filled submits the form.
- [x] On submit, the dialog closes and the new custom connector appears under the `CUSTOM` group with `Not connected` state.
- [x] Cancel and the X icon both close the dialog without changes.

### AC-5: Custom connector lifecycle
- [x] Custom rows display the entered name, the server URL (under the name), and a `custom` badge next to the name.
- [x] Custom rows can be Connected/Revoked exactly like built-ins.
- [x] Custom rows expose a trash-can icon that removes the connector entirely (regardless of connection state).
- [x] Multiple custom connectors can coexist.

### AC-6: Persistence
- [x] State persists across full page reloads via `localStorage` key `pm:connect:state`.
- [x] State shape: `{ connected: Record<string,boolean>, custom: CustomConnector[] }`.
- [x] SSR/static-export-safe: `localStorage` is only touched after mount (no hydration mismatch).

### AC-7: Counter
- [x] The toolbar above the table reads `N / total connected`, where `total` = 10 built-ins + count of custom connectors.

## Non-Functional Requirements

- **No new dependencies.** Only `lucide-react` icons already in the project.
- **No bridge calls.** This sheet is renderer-only; no `invoke()` calls and no Rust changes.
- **Static-export safe.** Works under `next build` + Tauri webview AND under `next dev` (browser).
- **Typecheck clean.** `npm run typecheck` must pass with no new errors.

## API Surface

### Public exports from `app/ui/views/Plugins/ConnectSheet.tsx`

```ts
export interface CustomConnector {
  id: string;        // crypto.randomUUID()
  name: string;
  serverUrl: string;
  connected: boolean;
  addedAt: string;   // ISO 8601
}

export function ConnectSheet(): JSX.Element;
```

### `localStorage` schema (key `pm:connect:state`)

```ts
{
  "connected": { "google-calendar": true, "github": false, ... },
  "custom": [
    {
      "id": "uuid",
      "name": "Gmail",
      "serverUrl": "https://mcp.gmail.example.com/sse",
      "connected": false,
      "addedAt": "2026-05-24T03:00:00.000Z"
    }
  ]
}
```

## Edge Cases / Error Handling

| Case | Expected behaviour |
|---|---|
| `localStorage` unavailable (private mode / quota) | `loadState()` returns empty default; `saveState()` swallows the error silently |
| Malformed JSON in `localStorage` | `loadState()` returns empty default |
| User types only whitespace in dialog | `Add Connector` button stays disabled (`.trim()` check) |
| User registers duplicate custom names | Allowed; the `id` is a fresh UUID so they are distinct rows (intentional — names are labels, IDs are identity) |
| Reload mid-typing in dialog | Dialog state is component-local; reload discards it. No persistence required for in-flight form input |
| `crypto.randomUUID` unavailable | Not handled (modern browsers and Tauri webview support it). Document only |

## Design Decisions

- **Table over card grid.** First iteration used a card grid; revised based on user feedback. Tables let the user scan Category and Install Method side-by-side, and match the visual language of the other Hub sheets.
- **`Revoke` instead of `Disconnect` as button label.** "Disconnect" reads ambiguously as both a state and an action; "Revoke" is unambiguously an action verb. This is the root cause of the bug the user flagged.
- **`localStorage` for now, not Keychain.** This sheet stores no real credentials yet — only "is X linked." When real OAuth/API tokens land, AC-6 must be updated and the storage moved per ADR-004.
- **Hidden toolbar on Connect.** The search / category / density / freeze controls are bound to `IntegrationsTable`. Showing them on Connect would falsely suggest they affect this sheet.
