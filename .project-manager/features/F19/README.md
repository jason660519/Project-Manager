# F19 — Plugins → Connect Sheet

## Summary

Feature F19 adds a **Connect** sheet to the Integrations Hub (`/plugins`) that lets users link external SaaS tools (Google, GitHub, Microsoft, Notion, Linear, Vercel, Canva, Gamma) and arbitrary MCP servers to the workspace.

Unlike the other sheets in the Integrations Hub which inventory artefacts on disk (plugins, skills, channels, memory, commands), the Connect sheet is a **policy/identity inventory**: a table of "what external accounts is this workspace allowed to act on, and how."

## Scope

- **Sheet shell** wired into `PluginsHubView` (the 7th tab, after Company-AI-App-Design Standards).
- **5-column table** (Category / Tool / Install Method / Instructions / Status) instead of card grid — chosen for information density and parity with the other Hub sheets.
- **10 built-in connectors** grouped into 5 categories (Dev, Ops, Productivity, Project, Design).
- **Custom connector** path: users can register their own MCP server via a Name + Server URL dialog. Custom connectors appear in their own `CUSTOM` group at the bottom of the table.
- **Status model**: each connector is either `Connected` (green dot + Revoke button) or `Not connected` (gray dot + Connect button). State is persisted to `localStorage` under the key `pm:connect:state`.
- **Counter** in the toolbar shows `N / total connected`.

## Out of Scope (intentionally deferred)

- **Real OAuth / API exchange** — the Connect button currently flips a local boolean. Wiring real auth flows belongs to F20+ per provider.
- **Token storage in Keychain** — when real auth lands, secrets must move out of `localStorage` into the Rust `keyring` per ADR-004.
- **MCP handshake** — adding a Custom Connector currently does not validate that the URL is a reachable MCP server. URL ping + capability negotiation are follow-up work.
- **Per-connector configuration UI** (scopes, project bindings, account picker) — current sheet is binary connect/not connected.

## Delivered Files

| Area | Path |
|---|---|
| Sheet shell | [`app/ui/views/Plugins/ConnectSheet.tsx`](../../../app/ui/views/Plugins/ConnectSheet.tsx) |
| Sheet wiring | [`app/ui/views/Plugins/PluginsHubView.tsx`](../../../app/ui/views/Plugins/PluginsHubView.tsx) |
| Sheet enum | [`lib/integrations/types.ts`](../../../lib/integrations/types.ts) |
| Feature spec | [`feature-spec.md`](feature-spec.md) |
| TDD spec | [`tdd-spec.md`](tdd-spec.md) |
| Dev log | [`dev-log.md`](dev-log.md) |
| TDD report | [`tdd-report.md`](tdd-report.md) |
| Free-form notes | [`notes.md`](notes.md) |

## Verification Status

- `npm run typecheck` — passing
- Manual UI scenarios — see [`tdd-report.md`](tdd-report.md)
- Cargo / static export — not affected by this feature (renderer-only change)

## Next Engineer Pointers

1. Read [`feature-spec.md`](feature-spec.md) for the contract and design rationale.
2. Read [`tdd-spec.md`](tdd-spec.md) before changing any state logic — the scenarios capture user-visible expectations.
3. The hand-off list is at the bottom of [`dev-log.md`](dev-log.md).
